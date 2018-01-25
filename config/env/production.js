'use strict';

var _ = require('lodash');
var base = require('./base');

const production = _.merge({}, base, {
  allowRobots: true,
  auth0: {
    callbackURL: 'https://kbhbilleder.dk/auth/callback',
    clientID: 'TwmSafM2Tz7YB5ARDA9MmyFh3DKb95cP',
    // Enable required acceptance of terms and services.
    acceptTermsText: base.auth0TermsText,
  },
  cip: {
    client: {
      logRequests: true
    }
  },
  env: 'production',
  features: {
    feedback: true,
    geoTagging: true,
    motifTagging: true,
    requireEmailVerification: true,
    sitewidePassword: false,
    users: true
  },
  google: {
    analyticsPropertyID: 'UA-78446616-1'
  },
  host: 'kbhbilleder.dk',
  enforceHttps: true,
  ip: null,
  port: null,
  socketPath: '/tmp/kbh-billeder.sock'
});

module.exports = production;
