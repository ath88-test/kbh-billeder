'use strict';
const imageController = require('../../controllers/image');

/**
 * A simplified controller that does not assume we're streaming an image but supports HTTP 206
 *
 * @param req
 * @param res
 * @param next
 */
exports.stream = function (req, res, next) {
  const collection = req.params.collection;
  const id = req.params.id;

  let size = 'original';

  // The request against the backend system.
  var proxyRequest;
  const range = req.headers.range;
  if (range) {
    proxyRequest = imageController.proxyDownload(collection + '/' + id, size, range);
  } else {
    proxyRequest = imageController.proxyDownload(collection + '/' + id, size);
  }

  proxyRequest
    .on('error', function (error) {
      // We can't assume that it's ok to reply with eg. an error-image, so we
      // just close the connection.
      res.end();
    })
    .on('response', function (response) {
      // Handle normal GET as well as partials.
      if (response.statusCode === 200 || response.statusCode === 206) {
        proxyRequest.pipe(res);
      } else {
        console.error("failed to download image ", response);
        res.status(500).send('Error occured while processing request.');
      }
    });
};
