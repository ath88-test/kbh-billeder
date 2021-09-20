const plugins = require('../../../pluginController');

const documentsService = plugins.getFirst('document-service');
if(!documentsService) {
  throw new Error('Expected at least one document service!');
}

module.exports = documentsService;
