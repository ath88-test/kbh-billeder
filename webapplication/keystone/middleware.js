const {buildMenu, buildMessages} = require('./menus');

/**
	Initialises the standard view locals

	The included layout depends on the navLinks array to generate
	the navigation in the header, you may wish to change this array
	or replace it with your own templates / logic.
*/
exports.initLocals = async (req, res, next) => {
  try {
    res.locals.menus = await buildMenu();
    res.locals.messages = await buildMessages();
  }
  catch(error) {
    next(error);
  }
  next();
};

/**
	Prevents people from accessing protected pages when they're not signed in
 */
exports.requireUser = (req, res, next) => {
  if (!req.user) {
    req.flash('error', 'Please sign in to access this page.');
    res.redirect('/keystone/signin');
  } else {
    next();
  }
};
