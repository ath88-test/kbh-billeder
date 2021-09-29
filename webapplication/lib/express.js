'use strict';

var express = require('express');
var morgan = require('morgan');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var path = require('path');
var cors = require('cors');
var config = require('./config');
var pug = require('./pug')(config);

/**
 * Express configuration
 */
module.exports = function(app) {
  app.set('case sensitive routing', true);
  app.use(compression());
  app.use(cors());

  config.appPaths.forEach((appPath) => {
    app.use(express.static(appPath));
  });

  var viewsPaths = config.appPaths.map((p) => {
    return path.normalize(path.join(p, 'views'));
  });

  app.set('views', viewsPaths);
  app.set('view engine', 'pug');
  app.engine('.pug', pug.__express);

  // TODO: Consider if 'dev' is to verbose
  app.use(morgan('dev'));
  app.use(express.urlencoded({
    extended: true
  }));
  app.use(express.json({limit: 1204 * 1204}));
  app.use(cookieParser());
  // If the config host is sat and the requested host does not match, redirect
  app.use((req, res, next) => {
    // Don't redirect if this is a alive-check.
    if (Array.isArray(config.httpWhitelist) &&
        config.httpWhitelist.includes(req.originalUrl)) {
      next();
      return;
    }

    var hostAndPort = req.get('host');
    var redirectHostAndPort = hostAndPort;
    var redirectProto = req.protocol;
    var doRedirect = false;

    // Allow for a intermediate https-terminating proxy.
    var secureHeader = (req.headers['x-forwarded-proto'] === 'https');

    if (config.enforceHttps && (!req.secure && !secureHeader)) {
      redirectProto = 'https';
      doRedirect = true;
      console.log('Http was requested, enforcing https');
    }

    // disabled since application shouldnt care about the domain its served from

    // if (config.host && config.host !== hostAndPort) {
    //   redirectHostAndPort = config.host;
    //   doRedirect = true;
    //   console.log(`Redirecting due to hostname mismatch incoming ${hostAndPort} != ${config.host}`);
    // }

    if (doRedirect) {
      const redirectUrl = redirectProto + '://' + redirectHostAndPort + req.originalUrl;
      console.log(`Redirecting to ${redirectUrl}`);
      res.redirect(301, redirectUrl);
    } else {
      next();
    }
  });

  app.use(function(req, res, next) {
    res.locals.fullPath = req.originalUrl;
    next();
  });
};
