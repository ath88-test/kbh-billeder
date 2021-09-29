'use strict';

const cip = require('../../services/cip');

/**
 * Close any session with the CIP client.
 *
 * @param {Object} state The state of which we are about to initialize.
 */

module.exports = state => {
  console.log('Closing CIP session', cip.jsessionid);
  return cip.sessionClose().then(() => {
    return state;
  });
};
