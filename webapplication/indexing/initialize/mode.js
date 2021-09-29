'use strict';

var argv = require('yargs').argv;

/**
 * This initializes the indexing mode, from the runtime parameters.
 * @param {Object} state The state of which we are about to initialize.
 */

var MODES = {
  recent: 'recent',
  all: 'all',
  catalog: 'catalog',
  single: 'single',
  clear: 'clear'
};

var MODE_DESCRIPTIONS = {
  recent: 'Syncronize the most recently changed assets.',
  all: 'Syncronize all assets across all catalogs.',
  catalog: 'Syncronize only a single catalog or a comma seperated list.',
  single: 'Syncronize only a single asset or a comma seperated list.',
  clear: 'Deletes the entire index.'
};

// A function to check that a user supplied mode is valid.
function isValidMode(suggestedMode) {
  for (var m in MODES) {
    if (suggestedMode === MODES[m]) {
      return m;
    }
  }
  return false;
}

function usageMessage() {
  var message = ['Please select modes from:'];
  for (var m in MODES) {
    message.push(' * ' + MODES[m] + ': ' + MODE_DESCRIPTIONS[m]);
  }
  return message.join('\n');
}

module.exports = function(state) {

  if (!state.mode) {
    var args = process.argv;
    if (args && args.length <= 2) {
      // No arguments supplied, just node and the app script's path.
      state.mode = MODES.recent;
    } else if (args && args.length >= 3) {
      var suggestedMode = args[2];
      state.mode = isValidMode(suggestedMode);
      if (args.length >= 4) {
        state.reference = args[3];
      }
    }
  }

  if (!state.mode) {
    throw new Error('Unrecognized mode!' + '\n' + usageMessage());
  }

  // Initialize the context passed to asset transformations
  if(!state.context) {
    state.context = {};
  }
  // Determine the context for vision
  state.context.vision = {
    enabled: !!argv.vision || !!argv.visionForce,
    forced: !!argv.visionForce
  };
  // Determine the context for geocoding
  state.context.geocoding = {
    enabled: !!argv.geocoding || !!argv.geocodingForce,
    forced: !!argv.geocodingForce
  };
  // Set the number of assets per page
  if(argv.pageSize) {
    state.context.pageSize = argv.pageSize;
  }

  console.log('Initialized the indexing', state.mode, 'mode');

  return state;
};
