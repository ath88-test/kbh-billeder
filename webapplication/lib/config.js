'use strict';

const path = require('path');
const _ = require('lodash');
const rootPath = path.normalize(path.join(__dirname, '..'));

const CLIENT_SIDE_KEYS = [
  'auth0',
  'es',
  'features',
  'geoTagging',
  'search',
  'siteSubTitle',
  'siteTitle',
  'sortOptions',
  'themeColor',
  'translations',
  'types',
  'styling'
];

// Default config parameters goes here
const defaults = {
  allowRobots: true,
  // Cache header to send along with images.
  assetCacheExpiration: 60 * 60 * 24 * 30,
  features: {
    enableVisionTagSuggestions: true,
    enableGoogleTranslate: true
  },
  keystone: {
    nav: {
      users: 'users',
      pages: 'pages',
      menus: ['menu-items'],
      frontpage: ['frontpage-items'],
      sections: ['galleries', 'gallery-items', 'jumbo-items', 'tag-clouds', 'map-views'],
    },
  },
  root: rootPath,
  search: {
    path: 'search',
    // The zoom level where we should start using geo-hashing instead of real
    // assets.
    // (zoom <= hashAtZoomLevel)
    geohashAtZoomLevel: 15,
    // Zoom level where we should start frontend clustering of assets.
    // (zoom <= clusterAtZoomLevel)
    clusterAtZoomLevel: 18,
    // The size of the hash-buckets, 7 roughly translates to 152m x 152m. See
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-geohashgrid-aggregation.html
    geohashPrecision: 7,
    // maximum number of results to request for asset markeres when we've
    // passed assetZoomLevel.
    maxAssetMarkers: 5000
  },
  siteTitle: 'Collections Online',
  styling: {
    // The width at which we should switch between mobile / desktop.
    // We're on mobile if browser-width < mobileWidthBreakpoint.
    mobileWidthBreakpoint : 768,
  },
  thumbnailSize: 350,
  types: {
    asset: {
      router: 'lib/routers/asset'
    }
  }
};

function override(config) {
  const defaultAppPath = path.normalize(path.join(__dirname, '..', '..', 'assets-pipeline/app'));
  config.appPaths = _.concat(config.appPaths, defaultAppPath);
  if(config.features.keystone && config.siteTitle) {
    config.keystone.options.name = config.siteTitle;
    config.keystone.options.brand = config.siteTitle;
  }
}

var config = {};

config.setCustomizationPath = (customizationPath) => {
  config.customizationPath = customizationPath;
  config.reload();
};

config.getClientSideConfig = () => {
  // Copy over the values that are not confidential
  let result = {};
  CLIENT_SIDE_KEYS.forEach(key => {
    result[key] = config[key];
  });
  return result;
};

config.setClientSideConfig = (clientSideConfig) => {
  // Merge in the client side config
  _.merge(config, clientSideConfig);
};

config.reload = () => {
  const fs = require('fs');
  // Check pre-conditions
  if(!config.customizationPath) {
    throw new Error('Call setCustomizationPath before re-loading');
  }
  let configPath = path.join(config.customizationPath, 'config.js');
  if(!fs.existsSync(configPath)) {
    throw new Error('Expected a configuration here: ', configPath);
  }
  // Invalidate the require cache (if any)
  Object.keys(require.cache).forEach(p => {
    if(p.indexOf(path.join(config.customizationPath, 'config')) !== -1) {
      delete require.cache[p];
    }
  });
  // Require the customization's configuration
  let customizationConfig = require(configPath);
  // Merge the existing config with defaults and customization's config
  _.merge(config, defaults, customizationConfig);
  // Override anything
  override(config);
};

module.exports = config;
