'use strict';
const plugins = require('collections-online/plugins');

module.exports.register = () => {
  require('collections-online-cumulus').registerPlugins();
  require('collections-online').registerPlugins();
};