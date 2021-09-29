'use strict';

const cip = require('../../services/cip');
const config = require('../../../lib/config');

/**
 * This initializes the CIP client.
 *
 * @param {Object} state The state of which we are about to initialize.
 */

module.exports = async (state) => {
  if(config.cip.client.authMechanism !== 'http-basic') {
    await cip.initSession();
  }

  return state;
};
