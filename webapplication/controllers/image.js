'use strict';

const assert = require('assert');

const config = require('../lib/config');
const proxy = require('./image__proxy');

assert.ok(config.cip, 'Missing config.cip');
assert.ok(config.cip.proxy, 'Missing config.cip.proxy');
const includeSessionId = config.cip.proxy.includeSessionId ? true : false;

exports.proxy = proxy;

/**
 * Proxies a request to the image backend that will return a stream with a
 * download of the image in a large size.
 * id is the entire id (Catalog alias / asset id), ex DNT/123
 * size is a parameter that
 * next is a callback method for potential errors
 */
exports.proxyDownload = (id, size, range = false) => {
  let url = '/asset/download/' + id;
  const option = config.downloadOptions[size];
  assert(option, 'Expected value for "' + size + '" in config.downloadOptions');

  if (typeof(option.cumulus) === 'string') {
    url += '?options=' + option.cumulus;
  } else if (typeof(option.cumulus) === 'object') {
    url += '?options=' + JSON.stringify(option.cumulus);
  }

  if (range) {
    // Pass on the range-headers from the browser all the way to the backend
    // so that it also gets a range-request.
    return proxy(url, includeSessionId, {range});
  } else {
    return proxy(url, includeSessionId);
  }

};

/**
 * Proxies a request to the image backend that will return a stream with a
 * thumbnail.
 * id is the entire id (Catalog alias / asset id), ex DNT/123
 * next is a callback method for potential errors
 */
exports.proxyThumbnail = (id) => {
  return proxy('/preview/thumbnail/' + id, includeSessionId);
};
