'use strict';

const documentController = require('../document');
const es = require('../../services/elasticsearch');

const layouts = require('../../layouts');
const assetSection = layouts.section('asset');

/**
 * Renders an asset's landing page
 */
exports.index = function(req, res, next) {
  return documentController.get(req, 'asset').then((metadata) => {
    // Read collection from the metadata catalog if not specified
    metadata.collection = metadata.collection || metadata.catalog;
    return documentController.getRelatedMetadata(metadata).then(related => {
      metadata.related = related;
      return metadata;
    });
  })
    .then(function(metadata) {
      return es.search({
        type: 'series',
        body: {
          query: {
            match: {
              assets: {
                query: `${metadata.collection}-${metadata.id}`,
                fuzziness: 0,
                operator: 'and',
              }
            }
          }
        }
      })
        .then((seriesSearchResult) => {
          const assetSeries = seriesSearchResult.hits.hits
            .map((seriesDoc) => seriesDoc._source);

          return {
            assetSeries,
            metadata,
          };
        });
    })
    .then(({assetSeries, metadata}) => {
      res.render('asset.pug', {
        metadata,
        assetSection: assetSection(),
        assetSeries,
        req,
      });
    })
    .then(null, function(error) {
      if (error.message === 'Not Found') {
        error.status = 404;
      }
      next(error);
    });
};
