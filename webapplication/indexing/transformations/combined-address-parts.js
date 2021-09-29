'use strict';

module.exports = metadata => {
  // Add combined fields for streetname + street number and zip + city for
  // better search-results when a user searches for eg. "Vesterbrogade 29".
  if (metadata['street_name'] && metadata['street_number']) {
    metadata.combined_street_number = metadata['street_name'] + ' ' + metadata['street_number'];
  }

  if (metadata['zipcode'] && metadata['city']) {
    metadata.combined_zip_city = metadata['zipcode'] + ' ' + metadata['city'];
  }

  return metadata;
};
