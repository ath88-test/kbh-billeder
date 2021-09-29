'use strict';

/**
 * The processor handling an entire result.
 */

const _ = require('lodash');
const cip = require('../../services/cip');
const config = require('../../lib/config');
const es = require('../../lib/services/elasticsearch');
const Q = require('q');

function AssetIndexingError(catalogAlias, assetId, innerError) {
  this.catalogAlias = catalogAlias;
  this.assetId = assetId;
  this.innerError = innerError;
}

const processAsset = require('./asset');

function saveChangesToCIP(catalogAlias, items) {
  return cip.request(`/metadata/setfieldvalues/${catalogAlias}`, {}, {
    items
  });
}

async function getResultPage(query, catalog, index, pageSize) {
  const operation = `/metadata/search/${catalog}/${config.cip.client.constants.layoutAlias}`;

  const options = {
    querystring: query,
    startindex: index,
    maxreturned: pageSize
  };

  if(config.cip.indexing.additionalFields) {
    options.field = config.cip.indexing.additionalFields;
  }
  const response = await requestWithRetries(operation, options, 4, 2);

  if (!response || !response.body || typeof(response.body.items) === 'undefined') {
    console.error('Unexpected response:', response);
    throw new Error('The request for field values returned an empty result.');
  } else {
    return response.body.items;
  }
}

const errorsToRetry = ['ECONNREFUSED', 'ESOCKETTIMEDOUT', 'ECONNRESET'];

async function requestWithRetries(operation, options, retries, backoff) {
  try {
    return await cip.request(operation, options);
  } catch(error) {
    if(retries <= 1) {
      throw error;
    }
    if(!errorsToRetry.includes(error.code)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, backoff*1000));
    return requestWithRetries(operation, options, retries - 1, backoff*backoff);
  }
}
/**
 * Process a specific result page, with assets.
 */
function processResultPage(totalcount, context, seriesLookup, mode, pageIndex) {
  const { query, collection, pageSize } = context

  const totalPages = Math.ceil(totalcount / pageSize);
  const progress = '[' + (pageIndex + 1) + '/' + totalPages + ']';
  console.log(progress + ' Queuing page');

  return getResultPage(query, collection, pageIndex * pageSize, pageSize)
  .then(assets => {
    console.log(progress + ' Received metadata');
    // Perform a processing of all the assets on the page
    const assetPromises = assets
    .filter((asset) => {
      if(!asset.id) {
        console.warn("Skipping asset that does not look right (has no ID)", asset);
        return false;
      }
      return true;
    })
    .map(asset => {
      const assetSeries = parseAssetSeries(asset);
      // Clone the context for every asset
      const clonedContext = _.cloneDeep(context);
      // Keep an object of requested changes to the asset in Cumulus
      clonedContext.changes = {};
      // Define a method to persist values in Cumulus
      clonedContext.persist = (name, value) => {
        // Determine the fields UUID in Cumulus
        if(!config.types || !config.types.asset || !config.types.asset.fields) {
          throw new Error('Cannot get field: Missing config.types.asset.fields');
        }
        const field = config.types.asset.fields.find(field => field.short === name);
        if(!field) {
          throw new Error('Field is missing in config.types.asset.fields: ' + name);
        }
        // Update the value in the changes object
        clonedContext.changes[field.cumulusKey] = value;
      };
      // Process each asset
      return processAsset(asset, assetSeries, clonedContext)
      .catch((err) => {
        const msg = 'ERROR processing ' + collection + '-' + asset.id;
        console.error(msg + (err.message && ': ' + err.message));
        return new AssetIndexingError(collection, asset.id, err);
      });
    });

    // Once all asset promises resolves:
    // 1. changes are saved to Cumulus
    // 2. metedata is indexed in elasticsearch
    // in two bulk calls

    return Q.all(assetPromises)
    .then((assets) => {
      return {
        errors: assets.filter(a => a instanceof AssetIndexingError),
        assets: assets.filter(a => !(a instanceof AssetIndexingError)),
      };
    })
    .then(({ assets, errors }) => {
      if(mode == 'all') {
        assets.forEach(({ assetSeries }) => assetSeries.forEach((series) => {
          if(!seriesLookup[series._id]) {
            seriesLookup[series._id] = series;
          }
        }));
        return {assets, errors, seriesLookup};
      }

      if(mode == 'single' || mode == 'catalog' || mode == 'recent') {
        const assetSeries = _.uniq(
          assets
            .map((asset) => asset.assetSeries)
            .reduce((a, b) => a.concat(b), []),
          '_id'
        );

        const seriesIds = assetSeries
          .map((series) => series._id);

        const assetIds = _.uniq(assets.map(({metadata}) => `${metadata.collection}-${metadata.id}`));

        return es.search({
          type: 'series',
          body: {
            query: {
              bool: {
                should: [
                  {
                    terms: {
                      _id: seriesIds
                    }
                  },
                  ...assetIds.map((assetId) => ({
                    match: {
                      assets: {
                        query: assetId,
                        fuzziness: 0,
                        operator: 'and',
                      }
                    }
                  }))
                ]
              }
            }
          }
        })
          .then((response) => {
            const seriesLookup = {};
            response.hits.hits.forEach((elasticSearchSeries) => {
              const series = {
                _id: elasticSearchSeries._id,
                ...elasticSearchSeries._source
              };

              assets.forEach(({metadata}) => {
                const assetIndex = series.assets.findIndex((assetId) => assetId === `${metadata.collection}-${metadata.id}`);
                if(assetIndex !== -1) {
                  series.assets.splice(assetIndex, 1);
                }

                const previewAssetIndex = series.previewAssets
                  .findIndex((previewAsset) => `${previewAsset.collection}-${previewAsset.id}` === `${metadata.collection}-${metadata.id}`);
                if(previewAssetIndex !== -1) {
                  series.previewAssets.splice(previewAssetIndex, 1);
                }
              });

              seriesLookup[series._id] = series;
            });

            assetSeries.forEach((series) => {
              if(seriesLookup[series._id]) {
                // If the series already exists in es, prefer data from cumulus (update it)
                const existingSeries = seriesLookup[series._id];
                Object.keys(series)
                  // Get all keys on series that are not `assets` and `previewAssets`
                  .filter((key) => ![ 'assets', 'previewAssets' ].includes(key))
                  // And update them in the existing series
                  .forEach((key) => existingSeries[key] = series[key]);
              }
              else {
                // Otherwise, add the series
                seriesLookup[series._id] = series;
              }
            });

            return {assets, errors, seriesLookup};
          });
      }
    })
    .then(({assets, errors, seriesLookup}) => {
      assets.forEach(({ metadata, assetSeries }) => {
        assetSeries.forEach((as) => {
          const series = seriesLookup[as._id];
          if(typeof series.assets == "undefined") {
            series.assets = [];
          }
          if(!series.assets.includes(metadata.collection + '-' + metadata.id)) {
            series.assets.push(metadata.collection + '-' + metadata.id);
          }
          if(typeof series.previewAssets == "undefined") {
            series.previewAssets = [];
          }

          if(series.previewAssets.length < 3) {
            series.previewAssets.push(metadata);
          }
          else {
            // We already have 3 preview assets. Now, we determine if we
            // should randomly shuffle this asset into the list of preview
            // assets. First, we get a random index from [0;assets.length - 1]
            const indexToShuffleInto = Math.floor(Math.random() * series.assets.length);

            // If the calculated index is [0,1,2] we place this asset on that
            // position -- otherwise we missed the list of preview assets, and
            // leave it out.
            if(indexToShuffleInto <= 2) {
              series.previewAssets[indexToShuffleInto] = metadata;
            }
          }
        })
      });

      const assetSeries = Object.values(seriesLookup);

      // Save the changes to the CIP
      const changes = assets
        .filter(({context}) => {
          // Filter out assets without changes
          return context.changes && Object.keys(context.changes).length > 0;
        })
        .map(({metadata, context}) => {
          return Object.assign({
            id: metadata.id
          }, context.changes);
        });
      // If changes to the CIP assets is needed, save them
      if(changes.length > 0) {
        // TODO: Consider the response from the CIP - as a change might fail.
        return saveChangesToCIP(context.collection, changes)
        .then(response => {
          if(response.statusCode === 200) {
            console.log(progress + ' Updated', changes.length, 'assets in Cumulus');
            return { assets, assetSeries, errors };
          } else {
            throw new Error('Error updating assets in Cumulus');
          }
        });
      } else {
        return { assets, assetSeries, errors };
      }
    }).then(({assets, assetSeries, errors}) => {
      // Create a list of items for a bulk call, for assets that are not errors.
      const items = [];
      assets.filter(asset => !(asset instanceof AssetIndexingError))
      .forEach(({metadata, context}) => {
        items.push({
          'index' : {
            '_index': context.index,
            '_type': 'asset',
            '_id': metadata.collection + '-' + metadata.id
          }
        });
        items.push(metadata);
      });

      assetSeries.forEach((series) => {
        if(series.assets.length > 0) {
          items.push({
            'index' : {
              '_index': context.index,
              '_type': 'series',
              '_id': series._id
            }
          });

          items.push({
            ...series,
            _id: undefined
          });
        } else {
          items.push({
            'delete' : {
              '_index': context.index,
              '_type': 'series',
              '_id': series._id
            }
          });
        }
      });

      // Perform the bulk operation
      return es.bulk({
        body: items
      }).then(response => {
        const indexedIds = [];
        // Go through the items in the response and replace failures with errors
        // in the assets
        response.items.forEach(item => {
          if(item.index.status >= 200 && item.index.status < 300) {
            indexedIds.push(item.index._id);
          } else {
            // TODO: Consider using the AssetIndexingError instead
            errors.push(new Error('Failed index ' + item.index._id));
          }
        });
        console.log(progress + ' Indexed', indexedIds.length, 'assets and series in ES');
        // Return the result
        return { errors, indexedIds };
      });
    });
  });
}

function parseAssetSeries(asset) {
  const assetSeries = getAssetSeries(asset);
  return assetSeries.map(assetSeries => formatSeries(assetSeries));
}

function getAssetSeries(asset) {
  let assetSeries = [];
  if(asset["{252492cb-6efd-45f3-9bb5-d17824784d30}"]) {
    assetSeries.push({
      url: asset["{44c7a3b9-8ff2-4e58-8120-e0e64ba263ea}"],
      title: asset["{252492cb-6efd-45f3-9bb5-d17824784d30}"],
      description: asset["{095e1a43-d628-4944-8e8f-64d3db8c5df5}"],
      tags: asset["{bef11691-f8a1-49dd-8fbf-45c7d359764f}"],
      dateFrom: asset["{1a29ca44-f655-49c8-b015-223b51f2e4c5}"],
      dateTo: asset["{a22b11c8-5c33-4761-96bc-52467080468a}"]
    });
  }
  if(asset["{665faabb-8f6e-41ef-b300-9433eb5eae6f}"]) {
    assetSeries.push({
      url: asset["{ba67b9d6-8459-430c-9819-e660a294f7e7}"],
      title: asset["{665faabb-8f6e-41ef-b300-9433eb5eae6f}"],
      description: asset["{956b74f0-9cc7-4525-8fda-40e3df807986}"],
      tags: asset["{be219ed7-c0c3-4b38-9991-4dab67dc084f}"],
      dateFrom: asset["{03879423-335a-4772-829c-b31b1d768270}"],
      dateTo: asset["{fe893328-4d92-4c8f-a847-c42cc1f6fd8d}"]
    });
  }
  return assetSeries;
}

function formatSeries(assetSeries) {
  const formattedSeries = {
    url: assetSeries.url,
    _id: "series/" + assetSeries.url,
    title: assetSeries.title,
    description: assetSeries.description,
    tags: assetSeries.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag)
  }
  if(assetSeries.dateFrom.year > assetSeries.dateTo.year) {
    formattedSeries.dateFrom = formatDate(assetSeries.dateTo);
    formattedSeries.dateTo = formatDate(assetSeries.dateFrom);
  } else {
    formattedSeries.dateFrom = formatDate(assetSeries.dateFrom);
    formattedSeries.dateTo = formatDate(assetSeries.dateTo);
  }
  return formattedSeries;
}

function formatDate(date) {
  return {
    ...date,
    timestamp: getTimestamp(date)
  };
}

function getTimestamp(date) {
  const month = zeroPad(date.month || 1);
  const day = zeroPad(date.day || 1);
  return `${date.year}-${month}-${day}`;
}

function zeroPad(number) {
  const stringifiedNumber = number.toString();
  if(stringifiedNumber.length >= 2) {
    return stringifiedNumber;
  }
  return stringifiedNumber.padStart(2,"0");
}

function processResultPages(totalcount, context, seriesLookup, mode) {
  // Build up a list of parameters for all the pages in the entire result
  const pageIndecies = [];
  for(let p = context.offset; p * context.pageSize < totalcount; p++) {
    pageIndecies.push(p);
  }
  // Return a promise of process result pages (evaluated one after another)
  return pageIndecies.reduce((idsAndErrors, pageIndex) => {
    return Q.when(idsAndErrors)
    .then(({allIndexedIds, allErrors}) => {
      return processResultPage(totalcount, context, seriesLookup, mode, pageIndex)
      .then(({indexedIds, errors}) => {
        return {
          allIndexedIds: allIndexedIds.concat(indexedIds),
          allErrors: allErrors.concat(errors)
        };
      });
    });
  }, new Q({
    allIndexedIds: [],
    allErrors: []
  }))
  .then(({allIndexedIds, allErrors}) => {
    return {
      indexedIds: allIndexedIds,
      errors: allErrors
    };
  });
}

function processResult(context, seriesLookup, mode, query, totalcount) {
  console.log('Processing a result of ' + totalcount + ' assets');
  return processResultPages(totalcount, context, seriesLookup, mode);
}

module.exports = processResult;
