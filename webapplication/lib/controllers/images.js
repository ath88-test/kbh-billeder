'use strict';
const assert = require('assert');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const waterStream = require('water-stream');
const helpers = require('../../../shared/helpers');
const imageController = require('../../controllers/image');
const documentController = require('./document');

// Set the cache ttl from the configuration
waterStream.cached.config({
  stdTTL: (config.cache && config.cache.ttl) || 60 * 5 // Default is five minutes
});

if (config.thumbnailSizes) {
  throw new Error('config.thumbnailSizes changed name to downloadOptions');
}

const THUMBNAIL_SIZE = config.thumbnailSize;

var WATERMARK_BUFFERS = {};
Object.keys(config.watermarks || {}).forEach((catalog) => {
  var path = config.watermarks[catalog];
  WATERMARK_BUFFERS[catalog] = fs.readFileSync(path);
});

const IMAGES_PATH = path.join(config.customizationPath, 'app', 'images');
const SMALL_FALLBACK_PATH = path.join(IMAGES_PATH, 'fallback-small.png');
const LARGE_FALLBACK_PATH = path.join(IMAGES_PATH, 'fallback-large.png');
assert(fs.existsSync(SMALL_FALLBACK_PATH), 'Missing a small fallback image');
assert(fs.existsSync(LARGE_FALLBACK_PATH), 'Missing a large fallback image');

function getErrorPlaceholderStream(size) {
  if (!size || size > THUMBNAIL_SIZE) {
    return fs.createReadStream(LARGE_FALLBACK_PATH);
  } else {
    return fs.createReadStream(SMALL_FALLBACK_PATH);
  }
}

const contentDispositionRegexp = /.*\.([^.]+)$/i;

exports.download = function (req, res) {
  const collection = req.params.collection;
  const id = req.params.id;
  let size = req.params.size || 'original';

  assert(size in config.downloadOptions, 'The size is must be one of ' +
    Object.keys(config.downloadOptions)
    + ' got "' + size + '"');
  const option = config.downloadOptions[size];
  var proxyRequest = imageController.proxyDownload(collection + '/' + id, size);

  res._writeHead = res.writeHead;
  res.writeHead = function (statusCode, reasonPhrase, headers) {
    if (statusCode === 200 && proxyRequest.response) {
      // Reading the file extension from the response from CIP
      var resHeaders = proxyRequest.response.headers || {};
      var contentDisposition = resHeaders['content-disposition'] || '';
      // Determine the file extension extension
      if (contentDisposition) {
        var parts = contentDisposition.match(contentDispositionRegexp);
        var extension;
        if (parts) {
          extension = '.' + parts[1];
        } else {
          extension = '.jpg'; // Default: When the CIP is not responsing
        }
        // Build the filename
        var filename = collection + '-' + id;
        if (option.filenamePrefix) {
          filename += option.filenamePrefix;
        }
        // Generating a new filename adding size if it exists
        filename += extension;
        // Write the header
        res.set('content-disposition', 'attachment; filename=' + filename);
      }
    }
    res._writeHead(statusCode, reasonPhrase, headers);
  };
  let responded = false;
  proxyRequest
    .on('error', err => {
      if(responded) {
        return;
      }
      responded = true;

      try {
        if (err.message === 'ESOCKETTIMEDOUT' && config.imageTimeoutRedirect) {
          // This is a timeout that occurs often when the original file is to large.
          // This redirect can cause issues as it might be run after the response
          // has been sent.
          res.redirect(config.imageTimeoutRedirect);
        } else {
          res.status(500);
          res.type('png');
          getErrorPlaceholderStream().pipe(res);
        }
      } catch (error) {
        // We are not able to send anything back if the res is closed.
        console.warn('Image proxy error: ', error);
      }

    })
    .on('response', function (response) {
      if(responded) {
        return;
      }
      responded = true;

      if (response.statusCode === 200) {
        proxyRequest.pipe(res);
      } else {
        res.status(response.statusCode);
        res.type('png');
        getErrorPlaceholderStream().pipe(res);
      }
    });
};

const POSITION_FUNCTIONS = {
  'middle-center': waterStream.middleCenterPosition,
  'bottom-right': waterStream.bottomRightPosition
};

exports.thumbnail = function (req, res, next) {
  var collection = req.params.collection;
  var id = req.params.id;
  var size = req.params.size ? parseInt(req.params.size, 10) : THUMBNAIL_SIZE;
  var position = req.params.position || 'middle-center';
  if (!(position in POSITION_FUNCTIONS)) {
    throw new Error('Unexpected position function: ' + position);
  }
  const positionFunction = POSITION_FUNCTIONS[position];

  if (config.features.watermarks) {
    documentController.get(req, 'asset').then(function (metadata) {
      const isWatermarkRequired = helpers.isWatermarkRequired(metadata);
      const isLarge = size > THUMBNAIL_SIZE;
      if (isWatermarkRequired && isLarge && collection in WATERMARK_BUFFERS) {
        respond(res, collection, id, next, size, positionFunction, WATERMARK_BUFFERS[collection]);
      } else {
        respond(res, collection, id, next, size, positionFunction, null);
      }
    }).then(null, (err) => {
      console.error(err);
      res.type('png');
      res.status(500);
      getErrorPlaceholderStream(size).pipe(res);
    });
  } else {
    respond(res, collection, id, next, size, positionFunction, null);
  }
};

function respond(res, collection, id, next, size, positionFunction, watermark) {
  const proxyReq = imageController.proxyThumbnail(
    collection + '/' + id, next
  );
  proxyReq
    .on('error', err => {
      console.error(err);
      res.type('png');
      res.status(500);
      getErrorPlaceholderStream(size).pipe(res);
    })
    .on('response', function (response) {
      if (response.statusCode === 200) {
        var t = waterStream.transformation(watermark, size, positionFunction, 0.25);
        if (config.assetCacheExpiration) {
          res.header('Cache-Control', `max-age=${config.assetCacheExpiration}, public`);
        }
        proxyReq.pipe(t).pipe(res);
      } else {
        res.type('png');
        res.status(response.statusCode);
        getErrorPlaceholderStream(size).pipe(res);
      }
    });
}
