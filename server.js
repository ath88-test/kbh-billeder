'use strict';

exports.config = (config) => {
  if(!config) {
    throw new Error('Needed a config object when initializing');
  }
  require('./lib/config').set(config);
};

exports.initialize = (app, config) => {
  if(!app) {
    throw new Error('Needed an Express app when initializing');
  }
  if(config) {
    exports.config(config);
  }

  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  var config = require('./lib/config');

  var cip = require('./lib/services/natmus-cip');
  var es = require('./lib/services/elasticsearch');
  var cipCategories = require('./lib/cip-categories');

  require('./lib/express')(app);

  app.locals.config = config;
  app.locals.helpers = require('./lib/helpers');

  app.set('siteTitle', config.siteTitle);
  // Trust the X-Forwarded-* headers from the Nginx reverse proxy infront of
  // the app (See http://expressjs.com/api.html#app.set)
  app.set('trust proxy', 'loopback');

  require('./lib/routes')(app);
  require('./lib/errors')(app);

  es.count({
    index: config.esAssetsIndex
  }).then(function(response) {
    console.log('Connecting to the Elasticsearch host', config.esHost);
    console.log('The assets index is created and contains',
                response.count, 'documents.');
  }, function(err) {
    if(err.status === 404) {
      console.error('Missing the Elasticsearch index: ' + config.esAssetsIndex);
    } else {
      console.error('Could not connect to the Elasticsearch:',
                    'Is the elasticsearch service started?');
    }
    process.exit(1);
  });

  function startServer() {
    // Start server
    app.listen(config.port, config.ip, function() {
      console.log('Express server listening on %s:%d, in %s mode',
                  config.ip, config.port, app.get('env'));
    });
  }

  if (config.cip.username && config.cip.password) {
    require('./lib/cip-categories').initialize(app).then(startServer, (err) => {
      console.error('Error when starting the app: ', err.stack);
      system.exit(2);
    });
  } else {
    startServer();
  }
};

exports.indexing = (state, config) => {
  if(config) {
    exports.config(config);
  }
  return require('./indexing/run')(state);
};
