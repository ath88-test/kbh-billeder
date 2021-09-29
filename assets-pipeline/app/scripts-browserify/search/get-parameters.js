const config = require('../../../../shared/config');

/**
 * This module generates search parameters that will lead to a specific
 * filtering and sorting being activated, based on the querystring.
 * This is the inverse of generate-querystring.
 */

var querystring = require('querystring');
const DEFAULT_SORTING = require('./default-sorting');

module.exports = function() {
  var urlParams = window.location.search.substring(1);
  var parameters = querystring.parse(urlParams);

  // Extract the sorting query parameter
  var sorting = parameters.sort || DEFAULT_SORTING;
  delete parameters.sort;

  var filters = {};

  // Holds the centerpoint and zoom-level of the map. Empty if we're not viewing
  // the map.
  var map = '';
  // Same, but for our Historisk Atlas map
  var smap ='';

  // The rest are filters
  Object.keys(parameters).forEach(function(field) {
    // TODO: Look for the skipSplit config parameter
    var filter = config.search.filters[field];
    if(filter) {
      var value = parameters[field];
      if(!filter.skipSplit) {
        value = value.split(',');
      }

      if(field == 'q') {
        // Escape all Lucene special characters, to avoid syntax errors in
        // Elastic Search query, c.f.
        // https://lucene.apache.org/core/3_0_3/queryparsersyntax.html#Escaping%20Special%20Characters
        // BUT with the note that we allow ?, ", and *.
        [
          '\\+', '\\-', '\&\&', '\\|\\|', '!', '\\(', '\\)', '\\{', '\\}',
          '\\[', '\\]', '\\^', '~', '\\:', '\\\\'
        ].forEach((luceneSpecialCharacter) => {
          const characterGlobalPattern = new RegExp(luceneSpecialCharacter, 'g');
          if(Array.isArray(value)) {
            value = value.map((part) => part.replace(characterGlobalPattern, ' '));
          }
          else {
            value = value.replace(characterGlobalPattern, ' ');
          }
        });
      }

      filters[field] = value;
    }
    else if (field === 'map') {
      map = parameters[field];
    }
    else if (field === 'smap') {
      smap = parameters[field];
    }
    else {
      console.warn('Skipping an unexpected search parameter:', field);
    }
  });

  return {
    filters: filters,
    sorting: sorting,
    map: map,
    smap: smap
  };
};
