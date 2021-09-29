'use strict';

const config = require('../../lib/config');

/**
 * Running the indexing procedure in the catalog mode.
 */

module.exports.generateQueries = state => {
  var timeDelta;
  if (state.reference) {
    timeDelta = state.reference;
  } else {
    timeDelta = '10m';
  }
  // Loop over every catalog and produce a query
  return Object.keys(config.cip.catalogs).map(catalogAlias => {
    return {
      catalogAlias,
      query: '"Record Modification Date" >= $now-' + timeDelta
    };
  });
};
