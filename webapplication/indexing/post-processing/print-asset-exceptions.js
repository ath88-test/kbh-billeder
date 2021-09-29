'use strict';

/**
 * The post processing step that steps through all currently indexed assets
 * and deletes every asset that was not indexed during this run of the update to
 * the index.
 */

function printAssetExceptions(state) {

  var errors = state.queries.reduce((result, query) => {
    return result.concat(query.errors);
  }, []);

  if (errors.length > 0) {
    var activity = 'Some errors occurred indexing assets';
    console.log('\n=== ' + activity + ' ===');

    errors.forEach((error, errorIndex) => {
      var message = '--- Exception ';
      message += (errorIndex + 1);
      message += '/';
      message += errors.length;
      message += ' (';
      message += error.catalogAlias;
      message += '-';
      message += error.assetId;
      message += ') ---';

      console.error(message);
      if(!error.catalogAlias || !error.assetId) {
        console.error('Malformed error missing catalogAlias or assetId', error);
      }
      else if(error.innerError) {
        console.error(error.innerError.stack || error.innerError.message);
      }
      else {
        console.error('<no inner error>');
      }
    });
  }

  return state;
}

module.exports = printAssetExceptions;
