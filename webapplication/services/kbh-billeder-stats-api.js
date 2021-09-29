'use strict';
const request = require('request');
const config = require('../../shared/config');
const assert = require('assert');
const mailgun = require('../lib/services/mailgun');
const _ = require('lodash');
const NodeCache = require('node-cache');

// Pull in configuration and verify that all required values are present.
const {baseUrl, cacheTTL, cacheTTLCheck} = config.kbhBillederStatsApi;
const {fallbackEmailTo, fallbackEmailFrom} = config.email;
assert.ok(baseUrl, 'KBH Billeder stat api url');
assert.ok(fallbackEmailTo, 'Fallback email to undefined');
assert.ok(fallbackEmailFrom, 'Fallback email from undefined');

const responsecache = new NodeCache({stdTTL: cacheTTL, checkperiod: cacheTTLCheck});

// Setup urls for each endpoint.
const URL_TAGS = baseUrl + '/tags';
const URL_TAGSCOUNT = baseUrl + '/tags/count';
const URL_ASSETSCOUNT = baseUrl + '/assets/count';
const URL_GEOLOCATIONS = baseUrl + '/geolocations';
const URL_USERS_POINTS = baseUrl + '/users/points';
const URL_USERS = baseUrl + '/users';

/**
 * User stat api integration.
 *
 * See https://app.swaggerhub.com/apis/stumpdk/kbhbilleder-stats/1.1.0 for
 * documentation
 */
const kbhStatsApi = {
  // Current score for the user.
  userPoints: function(id) {
    return this._doGet(`${URL_USERS}/${id}/points`).then(result => {
      return result.points;
    });
  },

  /**
   * Fetches a list of assets the user has contributed to.
   *
   * @param id
   *   ID of the user.
   *
   * @param type
   *   geolocation or tag
   *
   * @param page
   *   Which page to fetch, 1-indexed.
   *
   * @param pageSize
   *   Size of the page to fetch.
   */
  userContributions: function(id, type, page = 1, pageSize = config.search.contributionsPageSize) {
    const parameters = {
      type: type,
      page: page,
      limit: pageSize
    };

    // Url syntax.
    // users/{id}/assets?type=<tag|geolocation>&page=<1...>&limit=<page size>
    return this
      ._doGet(`${URL_USERS}/${id}/assets`, parameters)
      .then(
        function (result) {
          return result;
        }
        , err => {
          return [];
        }
      );
  },

  // Number of tags on assets.
  // Expected response structure:
  // {
  //   "geolocations": {
  //     "geolocations": 1,
  //     "assets": 1
  //   },
  //   "tags": {
  //     "tags": 9,
  //     "assets": 9
  //   },
  //   "totalAssets": 10
  // }
  userStats: function(id) {
    // Path: /users/{id}
    return this._doGet(URL_USERS + '/' + id).then(function(result) {
      // We go a bit defensive and ensure that the entrie structure is always
      // returned.
      return {
        geolocations: {
          geolocations: (result.geolocations && result.geolocations.geolocations) || 0,
          assets: (result.geolocations && result.geolocations.assets) || 0,
        },
        tags: {
          tags: (result.tags && result.tags.tags) || 0,
          assets:  (result.tags && result.tags.assets) || 0,
        },
        totalAssets: result.totalAssets || 0,
      };
    });
  },

  allUsersPoints: function(timespan = 'all', limit = 10) {
    return this._doGet(URL_USERS_POINTS, {'timespan': timespan, 'limit': limit}).then((data) => {
      return _.chain(data).sortBy('points').reverse().value();
    }, () => {return []});
  },

  // Returns a promise that resolves to the count of tags.
  motifTagsCount: function(timespan = 'all') {
    return this
      ._doGet(URL_TAGSCOUNT, {'type': 'tag', 'timespan': timespan})
      .then(
        // Return the count if we got it, if not return 0.
        (data) => {
          return data.tags;
        }, () => { return 0; }
      );
  },

  // Returns a promise that resolves to the count of geotags.
  geoTagsCount: function(timespan = 'all') {
    return this
      ._doGet(URL_TAGSCOUNT, {'type': 'geolocation', 'timespan': timespan})
      .then(
        // Return the count if we got it, if not return 0.
        (data) => {
          return data.geolocations;
        }, () => { return 0; }
      );
  },

  // Returns a promise that resolves to the count images that has tags.
  assetTagsCount: function(timespan = 'all') {
    return this
      ._doGet(URL_ASSETSCOUNT, {'type': 'tags', 'timespan': timespan})
      .then(
        // Return the count if we got it, if not return 0.
        (data) => {
          return data.count;
        }, () => { return 0; }
      );
  },

  // Store a user-submitted geotag.
  saveGeoTag: function(metadata) {
    const id = metadata.id;
    const collection = metadata.collection;
    const assetId = collection + '-' + id;
    const userId = metadata.userId;
    const latitude = metadata.latitude;
    const longitude = metadata.longitude;
    const heading = metadata.heading;

    return this._doPost(URL_GEOLOCATIONS, {
      'user_id': userId,
      'asset_id': assetId,
      'geolocation': {
        'latitude': latitude,
        'longitude': longitude,
        'direction': heading
      }
    }).then(() => {
      // Log success.
      console.log('Reported geotag on asset ' + assetId + ' for user ' + userId);
      // Successive entries in the promise-chain expects the metadata to passed
      // along.
      return metadata;
    }, () => {
      // Log error.
      console.error('Error while reporting geotag on asset ' + assetId + ' for user ' + userId);
    });
  },

  // Store a number of tags for a user on a asset.
  saveTags: function({id, collection, userTags, userId}) {
    const assetId = collection + '-' + id;
    return this._doPost(URL_TAGS, {
      'user_id': userId,
      'asset_id': assetId,
      'tags': userTags,
    }).then(() => {
      // Log success.
      console.log('Reported ' + userTags.length + ' tags on asset ' + assetId + ' for user ' + userId);
    }, () => {
      // Log error.
      console.error('Error while reporting ' + userTags.length + ' tags on asset ' + assetId + ' for user ' + userId);
    });
  },

  // Perform a GET request, returns a promise.
  _doGet: function(url, parameters = {})  {
    return new Promise((resolve, reject) => {
      const cacheKey = url + JSON.stringify(parameters);
      const cachedResponse = responsecache.get(cacheKey);
      if (cachedResponse !== undefined) {
        resolve(cachedResponse);
      } else {
        const callback = (error, response, body) => {
          if (error || (response.statusCode < 200 || response.statusCode > 299)) {
            let errorString = 'Failed call to API ';
            if (error) {
              errorString += error + ' ';
            }
            if (response && response.statusCode) {
              errorString += response.statusCode + ' ';
            }
            if (response && response.statusMessage) {
              errorString += response.statusMessage;
            }
            console.warn('Failed call to API ' + url);
            console.warn('Error: ' + errorString);
            response && console.warn('Response: ');
            response && console.log(response);
            reject(errorString);
          } else {
            try{
              const parsedBody = JSON.parse(body);
              responsecache.set(cacheKey, parsedBody);
              resolve(parsedBody);
            }
            catch(err) {
              console.warn("Unable to parse following response from kbh api: \n" + body);
              console.log(response);
              reject(err.message);
            }
          }
        };
        request(
          {
            'url': url,
            'qs': parameters,
          }, callback
        );

      }
    });
  },

  // Perform a POST request, returns a promise.
  _doPost: function(url, object)  {
    return new Promise((resolve, reject) => {
      console.log('Posting to ' + url);
      request.post(url, {body: object, json: true}, (error, response, body) => {
        if (error || (response.statusCode < 200 || response.statusCode > 299)) {
          const payload = JSON.stringify(object);
          const errorString = response.statusCode + ': ' + response.statusMessage;

          // Log the error.
          console.warn('Failed call to API ' + url);
          console.warn('Error: ' + errorString);
          console.warn('Payload: \n' + payload);

          // Send an error-mail.
          let mailBody = '';
          mailBody += 'Endpoint: ' + url + '<br>--<br>';
          mailBody += 'Response: ' + errorString + '<br>--<br>';
          mailBody += 'Response body: <br>' + body + '<br>--<br>';
          mailBody += 'Attempted Payload:<br>' + payload + '<br>--<br>';

          mailgun.sendMessage(fallbackEmailFrom, fallbackEmailTo, 'Failed API Request', mailBody);
          reject(response.statusMessage, body);
        } else {
          resolve(response, body);
        }
      });
    });
  },
};

// Perform an initial request to ensure we have connectivity.
kbhStatsApi.allUsersPoints().then(() => {
  console.log('API connectivity OK');
}, (err) => {
  console.log('Could not connect to the KBH Billeder Stats API error: ' + err);
});

module.exports = kbhStatsApi;
