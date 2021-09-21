'use strict';

// collections-online server.js
const plugins = require('./pluginController');
const config = require('./collections-online/lib/config');
const promiseRetry = require('promise-retry');

const co = {
  config: (customizationPath) => {
    require('./collections-online/lib/config').setCustomizationPath(customizationPath);
  },
  initialize: (app) => {
    if(!app) {
      throw new Error('Needed an Express app when initializing');
    }
    // Setting the NODE_ENV environment if it's not already sat
    // TODO: Consider removing this
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';

    // After all plugins have initialized, the main server should start
    return plugins.initialize(app).then(() => {
      require('./collections-online/lib/express')(app);

      const ds = require('./collections-online/lib/services/documents');

      app.locals.config = config;
      const helpers = require('./collections-online/lib/helpers');
      helpers.checkRequiredHelpers();
      app.locals.helpers = helpers;

      // Injects an SVG sprite
      app.use(require('./collections-online/lib/middleware/svg-sprite'));

      // Trust the X-Forwarded-* headers from the Nginx reverse proxy infront of
      // the app (See http://expressjs.com/api.html#app.set)
      app.set('trust proxy', 'loopback');

      const indecies = Object.keys(config.types).map((type) => {
        return config.types[type].index;
      });
      return promiseRetry(retry => {
        return ds.count({
          index: indecies,
          body: {
            query: config.search.baseQuery
          }
        })
          .catch(( err ) => {
            console.error('Could not connect to the Elasticsearch:', 'Is the elasticsearch service started?');
            console.error('Retrying elasticsearch');
            retry(err);
          });
      }, {minTimeout: 4000})
        .then(response => {
          console.log('Index exists and has', response.count, 'documents.');
        }, err => {
          console.log('Elasticsearch not found after several attempts.');
          process.exit(1);
        })
        .then(() => {
          console.log('Starting up the server');
          // Start server
          if(config.port && config.ip) {
            app.listen(config.port, config.ip, function() {
              console.log('Express server listening on %s:%d, in %s mode', config.ip, config.port, app.get('env'));
            });
          } else if(config.socketPath) {
            app.listen(config.socketPath, function() {
              console.log('Express server listening on socket %s, in %s mode', config.socketPath, app.get('env'));
            });
          } else {
            throw new Error('Could not start server, needed "port" and "ip" or "socketPath" in the configuration.');
          }
        }, (err) => {
          console.error('Error when starting the app: ', err.stack);
          process.exit(2);
        });
    });
  },
  registerRoutes: app => {
    // Ask plugins to register their routes
    plugins.registerRoutes(app);
    // Register the core collections-online routes
    require('./collections-online/lib/routes')(app);
  },
  registerErrors: (app) => {
    require('./collections-online/lib/errors')(app);
  }
};

module.exports = co;



// kbhbilleder server.js
co.config(__dirname);

// Register collections-online plugins
require('./plugins').register();
