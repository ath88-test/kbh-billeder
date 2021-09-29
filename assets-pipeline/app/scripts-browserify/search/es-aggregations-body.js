const config = require('../../../../shared/config');

/**
 * This module generates queries that can be sent to elastic search to get the
 * aggregations that are used for filter buttons.
 * TODO: Move everything that is specific to the field names configurable
 */

var elasticsearchQueryBody = require('./es-query-body');

const CREATION_INTERVAL_FROM = 1000; // Year 1000
const CREATION_INTERVAL_TO = (new Date()).getFullYear(); // Current year
const SKIP_TYPES = ['querystring', 'date-interval-range', 'geobounds'];

function buildFilter(parameters, field) {
  var independentFilters = {};
  Object.keys(parameters.filters).forEach(function(f) {
    if(f !== field) {
      independentFilters[f] = parameters.filters[f];
    }
  });
  var independentParameters = {
    filters: independentFilters
  };
  var body = elasticsearchQueryBody(independentParameters);
  return body.query || {};
}

function getFilterEntry(fieldName, fieldValue, operator) {
  let filter = {
    'range': { }
  };
  filter.range[fieldName] =  {};
  filter.range[fieldName][operator] = fieldValue;

  // Should give us something like.
  // {
  //   'range': {
  //     'creation_time_from.year': {
  //       'gte': '1940'
  //     }
  //   }
  // }
  return filter;
}

/**
 * Create a bool filter entry for a period bucket.
 */
function getPeriodFilterEntry (periodFrom, bucketFrom, periodTo,  bucketTo) {
  const entry = {
    bool: {
      must: []
    }
  };

  // Period falls in to the bucket if it overlaps. That is.
  // Period: 1000-1100
  // Should eg. fall in to these buckets
  // 900-1010, 1090-1200, 1010-1090
  // But not: 1100-1200 (as our periods share start/end and we only want it
  // to fall in to one of the two).
  if (bucketTo) {
    entry.bool.must.push(getFilterEntry(periodTo, bucketTo, 'lte'));
  }

  if (bucketFrom) {
    entry.bool.must.push(getFilterEntry(periodFrom, bucketFrom, 'gte'));
  }

  return entry;
}

/**
 * Create a bool filter entry for a single creation-date bucket.
 */
function getSingleFilterEntry (creationYear, bucketFrom, bucketTo) {
  const entry = {
    bool: {
      must: []
    }
  };

  // We allow to and from to be false to support open ranges.
  if (bucketTo) {
    entry.bool.must.push(getFilterEntry(creationYear, bucketTo, 'lte'));
  }

  if (bucketFrom) {
    entry.bool.must.push(getFilterEntry(creationYear, bucketFrom, 'gte'));
  }

  return entry;
}

/**
 * Generate ES date range filters for a collections-online date-range filter.
 */
function generateDateRangeFilters (filter) {
  // We work under the assumption that a filter will always have singlefield
  // (a single field that holds the date the asset was created), and might have
  // a period-field (a to and from field describing the period the asset was
  // created in).
  let singleField = filter.field;
  let periodFromField = (filter.period && filter.period.from) ? filter.period.from : false;
  let periodToField = (filter.period && filter.period.to) ? filter.period.to : false;

  const hasPeriod =  periodFromField && periodToField;

  // Build up the "filters" aggregation. We aggregate up into a number of
  // buckets. For each bucket we setup a filter for the single-filed, and an
  // optional filter for the period. These two filters are combined via a
  // bool "should" filter allowing any asset that matches any of the two (or
  // both) of the filters to fall into the bucket.
  var result = {};

  // Start of with a openended range for <= CREATION_INTERVAL_FROM.
  result['*-0'] = {
    'bool': {
      'should': []
    }
  };

  // We make the filter open-ended by not specifying the from-value.
  result['*-0'].bool.should.push(getSingleFilterEntry(singleField,false, CREATION_INTERVAL_FROM));
  if (hasPeriod) {
    result['*-0'].bool.should.push(getPeriodFilterEntry(periodFromField,false, periodToField, CREATION_INTERVAL_FROM));
  }

  // Then setup a interval every 100 years up until 1900.
  for(var year = CREATION_INTERVAL_FROM; year < 1900; year+= 100) {
    let fromYear = year;
    let toYear = year + 99;

    const key = `${fromYear}-${toYear}`;
    result[key] = {
      'bool': {
        'should': []
      }
    };

    result[key].bool.should.push(getSingleFilterEntry(singleField, fromYear, toYear));
    if (hasPeriod) {
      result[key].bool.should.push(getPeriodFilterEntry(periodFromField, fromYear, periodToField, toYear));
    }
  }

  // Then every ten years
  var lastYear;
  for(let year = 1900; year < CREATION_INTERVAL_TO; year+= 10) {
    let fromYear = year;
    let toYear = year + 9;
    lastYear = toYear;

    const key = `${fromYear}-${toYear}`;
    result[key] = {
      'bool': {
        'should': []
      }
    };

    result[key].bool.should.push(getSingleFilterEntry(singleField, fromYear, toYear));
    if (hasPeriod) {
      result[key].bool.should.push(getPeriodFilterEntry(periodFromField, fromYear, periodToField, toYear));
    }
  }

  // Finish off with another open-ended range.
  result[`${lastYear}-*`] = {
    'bool': {
      'should': []
    }
  };

  result[`${lastYear}-*`].bool.should.push(getSingleFilterEntry(singleField, lastYear, false));
  if (hasPeriod) {
    result[`${lastYear}-*`].bool.should.push(getPeriodFilterEntry(periodFromField, lastYear, periodToField, false));
  }

  return result;
}

module.exports.generateBody = function(parameters, body) {
  var result = {
    aggs: {}
  };

  Object.keys(config.search.filters).forEach(function(field) {
    var filter = config.search.filters[field];
    var aggs = {};
    if (SKIP_TYPES.indexOf(filter.type) !== -1) {
      // Let's not add aggregations for these types
    } else if (filter.type === 'term') {
      if(!filter.field) {
        throw new Error('Expected "field" option on filter field: ' + field);
      }
      aggs[field] = {
        terms: {
          field: filter.field,
          size: filter.size || 2147483647 // Basically any possible value
        }
      };
    } else if (filter.type === 'date-range') {
      if(!filter.field) {
        throw new Error('Expected "field" option on filter field: ' + field);
      }

      aggs[field] = {
        filters: {
          filters: generateDateRangeFilters(filter)
        }
      };

    } else if (filter.type === 'filters') {
      if(!filter.filters) {
        throw new Error('Expected "filters" option on filter field: ' + field);
      }
      // Tried the date histogram /w interval: '3650d' // Not really 10 years
      // See https://github.com/elastic/elasticsearch/issues/8939
      aggs[field] = {
        filters: {
          filters: filter.filters
        }
      };
    } else {
      throw new Error('Unexpected filter type: ' + filter.type);
    }
    // Let's only add the _independent aggregation, if aggs exists
    if(aggs[field]) {
      result.aggs[field + '_independent'] = {
        filter: buildFilter(parameters, field),
        aggs: aggs
      };
    }
  });

  return result;
};

// TODO make it work by including the right stuff as defined in asset-section.js
// and asset-layout.json
