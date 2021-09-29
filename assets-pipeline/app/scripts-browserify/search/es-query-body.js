const config = require('../../../../shared/config');

/**
 * This module generates queries that can be sent to elastic search
 * TODO: Move everything that is specific to the field names configurable
 */

module.exports = function(parameters) {
  var result = {};
  var query = {};

  var queries = [];

  // Start with any base query specified in the config
  if(config.search.baseQuery) {
    queries.push(config.search.baseQuery);
  }
  Object.keys(parameters.filters).forEach(function(field) {
    var filter = config.search.filters[field];
    if(filter) {
      if(filter.type === 'term') {
        var query = {
          terms: {}
        };
        query.terms[filter.field] = parameters.filters[field];
        queries.push(query);
      } else if(filter.type === 'date-range' || filter.type === 'date-interval-range') {
          var intervalQueries = parameters.filters[field].map(function(interval) {
          var intervalSplit = interval.split('-');
          var range = {
            format: 'yyyy/MM/dd||yyy'
          };
          if(intervalSplit[0] && intervalSplit[0] !== '*') {
            range.gte = intervalSplit[0];
          }
          if(intervalSplit[1] && intervalSplit[1] !== '*') {
            if(intervalSplit[1].indexOf('/') === -1) {
              // intervalSplit[1] might be 1919 .. that is no slashes
              // Let's ask for dates less than the year+1, as ex '1919-02-01'
              // is not less than or equal to 1919 which is 1919-01-01
              range.lt = (parseInt(intervalSplit[1], 10) + 1).toString();
            } else {
              range.lt = intervalSplit[1];
            }
          }
          // Construct the query object
          if(filter.type === 'date-range') {
            var singlefieldRange = {
              range: {}
            };
            singlefieldRange.range[filter.field] = range;

            // If we're using a period-filter as well, we have to go with a
            // combined filter allowing assets to match either the date.
            if (filter.period && filter.period.to && filter.period.from) {
              // To match the assets period must overlap with the date range.
              // That is, either the start of the range should be within the
              // period, or the end must. (Both is also ok, but that is covered)
              // by the previous.
              // That gives us the following bool structure that we then have
              // to fill with the actual field names and range values.

              var periodFilter = {
                bool: {
                  must: [
                    {
                      bool: {
                        must: [
                          {
                            range: {
                              [filter.period.from]: {
                                gte: range.gte,
                              }
                            }
                          },
                          {
                            range: { //TODO: is this even used?
                              [filter.period.to]: {
                                lte: range.lte,
                              }
                            }
                          }
                        ]
                      }
                    },
                    {
                      bool: {
                        must: [
                          {
                            range: { //TODO: is this even used?
                              [filter.period.from]: {
                                gt: range.gt,
                              }
                            }
                          },
                          {
                            range: {
                              [filter.period.to]: {
                                lt: range.lt,
                              }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              };

              // Setup a new combined filter that allows the asset to match
              // either a specific creation date or a period.
              var combinedQuery = {
                bool: {
                  should: [singlefieldRange, periodFilter]
                }
              };

              return combinedQuery;
            } else {
              // Just return the single-field singlefieldRange.
              return singlefieldRange;
            }
          }
          //else if(filter.type === 'date-interval-range') {

          //   if(!filter.fields || !filter.fields.from || !filter.fields.to) {
          //     throw new Error('Expected filter to have fields.from and .to');
          //   }
          //   // We query based on the follwing rules:

          //   // a | |       Excluded of as it's too old
          //   // b       | | Excluded of as it's too new
          //   // c   |   |   Included as the we are within the interval
          //   // d     ||    Included as the interval is enclosed
          //   // e |   |     Included as its not quarenteed that it's not too old
          //   // f     |  |  Included as its not quarenteed that it's not too new
          //   //      ^ ^
          //   //      A B

          //   const queries = [];
          //   // If the user has selected a lower bound
          //   if(range.gte) {
          //     queries.push({
          //       range: {
          //         [filter.fields.to]: {
          //           gte: range.gte,
          //         }
          //       }
          //     });
          //   }
          //   if(range.lt) {
          //     queries.push({
          //       range: {
          //         [filter.fields.from]: {
          //           lt: range.lt,
          //         }
          //       }
          //     });
          //   }
          //   return {
          //     bool: {
          //       must: queries
          //     }
          //   };
          // }
        });

        queries.push({
          bool: {
            should: intervalQueries
          }
        });
      } else if(filter.type === 'querystring') {
        if(parameters.filters[field]) {
          queries.push({
            'query_string': {
              'query': parameters.filters[field],
              'default_operator': 'OR',
              'fields': [
                'title^10',
                'short_title^5',
                'description',
                'previewAssets.short_title^3',
                'id',
                'previewAssets.description',
                'previewAssets.tags',
                'catalog_name',
                'country',
                'disctrict',
                'neighborhood',
                'tags_verified',
                'secondary_description',
                'street_name',
                'place',
                'archivename',
                'city',
                'city_architect',
                'creator',
                'district',
                'original_material.displaystring',
                'other_architects',
                'project_architect',
                'street_number',
                'tags',
                'zipcode',
              ],
            }
          });
        }
      } else if(filter.type === 'geobounds') {
        if(parameters.filters[field]) {
          queries.push({
            "geo_bounding_box": {
              "location": parameters.filters[field]
            }
          });
        }
      } else if(filter.type === 'filters') {
        var sizeQueries = parameters.filters[field].map(function(size) {
          return filter.filters[size] || {};
        });
        if(sizeQueries.length > 0) {
          queries.push({
            bool: {
              should: sizeQueries
            }
          });
        }
      } else {
        console.error('Filtering on unexpected type of filter: ', filter.type);
      }
    } else {
      console.error('Requested filtering on an unexpected field: ', field);
    }
  });

  if(queries.length > 0) {
    query.bool = {
      must: queries
    };
  }

  if(parameters.sorting) {
    var sortOption = config.sortOptions[parameters.sorting];
    result.sort = sortOption.method;
  }

  if(Object.keys(query).length > 0) {
    result.query = query;
  }

  return result;
};
