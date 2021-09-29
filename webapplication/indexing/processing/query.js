'use strict';

/**
 * The processor handling a query which will return zero, one or more assets
 * to be processed, based on the querystring which is passed to the search.
 */

const _ = require('lodash');
const cip = require('../../services/cip');
const processResult = require('./result');

const DEFAULT_PAGE_SIZE = 100;

function processQuery(state, query) {
  console.log('Processing query “' + query.query + '” in', query.catalogAlias);
  // Initiate the search via the CIP
  return cip.request(`/metadata/search/${query.catalogAlias}`, {
    querystring: query.query
  }).then(result => {
    const { totalcount } = result.body;
    // Copy the context, to prevent race-conditions across queries
    const clonedContext = _.cloneDeep(state.context);
    // Add the catalog as the collection in the context
    clonedContext.collection = query.catalogAlias;
    clonedContext.offset = query.offset || 0;
    clonedContext.query = query.query;
    if(!clonedContext.pageSize) {
      clonedContext.pageSize = DEFAULT_PAGE_SIZE;
    }
    // Process the next page in the search result.
    return processResult(clonedContext, state.seriesLookup, state.mode, query, totalcount);
  });
};

module.exports = processQuery;
