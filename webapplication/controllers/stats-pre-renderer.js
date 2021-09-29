'use strict';
const _ = require('lodash');
const kbhStatsApi = require('../services/kbh-billeder-stats-api');
const auth0 = require('../lib/services/auth0');
const Service = auth0.getManagementService;
const PLACEHOLDER = '{{STAT}}';

const renderer = {
  render: async (next, locals, req) => {
    // Get the current content that is about be rendered.
    let pageContent = _.get(locals, 'data.page.content', '');

    // Bail out if the content does not contain our placeholder.
    if(pageContent.indexOf(PLACEHOLDER) === -1) {
      next();
      return;
    }

    // Prepare promises for all statistics we need.
    let motifTagsCountWeek = kbhStatsApi.motifTagsCount('week');
    let motifTagsCountAll = kbhStatsApi.motifTagsCount('all');
    let geoTagsCountWeek = kbhStatsApi.geoTagsCount('week');
    let geoTagsCountAll = kbhStatsApi.geoTagsCount('all');
    let assetTagsCountWeek = kbhStatsApi.assetTagsCount('week');
    let assetTagsCountAll = kbhStatsApi.assetTagsCount('all');
    let usersWeek = kbhStatsApi.allUsersPoints('week');
    let usersTotal = kbhStatsApi.allUsersPoints('all', 25);

    // Prepare a function that maps auth0 user_ids to human-readable names.
    const mapUsers = async (data) => {
      // No error-handling here - if it fails we want it to fail hard.
      let management = await Service();

      // Produce a list of user_ids on the form <id> OR <id> OR....
      const ids = _.chain(data).map('user_id').map((id) => {return `"${id.replace('|', '\\|')}"`}).join(' OR ').value();
      // Complete the query.
      const query = `user_id: (${ids})`;

      // Do a bulk lookup of the users.
      let users;
      try {
        users = await management.getUsers({q: query});
      } catch(err) {
        console.warn(`Unable to do bulk user lookup with query ${query}`);
        console.warn(err);
        return {};
      }

      // Map the kbhapi user-references to loaded auth0 users.
      let loadedUsers = data.map((item) => {
        const user = _.find(users, {'user_id' : item.user_id});

        if (!user) {
          console.warn(`Unable to find user with id ${item.user_id}`);
          return {};
        } else {
          return user;
        }
      });

      // Map the scoreEntries we got from the API to new entries with a name
      // property added.
      return data.map((scoreEntry) => {

        // Default in case we cant map the name.
        scoreEntry.name = 'Ukendt';
        if (scoreEntry.user_id) {
          // Lookup the user we got from Auth0 by user_id.
          let loadedUser = _.find(loadedUsers, {'user_id': scoreEntry.user_id});
          if (loadedUser) {
            if (loadedUser.name) {
              // We have a name, so far so good.
              // In situations where Auth0 don't really have the name they fall
              // back to the email.  In that situation the "nickname" field might
              // give us a better name.
              if (loadedUser.name === loadedUser.email && loadedUser.nickname) {
                scoreEntry.name = loadedUser.nickname;
              } else {
                scoreEntry.name = loadedUser.name;
              }
            } else if (loadedUser.nickname) {
              // If we don't have a name but do have nickname, use it.
              scoreEntry.name = loadedUser.nickname;
            }
          }
        }
        return scoreEntry;
      });
    };

    // Resolve all promises and process the data.
    try {
      usersWeek = await usersWeek;
      usersTotal = await usersTotal;
      [
        motifTagsCountWeek,
        motifTagsCountAll,
        geoTagsCountWeek,
        geoTagsCountAll,
        assetTagsCountWeek,
        assetTagsCountAll,
        usersWeek,
        usersTotal
      ] =  [
        await motifTagsCountWeek,
        await motifTagsCountAll,
        await geoTagsCountWeek,
        await geoTagsCountAll,
        await assetTagsCountWeek,
        await assetTagsCountAll,
        // We do a double lookup of users, we could improve performance slightly
        // by looking up the union of the id's first, and then do the mapping.
        await mapUsers(usersWeek),
        await mapUsers(usersTotal)
      ];
    } catch(err) {
      console.warn('Error while gathering user statistics');
      console.warn(err);
      // Get rid of the placeholder and return.
      pageContent = pageContent.replace(PLACEHOLDER, '');
      next();
      return;
    }

    // We got all the data we needed, now prepare data for the template.
    const stats = {
      'week': {
        'geotags': geoTagsCountWeek,
        'motiftagged': assetTagsCountWeek,
        'motiftags': motifTagsCountWeek
      },
      'total': {
        'geotags': geoTagsCountAll,
        'motiftagged': assetTagsCountAll,
        'motiftags': motifTagsCountAll
      },
      'leaders': {
        'week': usersWeek,
        'total': usersTotal
      }
    };

    // Render our data via an internal request.
    req.app.render('stat/top10', {'stats': stats}, (error, html) => {
      if (error) {
        console.warn('Error while fetching user statistics for top 10');
        console.warn(error);
        pageContent = pageContent.replace(PLACEHOLDER, '');
      } else {
        locals.data.page.content = pageContent.replace(PLACEHOLDER, html);
      }

      // Async processing done, pass the control on to the next pre-renderer.
      next();
    });
  }
};

module.exports = renderer;
