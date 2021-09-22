'use strict';

const config = require('./lib/config');
const indexingEngine = require('./plugins/indexing').module;

config.setCustomizationPath(__dirname);

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
