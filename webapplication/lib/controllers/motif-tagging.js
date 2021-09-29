'use strict';

const _ = require('lodash');
const Q = require('q');
const request = require('request');

const config = require('../config');
const ds = require('../services/elasticsearch');
const helpers = require('../../../shared/helpers');
const errorReporter = require('../services/error-reporter');
const motifTagController = require('../../controllers/motif-tagging');

let google;
let vision;
let translate;

if (config.features.enableGoogleTranslate || config.features.enableVisionTagSuggestions) {
  google = require('../services/google-apis');
}

if (config.features.enableVisionTagSuggestions) {
  vision = google.vision;
}

if (config.features.enableGoogleTranslate) {
  translate = google.translate;
}

const MAX_GOOGLE_SUGGESTIONS = 10;

function getImageBuffer(imageURL) {
  return new Promise((resolve, reject) => {
    request
      .get(imageURL, {
        rejectUnauthorized: false,
        encoding: null
      }, function (error, response, body) {
        if(error) {
          reject(error);
        } else if(response.statusCode === 200) {
          resolve(body);
        } else {
          reject(new Error('Unexpected status code ' + response.statusCode));
        }
      });
  });
}

function googleSuggestions(imageURL) {
  if (!config.features.enableVisionTagSuggestions) {
    return Promise.resolve([]);
  }

  return getImageBuffer(imageURL)
  .then((content) => {
    // construct parameters
    const apiReq = {
      image: {
        content
      },
      features: [
        {type: 'LABEL_DETECTION', maxResults: MAX_GOOGLE_SUGGESTIONS},
        {type: 'LANDMARK_DETECTION', maxResults: MAX_GOOGLE_SUGGESTIONS}
      ]
    };

    // Get labels
    return vision.annotate(apiReq).then(function(response) {
      const annotations = response[0];
      const apiResponse = response[1];

      // Throw any errors
      apiResponse.responses.forEach(response => {
        if(response.error) {
          console.log(imageURL);
          throw new Error(response.error.message);
        }
      });

      // Extract the labels and landmarks
      var labels = annotations[0].labelAnnotations || [];
      var landmarks = annotations[0].landmarkAnnotations || [];

      labels = labels.map(function(label) {
        return label.description;
      });

      landmarks = landmarks.map(function(landmark) {
        return landmark.description;
      });

      return _.union(labels, landmarks);
    });
  });
}

/**
 * Fetch the list of suggested tags
 * @param imageUrl string of an absolute public URL to the image
 **/
function fetchSuggestions(imageUrl) {
  if (!config.features.enableVisionTagSuggestions) {
    return Promise.resolve([]);
  }

  return googleSuggestions(imageUrl)
  .then(function(suggestedTags) {
    var deferred = Q.defer();
    var tags = _.union.apply(null, suggestedTags).filter(function(tag) {
      return !!tag; // Filter out undefined, null and ''
    });

    if (tags.length === 0 || !config.features.enableGoogleTranslate) {
      deferred.resolve();
    } else {
      translate.translate(tags, {
        from: 'en',
        to: 'da'
      }, function(err, translations) {
        if (err) {
          deferred.reject(err);
        } else {
          // The translation API returns a single value without an array
          // wrapping when a single word is sent to it.
          if (!Array.isArray(translations)) {
            translations = [translations];
          }
          translations = translations.map(function(translation) {
            // Convert the translated tag to lowercase
            return translation.toLowerCase();
          }).filter(function(tag) {
            // Filter out blacklisted tags
            return config.tagsBlacklist.indexOf(tag) === -1;
          }).sort();
          deferred.resolve(_.uniq(translations));
        }
      });
    }

    return deferred.promise;
  });
}

exports.fetchSuggestions = fetchSuggestions;

exports.suggestions = function(req, res, next) {
  var collection = req.params.collection;
  var id = req.params.id;
  var url = config.cip.baseURL + '/preview/thumbnail/' + collection + '/' + id;

  fetchSuggestions(url).then(function(tags) {
    res.json({
      'tags': tags
    });
  }, next);
};

// TODO: Implement a different way of saving tags which fetch the document first
exports.save = function(req, res, next) {
  const collection = req.params.collection;
  const id = req.params.id;
  const metadata = req.body;
  const userId = req.user.id;

  const userTags = helpers.motifTagging.getTags(metadata) || [];
  const visionTags = helpers.motifTagging.getVisionTags(metadata) || [];
  const verifiedTags = helpers.motifTagging.getVerifiedTags(metadata) || [];  
  const assetIdentifier = collection + '-' + id;

  // Object we're going to send to Cumulus via CIP.
  const cipObject = {collection, id, userTags, visionTags, userId};

  // The object we're going to index into ES and echo back to the user, notice
  // naming difference.
  const esObject = {
    collection: cipObject.collection,
    id: cipObject.id,
    tags_vision: visionTags,
    tags: userTags,
    tags_verified: verifiedTags
  };

  // Initiate our own update of the ES, as soon as the update is performed,
  // echo the update back to the user.
  const updateTag = motifTagController.updateIndexFromData(esObject).then(
    () => {
      console.log(`Successful reindex of ${assetIdentifier} after user submission`);
      res.json(esObject);
    },
    (error) => {
      console.warn(`Unable to reindex ${assetIdentifier} after user submission - reindex required`);
      throw error;
    }
  );

  // Initiate update of Cumulus.
  const updateBackend = motifTagController.save(cipObject).then(
    () => {
      console.log(`Sucessfully sent updated tags for ${assetIdentifier} to CIP`);
    },
    (error) => {
      const message = `Unable to send motif tags for ${assetIdentifier} to CIP - Elastic Search out of sync! ${error.message}`;
      console.warn(`${message} (${JSON.stringify(cipObject)}`);
      errorReporter.sendReport('Motif tagging', message, cipObject);
      throw error;
    }
  );

  // Report if an error occured, and attempt to give the browser a usable reply.
  Promise.all([updateTag, updateBackend])
    .catch(
      (error) => {
        console.warn(`Parallel update of ${assetIdentifier} in ES and CIP failed`);
        console.warn(error);

        // Attempt to fetch document again an pass the original metadata back.
        ds.getSource({
          type: 'asset',
          id: assetIdentifier
        }).then(
          (metadata) => {
            res.json(_.pick(metadata, ['collection', 'id', 'tags_vision', 'tags']));
          }
        );
      }
    );
};

exports.typeaheadSuggestions = function(req, res, next) {
  let text = req.query.text || '';
  text = text.toLowerCase();
  return motifTagController.typeaheadSuggestions(text).then(suggestions => {
    res.json(suggestions);
  }, next);
};
