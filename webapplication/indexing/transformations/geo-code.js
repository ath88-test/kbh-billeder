const request = require('request');
const helpers = require('../../../lib/helpers');

const config = require('../../../lib/config');
const API_KEY = config.google.keys.unrestricted;

const querystring = require('querystring');

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

module.exports = (metadata, context) => {
  const enabled = context.geocoding && context.geocoding.enabled;
  const forced = context.geocoding && context.geocoding.forced;

  const hasApproximateLocation = !!metadata.google_maps_coordinates_approximate;
  const needsGeocoding = !hasApproximateLocation || forced;

  if(enabled && API_KEY && metadata.street_name && needsGeocoding) {
    const address = helpers.geoTagging.getAddress(metadata);
    const query = querystring.stringify({
      address: address,
      key: API_KEY
    });

    const url = GEOCODING_URL + '?' + query;

    return new Promise((resolve, reject) => {
      request({
        url: url,
        json: true
      }, (error, response, body) => {
        if(error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    }).then(response => {
      if(response.results && response.results.length > 0) {
        const result = response.results[0];
        return result.geometry.location;
      } else {
        return null;
      }
    }).then(location => {
      if(location) {
        metadata.google_maps_coordinates_approximate = [
          location.lat,
          location.lng
        ].join(', ');
      }
      return metadata;
    }).then(metadata => {
      // Save these new approximate coordinates to the CIP.
      const coordinates = metadata.google_maps_coordinates_approximate;
      if(coordinates) {
        // Persist the coordinates in Cumulus
        context.persist('google_maps_coordinates_approximate', coordinates);
      }
      return metadata;
    });
  } else if(enabled && !API_KEY) {
    console.log('A Google Maps API key is required to geocode.');
    return metadata;
  } else if(enabled && hasApproximateLocation) {
    // Skipping geocoding, as the approximate location was sat
    return metadata;
  } else {
    return metadata;
  }
}
