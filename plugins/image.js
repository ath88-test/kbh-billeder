'use strict';
const config = require('../lib/config');
const cip = require('../services/cip');
const imageController = require('../controllers/image');

module.exports = {
  type: 'image-controller',
  module: imageController,
  initialize: () => {
    if(config.cip.client.authMechanism !== 'http-basic') {
      return cip.initSession().then(() => {
        // TODO: Consider creating the structure of categories (used for the menu)
        // from another API than the CIP
      }).then(() => {
        setInterval(() => {
          // Consider calling close session ..
          cip.sessionRenew();
        }, config.cip.sessionRenewalRate || 60*60*1000);
        console.log('CIP session initialized');
      });
    }
  }
};
