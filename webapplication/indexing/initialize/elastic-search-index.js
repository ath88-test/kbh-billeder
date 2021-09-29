'use strict';

/**
 * This initializes the ElasticSearch index.
 *
 * @param {Object} state The state of which we are about to initialize.
 */

const es = require('../../lib/services/elasticsearch');
const config = require('../../lib/config');

module.exports = (state) => {
  // Save the index in the context
  state.context.index = config.es.index;
  console.log('Initializing the Elastic Search index: ' + state.context.index);

  return es.indices.exists({
    index: state.context.index
  })
    .then((exists) => {
      if(exists) {
        //If index exists check that it has the mappings we need
        return ensureMappingsExists();
      }
      //else we create the index
      return createIndex();
    })

  function ensureMappingsExists() {
    return es.indices.get({
      index: state.context.index
    })
    .then((index) => {
      if(!index[config.es.index].mappings.series) {
        const seriesMapping = getSeriesMapping();
        return es.indices.putMapping({
          index: state.context.index,
          type: 'series',
          body: seriesMapping
        })
          .then(response => {
            console.log("Series mapping successfully added to index", response);
            return state;
          })
          .catch(error => console.error("series error: ", error));
      }
      return state;
    });
  }

  function createIndex() {
    return es.indices.create({
      index: state.context.index,
      body: {
        'index': {
          'max_result_window': 100000 // So sitemaps can access all assets
        },
        'mappings': {
          asset: getAssetMapping(),
          series: getSeriesMapping()
        }
      }
    })
      .then(function() {
        console.log('Index created.');
        return state;
      }, function(err) {
        // TODO: Add a recursive check for this message.
        if (err.message === 'No Living connections') {
          throw new Error('Is the Elasticsearch server running?');
        } else {
          throw err;
        }
      });
  }

  function getAssetMapping() {
    let fields = config.types.asset.mapping || {};
    fields.id = {
      'type': 'string',
      'analyzer': 'english',
      'fields': {
        'raw': {
          'type': 'string',
          'index': 'not_analyzed'
        }
      }
    };
    // Get all fields that needs a raw value included in the index
    config.types.asset.fields.filter((field) => {
      return field.includeRaw;
    })
      .forEach((field) => {
        var fieldName = field.short;
        fields[fieldName] = {
          'type': 'string',
          'analyzer': 'english',
          'fields': {
            'raw': {
              'type': 'string',
              'index': 'not_analyzed'
            }
          }
        };
      });
    // Derive mappings from the asset field types
    // First the fields with date types
    config.types.asset.fields.filter((field) => {
      return field.type === 'date';
    })
      .forEach((field) => {
        var fieldName = field.short;
        fields[fieldName] = {
          type: 'object',
          properties: {
            timestamp: {type: 'date'}
          }
        };
      });
    // Enumurations should not have their displaystring tokenized
    config.types.asset.fields.filter((field) => {
      return field.type === 'enum';
    })
      .forEach((field) => {
        var fieldName = field.short;
        fields[fieldName] = {
          type: 'object',
          properties: {
            displaystring: {
              'type': 'string',
              'index': 'not_analyzed'
            }
          }
        };
      });

    return {
      asset: {
        properties: fields
      }
    };
  }

  function getSeriesMapping() {
    return {
      properties: {
        url: {
          type: 'keyword'
        },
        title: {
          type: 'string',
          analyzer: 'english',
        },
        description: {type: 'text'},
        tags: {type: 'text'},
        dateFrom: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'date'
            }
          }
        },
        dateTo: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'date'
            }
          }
        }
      }
    };
  }
};
