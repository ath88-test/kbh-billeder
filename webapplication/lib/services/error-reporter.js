'use strict';
const config = require('../../../shared/config');
const assert = require('assert');
const mailgun = require('./mailgun');

const {fallbackEmailTo, fallbackEmailFrom} = config.email;
const siteTitle = config.siteTitle;
assert.ok(siteTitle, 'Sitetitle undefined');
assert.ok(fallbackEmailTo, 'Fallback email to undefined');
assert.ok(fallbackEmailFrom, 'Fallback email from undefined');


function sendReport(title, message, payload = false) {
  let mailBody = message;
  if (payload !== false) {
    mailBody += '<br><br>Payload:<br><pre>';
    mailBody += JSON.stringify(payload);
    mailBody += '</pre>';
  }
  return mailgun.sendMessage(fallbackEmailFrom, fallbackEmailTo, `Error report from ${siteTitle} - ${title}`, mailBody);
}

module.exports = {sendReport};
