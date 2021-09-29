// Requiring the babel polyfill, to enable Array.prototype.find
// http://babeljs.io/docs/usage/polyfill/
require('babel-polyfill');

module.exports = options => {
  const config = require('../../../shared/config');

  require('./mobile');
  require('./search');
  require('./search/series');

  if(config.features.users) {
    require('./auth');
  }

  // TODO: Remove this asset require, once downloading has been moved to a
  // seperate script.
  require('./asset');

  if(config.features.feedback) {
    require('./document/feedback');
  }

  require('./document/expandable');
  require('./document/navigator');
  if(config.features.geoTagging || config.features.motifTagging) {
    require('./document/contribution-counter');
  }
  if(config.features.motifTagging) {
    require('./document/motif-tagging');
  }

  require('./sidebar-menu');
  require('./dropdown');
  require('./galleries');

  require('./view-mode');
  require('./site-messages');

  window.helpers = options.helpers;
};
