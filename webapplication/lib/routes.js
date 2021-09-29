'use strict';

const search = require('./controllers/search');
const api = require('./controllers/api');
const json = require('./controllers/json');
const sitemap = require('./controllers/sitemap');
const robots = require('./controllers/robots');
const motifTagging = require('./controllers/motif-tagging');
const index = require('./controllers/index');
const doc = require('./controllers/document');
const series = require('./controllers/series');
const config = require('./config');
const indexing = require('../controllers/indexing');
const users = require('../controllers/users');
const keystonePlugin = require('../keystone');
const authPlugin = require('../auth');

/**
 * Application routes
 */
module.exports = function(app) {
  app.post('/index/asset', indexing.asset);
  app.get('/healthz', (req, res) => { res.send('ok'); });
  // Setup an API endpoint for fetching contributions. We expect a asset type
  // and a numeric page-number.
  app.get('/min-side/contributions/:assetType/:pageNo(\\d+)', users.fetchUserContributions);

  keystonePlugin.registerRoutes(app);
  authPlugin.registerRoutes(app);

  // Indexing endpoints
  app.get('/index/recent', (req, res) => {
    if (config.kbhAccessKey && req.query.accesskey !== config.kbhAccessKey) {
      res.status(401);
      return res.send('Accesskey required.');
    }

    indexing({
      mode: 'recent',
      reference: req.query.timeframe
    });
    return res.send('Indexing of recent assets started.');
  });

  app.get('/index/all', (req, res) => {
    if (config.kbhAccessKey && req.query.accesskey !== config.kbhAccessKey) {
      res.status(401);
      return res.send('Accesskey required.');
    }

    indexing({mode: 'all'});
    return res.send('Full reindexing started.');
  });

  app.use('/was',
    (req, res) => res.redirect('https://www.was.digst.dk/kbhbilleder-dk')
  );

  // Static urls
  app.route('/suggest.json').get(json.suggest);
  app.route('/robots.txt').get(robots.robotsTxt);
  app.route('/sitemap.xml').get(sitemap.index);

  // A safe proxy for the elastic search index.
  app.get('/api', api.index);
  app.route('/api/*').get(api.proxy).post(api.proxy);

  // Do pretty redirects, to aviod breaking old links to the site
  app.route('/').get(search.redirect).get(index.frontpage);

  // Search results
  app.route('/' + encodeURIComponent(config.search.path))
    .get(search.clientSideResult);

  app.route('/:catalog/sitemap.xml').get(sitemap.catalog);

  // Add a router for series
  app.get('/:seriesUrl', series.get);

  // Register a router for every type
  const types = Object.keys(config.types);
  types.forEach((type) => {
    // Register all routes related to the particular type
    const router = require('../' + config.types[type].router);
    // Register the types router on the app
    let path;
    if(types.length > 1) {
      path = '/:collection([a-zA-Z\-]+)/' + type + '/:id(\\d+)';
    } else {
      path = '/:collection([a-zA-Z\-]+)/:id(\\d+)';
    }
    app.use(path, router);
    // Allowing a /json call that returns raw json
    app.get(path + '/json', (req, res, next) => {
      return doc.json(req, type).then((response) => {
        res.json(response);
      }, next);
    });
  });

  if(config.features.motifTagging) {
    app.route('/motif-tag-suggestions').get(motifTagging.typeaheadSuggestions);
  }
};
