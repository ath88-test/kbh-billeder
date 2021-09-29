'use strict';

const config = require('../lib/config');

const keystone = require('keystone');
const middleware = require('./middleware');
const csrf = require('csurf');
const path = require('path');

module.exports = {
  initialize: (app) => {
    if(!config.keystone) {
      throw new Error('Missing a keystone object in the configuration');
    }

    // Set up Keystone
    keystone.init(config.keystone.options);

    keystone.set('updates', path.join(__dirname, 'updates'));

    if(config.cloudinaryUrl) {
      keystone.set('wysiwyg cloudinary images', true);
      // Set up cloudinary
      keystone.set('cloudinary config', config.cloudinaryUrl);
      // Prefix all built-in tags with 'keystone_'
      keystone.set('cloudinary prefix', 'keystone');
      // Prefix each image public_id with [{prefix}]/{list.path}/{field.path}/
      keystone.set('cloudinary folders', true);
      // Force cloudinary to serve images over https
      keystone.set('cloudinary secure', true);
    }

    const models = require('./models');
    // Registering models
    Object.keys(models).forEach(modelClass => {
      let model = models[modelClass];
      model.register();
    });

    keystone.initExpressApp(app);

    // Keystone form validation
    app.use('/keystone', csrf());
    app.use('/keystone', function(req, res, next) {
      res.locals.csrftoken = req.csrfToken();
      next();
    });

    keystone.set('nav', config.keystone.nav);
    keystone.openDatabaseConnection(function() {
      require('./menus')(app);
    });

    // Common Middleware
    keystone.pre('routes', middleware.initLocals);

    // Override error handlers - to use collections-online's
    keystone.set('404', (req, res, next) => next());
    keystone.set('500', (err, req, res, next) => next(err));
  },
  registerRoutes: app => {
    // Register the keystone specific routes
    keystone.set('routes', require('./routes')(app));
    // Set the routes for the admin interface
    app.use('/keystone', keystone.Admin.Server.createStaticRouter(keystone));
    app.use('/keystone', keystone.Admin.Server.createDynamicRouter(keystone));
  }
};
