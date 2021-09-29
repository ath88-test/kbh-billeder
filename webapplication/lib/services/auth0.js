const Auth0Strategy = require('passport-auth0');
const AuthenticationClient = require('auth0').AuthenticationClient;
const ManagementClient = require('auth0').ManagementClient;

const assert = require('assert');
const config = require('../config');

const schedule = require('node-schedule');
const jwtDecode = require('jwt-decode');

const domain = config.auth0 && config.auth0.domain;
const clientID = config.auth0 && config.auth0.clientID;
const callbackURL = config.auth0 && config.auth0.callbackURL;
const clientSecret = process.env.AUTH0_CLIENT_SECRET;

assert.ok(domain, 'Missing a config.auth0.domain');
assert.ok(clientID, 'Missing a config.auth0.clientID');
assert.ok(callbackURL, 'Missing a config.auth0.callbackURL');
assert.ok(clientSecret, 'Missing a AUTH0_CLIENT_SECRET environment variable');

const Auth = new AuthenticationClient({
  domain,
  clientId: clientID,
  clientSecret
});

const passportConfig = {
  domain,
  clientId: clientID,
  redirectUri: callbackURL,
  responseType: 'code',
  params: {
    scope: 'openid name email picture'
  }
};

let Service;

function getManagementService() {
  return Service;
}

/**
 * Non-async function for triggering the (async) refresh of our auth0 token.
 */
function scheduleRefresh() {
  refreshService();
}

/**
 * Fetch new Auth0 token and schedule a renewal.
 *
 * @returns {Promise<void>}
 */
async function refreshService() {
  try {
    const {service, expiresAt} = await fetchService();

    // Let's let the token live for half of it's duration.
    const currentTime = new Date().getTime();
    const secondsUntilExpiration = expiresAt - currentTime;
    const nextRefreshDate = new Date(currentTime + (secondsUntilExpiration / 2));

    // Reschedule refresh - we have to go via a non-promise callback or else
    // node-schedule will throw an error.
    schedule.scheduleJob(nextRefreshDate, scheduleRefresh);

    Service = service;

    console.log(`Auth0 Service refreshed. Next refesh at ${nextRefreshDate}.`);
  }
  catch (err) {
    console.warn('Unable to refresh token');
    console.log(err.message);
  }
}

function fetchService() {
  return new Promise(async (resolve, reject) => {
    try {
      const {access_token} = await Auth.clientCredentialsGrant({
        audience: `https://${domain}/api/v2/`,
        scope: 'read:users update:users'
      });

      const {exp} = jwtDecode(access_token);

      console.log(`Retrieved Auth0 Token: ${access_token.substring(0,  20)} ...`);

      const service = new ManagementClient({
        token: access_token,
        domain
      });

      resolve({
        service,
        expiresAt: exp * 1000
      });
    }

    catch(err) {
      console.log('We did not recieve an Auth0 Management Token: ' + err.message.error_description);
      reject(err.message);
    }
  });
}

// Trigger the first auth0 token fetch and re-scheduling.
scheduleRefresh();

const strategy = new Auth0Strategy({
  domain, clientID, clientSecret, callbackURL
}, function(accessToken, refreshToken, extraParams, profile, done) {
  // accessToken is the token to call Auth0 API (not needed in the most cases)
  // extraParams.id_token has the JSON Web Token
  // profile has all the information from the user
  return done(null, profile);
});

module.exports = {
  Auth,
  strategy,
  getManagementService,
  passportConfig
};
