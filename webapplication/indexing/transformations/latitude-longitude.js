'use strict';

module.exports = metadata => {
  var coordinates;

  if (metadata.google_maps_coordinates) {
    coordinates = metadata.google_maps_coordinates;
    metadata.location_is_approximate = false;
  } else if (metadata.google_maps_coordinates_crowd) {
    coordinates = metadata.google_maps_coordinates_crowd;
    metadata.location_is_approximate = false;
  } else if (metadata.google_maps_coordinates_approximate) {
    coordinates = metadata.google_maps_coordinates_approximate;
    metadata.location_is_approximate = true;
  }
  if (coordinates) {
    coordinates = coordinates.split(',').map(parseFloat);
    if (coordinates.length >= 2) {
      metadata.latitude = coordinates[0];
      metadata.longitude = coordinates[1];
    } else {
      throw new Error('Encountered unexpected coordinate format.');
    }
  }
  // Index into
  if (metadata.latitude && metadata.longitude) {
    metadata.location = {
      "lat": metadata.latitude,
      "lon": metadata.longitude
    }
  }

  return metadata;
};
