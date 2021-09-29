'use strict';

/**
 * The post processing step that clears the index when in clear mode.
 */

const es = require('../../lib/services/elasticsearch');

module.exports = function(state) {
  if (state.mode === 'clear') {
    return es.indices.delete({
      index: state.context.index
    }).then(function() {
      console.log('Index cleared.');
      return state;
    });
  } else {
    return state;
  }
};
