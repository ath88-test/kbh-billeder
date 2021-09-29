const kbhStatsApi = require('../services/kbh-billeder-stats-api');
const config = require('../../shared/config');
const _ = require('lodash');
const helpers = require('../../shared/helpers');

exports.renderProfile = async (req, res) => {
  // Redirect to front-page if the user is not authorized.
  if (!req.user) {
    res.redirect('/');
    return;
  }

  const {user} = req;

  let points = kbhStatsApi.userPoints(user.id);
  let stats = kbhStatsApi.userStats(user.id);

  try {
    [points, stats] = [await points, await stats];
  } catch(err) {
    console.log(err);
  }

  res.render('profile' + (config.features.oldProfilePage ? '' : '2'), {points, stats, user});
};

exports.renderEditProfile = async (req, res) => {
  const {user} = req;
  let auth0User = user.provider === 'auth0';
  res.render('edit-profile', {user, auth0User, error: req.session.error, status: req.session.status});
  delete req.session.error;
  delete req.session.status;
  res.render('profile' + (config.features.oldProfilePage ? '' : '2'), {user});
};

/**
 * Callback for fetching user contributions.
 */
exports.fetchUserContributions = async (req, res, next) => {
  // We have to require the document service late as it is loaded later than
  // the controller.
  const ds = require('../lib/services/elasticsearch');

  // Only process requests from logged in users.
  if (!req.user) {
    res.sendStatus(401);
    return;
  }

  // Get all parameters we'll need and validate them.
  const {user} = req;
  // The API uses gelocation and not location, but the UI users "location", so
  // we translate before going to the API.
  const assetType = req.params.assetType === 'location' ? 'geolocation' : 'tag';
  const pageNo = req.params.pageNo;

  if (['geolocation', 'tag'].indexOf(assetType) === -1) {
    next(new Error('Invalid asset-type'));
    return;
  }

  try {
    // Fetch the list of user-contributions.
    let contributions = await kbhStatsApi.userContributions(
      user.id, assetType, pageNo
    );
    // Return an empty list if we could not find any contributions.
    if (contributions.length === 0) {
      res.json([]);
      return;
    }

    // Extract the ids of the assets and fetch the data we need from ES.
    const ids = contributions.map(contribution => contribution.asset_id);
    const queryObject = {
      type: 'asset',
      _source: ['collection', 'id', 'short_title', 'type', 'description'],
      body: {
        ids: ids
      }
    };
    const loadedContributions = await ds.mget(queryObject).then(response => {
      // Extract the metadata for all related docs that was found
      return response.docs
      // Only show documents we could actually look up.
        .filter(doc => doc.found)
        .map(doc => {
          const contribution = doc._source;
          // Add in the contribution time from our original fetch of
          // contributions.
          const original = contributions.find(c => c.asset_id === doc._id);
          contribution.contribution_time = original.updated;
          contribution.formatted_date = helpers.formatDate(contribution.contribution_time);
          return contribution;
        });
    });
    res.json(loadedContributions);
  }
  catch(err) {
    console.log(err);
    next(new Error('Error occured while fetching contributions'));
  }
};
