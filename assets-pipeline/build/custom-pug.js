module.exports = function(config) {
  let pug = require('../../webapplication/lib/pug')(config);
  let prefix = `
    const config = require('@shared/config');
  `;
  let postfix = '\nmodule.exports = template;';

  var originalCompileClient = pug.compileClient;
  pug.compileClient = function(contents, opts) {
    return prefix + originalCompileClient(contents, opts) + postfix;
  };

  return pug;
};
