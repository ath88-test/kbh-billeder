const config = require('../../shared/config');
// Always include collections-online's base
// FIXME: For some reason require currently does not accept "base" as the
// module. To address this we have to provide a full path to the file.
require('./base')({
  helpers: require('../../shared/helpers')
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
