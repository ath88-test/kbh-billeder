'use strict';

// TODO: Config must have customization set as very first because some modules depend on config being complete at require time (bad, shouldfix)
const config = require('./lib/config');
config.setCustomizationPath(__dirname + '/..');

const indexingEngine = require('./indexing/run');

function run(state) {
  return indexingEngine(state || {}).then(function() {
    console.log('\nAll done - good bye!');
    process.exit(0);
  }, function(err) {
    console.error('An error occured!');
    console.error(err.stack || err);
    process.exit(1);
  });
}

run();
