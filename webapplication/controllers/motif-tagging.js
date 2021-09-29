'use strict';
const _ = require('lodash');
const assert = require('assert');
const config = require('../lib/config');
const cip = require('../services/cip');
const kbhStatsApi = require('../services/kbh-billeder-stats-api');
const indexController = require('./indexing');

const USER_FIELD = config.motifTagging && config.motifTagging.userField;
const VISION_FIELD = config.motifTagging && config.motifTagging.visionField;

if(config.features.motifTagging) {
  assert.ok(USER_FIELD, 'Missing a config.motifTagging.userField');
  assert.ok(VISION_FIELD, 'Missing a config.motifTagging.visionField');
}

const motifTagging = {
  save: ({id, collection, userTags, visionTags, userId}) => {
    assert.ok(collection, 'Missing the collection');
    assert.ok(id, 'Missing an asset id');

    // Save it using the CIP
    var values = {};

    if(Array.isArray(userTags)) {
      values[USER_FIELD] = userTags.join(',');
    }

    if(Array.isArray(visionTags)) {
      values[VISION_FIELD] = visionTags.join(',');
    }

    // Set the field values via the CIP
    return cip.setFieldValues(collection, id, values)
      .then(function(response) {
        if (response.statusCode !== 200) {
          throw new Error('Failed to set the field values');
        }
        return response;
      })
      .then(function() {
        // Pass the same arguments to our save.
        kbhStatsApi.saveTags({
          collection, id, userTags, visionTags, userId
        });

        //TODO: is it intentional that we no longer return a response?
      });
  },
  updateIndex: metadata => {
    return indexController.updateAsset(metadata.collection, metadata.id)
      .then(response => ({
        collection: metadata.collection,
        id: metadata.id,
        tags_vision: metadata.visionTags,
        tags: metadata.userTags,
      }));
  },
  updateIndexFromData: metadata => {
    return indexController.updateAssetsFromData(metadata)
      .then(response => metadata);
  },
  typeaheadSuggestions: text => {
    // The document service might be registered after this motif tagging service
    const ds = require('../lib/services/elasticsearch');
    // Search for distinct tags in all relevant fields
    return ds.search({
      size: 0,
      body: {
        aggs: {
          tags: {
            terms: {
              'field': 'tags.keyword',
              'include': text + '.*'
            }
          },
          tags_vision: {
            terms: {
              'field': 'tags_vision.keyword',
              'include': text + '.*'
            }
          }
        }
      }
    }).then(response => {
      // Concatenate all the aggregated tags
      let tags = _.concat(
        response.aggregations.tags.buckets,
        response.aggregations.tags_vision.buckets
      ).map(bucket => bucket.key);
      // Sort, putting the most popular on top
      tags.sort(function(tagA, tagB) {
        return tagB.doc_count - tagA.doc_count;
      }).map(function(tag) {
        return tag.key;
      });
      // Remove duplicates
      return _.uniq(tags);
    });
  }
};

module.exports = motifTagging;
