const config = require('../../../shared/config');
// Always include collections-online's base
require('./base')({
  helpers: require('../../../shared/helpers')
});

// Project specific
require('./analytics');

require('./document/geo-tagging');
require('./document/tiled-zoomer');

require('./mini-maps');

if (!config.features.oldProfilePage ) {
  require('./profile/index');
}

if(config.features.sitewidePassword) {
  require('./sitewide-password');
}
