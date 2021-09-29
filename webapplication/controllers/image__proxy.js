const assert = require('assert');
const config = require('../lib/config');
const cip = require('../services/cip');

assert.ok(config.cip.proxy, 'Missing a config.cip.proxy object');
assert.ok(config.cip.proxy.maxSockets, 'Missing config.cip.proxy.maxSockets');

const Agent = require('agentkeepalive');

let agent;
// Choose a keep-alive agent based on the beginning of the baseUrl
if(config.cip.baseURL.indexOf('https://') === 0) {
  agent = new Agent.HttpsAgent({
    maxSockets: config.cip.proxy.maxSockets
  });
} else {
  agent = new Agent({
    maxSockets: config.cip.proxy.maxSockets
  });
}

var request = require('request').defaults({
  agent,
  timeout: config.cip.timeout || 55000 // 55 secs
});

function proxy(url, includeJSessionId = false, headers = []) {
  // Prefix the baseURL
  url = config.cip.baseURL + url;
  // Add any available jsessionid, just before any querystring.
  if(url.indexOf('jsessionid') < 0 && cip.jsessionid && includeJSessionId) {
    let jsessionidString = ';jsessionid=' + cip.jsessionid;
    let queryStringStart = url.indexOf('?');
    if(queryStringStart < 0) {
      url += jsessionidString;
    } else {
      url = url.substring(0, queryStringStart) +
            jsessionidString +
            url.substring(queryStringStart);
    }
  }
  console.log("config.cip.timeout", config.cip.timeout)
  console.log('CIP proxy is requesting', url);

  const { username, password } = config.cip

  return request
    .get({
      url,
      rejectUnauthorized: config.cip.client.trustSelfSigned ? false : true,
      headers
    })
    .auth(username, password)
    .on('response', function(response) {
      response.headers['Cache-Control'] = 'max-age=2592000';
    });
}

module.exports = proxy;
