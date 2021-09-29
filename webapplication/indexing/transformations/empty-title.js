'use strict';

module.exports = metadata => {
  metadata.short_title = (metadata.short_title || '').trim();
  if (metadata.short_title === '') {
    metadata.short_title = null;
  }
  return metadata;
};
