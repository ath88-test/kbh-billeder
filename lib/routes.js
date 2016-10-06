'use strict';

var asset = require('./controllers/asset');
var images = require('./controllers/images');
var search = require('./controllers/search');
var api = require('./controllers/api');
var json = require('./controllers/json');
var sitemap = require('./controllers/sitemap');
var robots = require('./controllers/robots');
var elasticsearch = require('./controllers/elasticsearch');
var geoTagging = require('./controllers/geo-tagging');
var motifTagging = require('./controllers/motif-tagging');
var index = require('./controllers/index');
var config = require('./config');

/**
 * Application routes
 */
module.exports = function(app) {
  // Static urls
  app.route('/suggest.json').get(json.suggest);
  app.route('/robots.txt').get(robots.robotsTxt);
  app.route('/sitemap.xml').get(sitemap.index);

  // Get the catalogs for the main menu
  app.route('/catalogs').get(search.mainmenu);
  app.route('/motif-tag-suggestions').get(motifTagging.typeaheadSuggestions);

  app.route('/index/asset').post(index.asset);
  
  // A safe proxy for the elastic search index.
  app.get('/api', api.index);
  app.route('/api/*')
    .get(elasticsearch.proxy)
    .post(elasticsearch.proxy);

  // Do pretty redirects, to aviod breaking old links to the site
  app.route('/').get(search.redirect);
  app.route('/:catalog').get(search.redirect);

  // Search results
  app.route('/').get(index.frontpage);

  var searchRoute = app.route('/' + encodeURIComponent(config.searchPath));
  if(config.features.clientSideSearchResultRendering) {
    searchRoute.get(search.clientSideResult);
  } else {
    searchRoute.get(search.result);
  }

  app.route('/:catalog/infinite').get(search.infinite);
  app.route('/:catalog/sitemap.xml').get(sitemap.catalog);

  // Tags
  app.route('/:catalog/:id(\\d+)/suggested-motif-tags')
    .get(motifTagging.suggestions);
  app.route('/:catalog/:id(\\d+)/save-crowd-tag')
    .post(motifTagging.saveCrowdTag);
  // Image handling
  app.route('/:catalog/:id(\\d+)/download/:size/:filename')
    .get(images.downloadImage);
  app.route('/:catalog/:id(\\d+)/download/:filename').get(images.download);

  app.route('/:catalog/:id(\\d+)/image/:size').get(images.image);
  app.route('/:catalog/:id(\\d+)/thumbnail').get(images.thumbnail);
  app.route('/:catalog/:id(\\d+)').get(asset.index);

  app.route('/:catalog/:id(\\d+)/save-geotag').post(geoTagging.save);
};