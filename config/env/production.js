'use strict';

var _ = require('lodash');
var base = require('./base');

let enforceHttps = true;

if (process.env.ENFORCE_HTTPS === 'false') {
  enforceHttps = false;
}

const production = _.merge({}, base, {
  allowRobots: true,
  auth0: {
    callbackURL:  process.env.AUTH0_CALLBACK_URL || 'https://kbhbilleder.dk/auth/callback',
    clientID: process.env.AUTH0_CLIENT_ID || 'TwmSafM2Tz7YB5ARDA9MmyFh3DKb95cP',
    // Enable required acceptance of terms and services.
    acceptTermsText: base.auth0TermsText,
  },
  cip: {
    baseURL: process.env.CUMULUS_API_URL,
    client: {
      endpoint: process.env.CUMULUS_API_URL,
      logRequests: true
    }
  },
  env: 'production',
  features: {
    feedback: true,
    requireEmailVerification: true,
    sitewidePassword: false,
    users: true,
    magasinMuseum: true,
    oldProfilePage: false
  },
  google: {
    analyticsPropertyID: 'UA-78446616-1'
  },
  host: 'kbhbilleder.dk',
  kbhAccessKey: process.env.KBH_ACCESS_KEY,
  enforceHttps,
});

module.exports = production;
