'use strict';

const union = require('lodash/union');
const cip = require('../../services/cip');
const motifTagController = require('../../../controllers/motif-tagging');

module.exports = (metadata, context) => {
  // Let's save some cost and bandwidth and not analyze the asset unless
  // explicitly told. As in run only if one of the indexVison args
  // are specified.
  const enabled = context.vision && context.vision.enabled;
  const forced = context.vision && context.vision.forced;

  if (enabled) {
    // Convert tags to a comma seperated string
    if (!Array.isArray(metadata.tags_vision)) {
      metadata.tags_vision = [];
    }

    if(metadata.tags_vision.length > 0 && !forced) {
      console.log('Asset has vision tags, skipping it');
      return metadata;
    } else if (metadata.tags_vision.length > 0) {
      console.log('Asset has vision tags, but we´re forced');
    }

    // Still here. Let's grab the image directly from Cumulus.
    let path = 'preview/thumbnail/' + metadata.collection + '/' + metadata.id;
    let url = cip.generateURL(path);

    // Loading here to prevent circular dependency.
    var motif = require('../../../lib/controllers/motif-tagging');

    return motif.fetchSuggestions(url)
    .then(tags => {
      // Hang on to the tags prior to this run
      const tagsBefore = metadata.tags_vision;
      // Override the tags with the new suggestions
      metadata.tags_vision = union(metadata.tags_vision, tags);
      // Calculate the numberOfNewTags
      const numberOfNewTags = metadata.tags_vision.length - tagsBefore.length;

      // If no new tags was added, we don't save
      if (numberOfNewTags === 0) {
        console.log('No new tags found, let´s not save to the CIP.',
                    'Now the asset has', metadata.tags_vision.length, 'tags');
        return metadata;
      } else {
        console.log('Derived', numberOfNewTags, 'new tags.',
                    'Now the asset has', metadata.tags_vision.length, 'tags');
        // TODO: Move the saving to ../processing/result.js
        return motifTagController.save(metadata, {
          tags_vision: metadata.tags_vision
        })
        .then(response => {
          return metadata;
        });
      }
    });
  }
  return metadata;
};
