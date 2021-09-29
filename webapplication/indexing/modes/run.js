'use strict';

/**
 * Running the indexing procedure in whatever mode the state suggests.
 */

var Q = require('q');
var processQuery = require('../processing/query');
var config = require('../../lib/config');

const POST_PROCESSING_STEPS = [
  require('../post-processing/delete-removed-assets'),
  require('../post-processing/clear-index')
];

module.exports = state => {
  const mode = require('./' + state.mode);
  // Generate the queries
  state.queries = mode.generateQueries(state);
  // Add any indexing restrictions from the configuration.
  state.queries.forEach((q) => {
    if (config.cip.indexing.restriction) {
      q.query = '(' + q.query + ') AND ' + config.cip.indexing.restriction;
    }
  });

  console.log('\n=== Starting to process ===');
  // TODO: Consider if the two new Q(state)s need to be wrapped in promises.

  return state.queries.reduce((promise, query) => {
    return promise.then((state) => {
      // Process the query, hang onto the indexed asset ids and exceptions
      // and return the state
      return processQuery(state, query)
      .then(({ indexedIds, errors }) => {
        query.indexedIds = indexedIds;
        query.errors = errors;
        return state;
      });
    });
  }, new Q(state)).then((state) => {
    console.log('Finished processing!');
    return POST_PROCESSING_STEPS.reduce(Q.when, new Q(state));
  });
};
