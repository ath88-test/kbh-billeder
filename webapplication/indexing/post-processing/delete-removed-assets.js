'use strict';

/**
 * The post processing step that steps through all currently indexed assets
 * and deletes every asset that was not indexed during this run of the update to
 * the index.
 */

const Q = require('q');
const es = require('../../lib/services/elasticsearch');
const _ = require('lodash');

module.exports = function(state) {
  var activity = 'Post-processing to delete removed assets';

  console.log('\n=== ' + activity + ' ===');

  if (!['all', 'catalog', 'single'].includes(state.mode)) {
    console.log('Removed assets gets deleted only in "all", "catalog" or ' +
                '"single" mode.');
    return state;
  }

  let deletedAssetIdsPromise;

  if (state.mode === 'all') {
    // In 'all' mode we just check the full list of items we indexed,
    // and remove all the assets and series in elasticsearch that are
    // not in our list -- we did a full re-index, so all of these can
    // be removed.
    const deletedAssetIds = [];

    const indexedIds = state.queries
      // If query is falsy (undefined or 0) there is no offset
      // and we want to grab it and get its indexed IDs
      .filter((query) => !query.offset)
      .map((query) => query.indexedIds)
      .reduce((a, b) => a.concat(b), []);

    deletedAssetIdsPromise = es.scrollSearch({
      'query': {
        'bool': {
          'must_not': {
            'ids': {
              'values': indexedIds
            }
          }
        }
      }
    }, function(deletedEntry) {
      deletedAssetIds.push(deletedEntry._id);
    }).then(function() {
      return deletedAssetIds;
    });
  }
  else if (state.mode === 'catalog') {
    deletedAssetIdsPromise = state.queries.reduce((deletedAssetIdsPromise, query) => {
      console.log('Indexed', query.indexedIds.length, 'assets and series from', query.catalogAlias);
      return deletedAssetIdsPromise.then(deletedAssetIds => {
        if (query.offset > 0) {
          console.log('Skipping a query that had a non-zero offset.');
          return deletedAssetIds;
        }
        // Scroll search for all assets in the catalog that was not indexed.
        return es.scrollSearch({
          'query': {
            'bool': {
              'must': {
                'match': {
                  'catalog.raw': query.catalogAlias
                }
              },
              'must_not': {
                'ids': {
                  'values': query.indexedIds.filter((id) => !id.startsWith('series/')),
                }
              }
            }
          }
        }, function(deletedAsset) {
          deletedAssetIds.push(deletedAsset._id);
        }).then(function() {
          return deletedAssetIds;
        });
      });
    }, new Q([]));
  }
  else {
    const deletedAssetIds = state.queries.reduce((deletedAssetIds, query) => {
      const assetIds = query.assetIds
        .filter((assetId) => !assetId.startsWith('series/'))
        .map((assetId) => query.catalogAlias + '-' + assetId);

      const indexedAssetIds = query.indexedIds
        .filter((id) => !id.startsWith('series/'));

      const moreDeletedAssetIds = _.difference(assetIds, indexedAssetIds);
      return _.union(deletedAssetIds, moreDeletedAssetIds);
    }, []);

    deletedAssetIdsPromise = new Q(deletedAssetIds);
  }

  return Q.when(deletedAssetIdsPromise).then(deletedAssetIds => {
    console.log('Deleting', deletedAssetIds.length, 'asset(s)');
    var actions = deletedAssetIds.map(deletedAssetId => {
      if(deletedAssetId.startsWith('series/')) {
        return {delete: {_type: 'series', _id: deletedAssetId}};
      }
      return {delete: {_type: 'asset', _id: deletedAssetId}};
    });
    if (actions.length > 0) {
      return es.bulk({
        index: state.context.index,
        body: actions
      });
    }
  }).then(function() {
    return state;
  });
};
