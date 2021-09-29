
const passport = require('passport');
const helpers = require('../shared/helpers');
const auth0 = require('./lib/services/auth0');
const Auth = auth0.Auth;
const users = require('./controllers/users');
const {check, validationResult, body} = require('express-validator/check');

module.exports = {
  initialize: (app) => {
    passport.use(auth0.strategy);

    passport.serializeUser(function(user, done) {
      done(null, user);
    });

    passport.deserializeUser(function(user, done) {
      done(null, user);
    });

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(function(req, res, next) {
      res.locals.user = req.user;
      next();
    });
  },

  registerRoutes: app => {
    app.get('/login',
      function(req, res, next) {
        req.session["auth_redirect"] = req.query.state;
        next();
      },
      passport.authenticate('auth0',auth0.passportConfig),
      function(req, res) {
        res.redirect('/');
      }
    );

    app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/');
    });

    // Most user facing routes are danish, so let's keep it that way.
    app.get('/min-side', users.renderProfile);
    app.get('/rediger-min-side', users.renderEditProfile);

    app.post('/update-user',
      [
        // Email validation.
        check('email').custom(value => {
          // If email is not specified, don't validate it.
          if (value === '') {
            return true;
          }
          // Check if email is already used.
          return auth0.getManagementService().getUsers({q: 'email: ' + value}).then(user => {
            if (user.length > 0) {
              return Promise.reject('Indtastet email er allerede i brug');
            }
          });
        }),
          check('email', 'Den email adresse du har indtastet og den gentagede email adresse er ikke den samme')
          .optional({checkFalsy: true})
          .custom((value, { req }) => {
            if (value !== req.body.emailConfirmation) {
              return false;
            }
            return value;
          }),
        check('password', 'Det password, du har indtastet, er ikke det samme, som det gentagede password')
          .optional({checkFalsy: true})
          .custom((value, { req }) => {
            if (value !== req.body.passwordConfirmation) {
              return false;
            }
            return value;
          })
      ],
      async(req, res, next) => {
        // return validation results
        let errors = validationResult(req);

        if (!errors.isEmpty()) {
          console.log(errors.array());
          req.session.error = errors.array()[0].msg;
        }
        else {
          try {
            let updateObject = {};

            if (req.body.username !== '') {
              updateObject.username = req.body.username;
              req.session.status = 'Dit brugernavn er nu ændret til "' + req.body.username + '". Log ud og log ind igen for at gennemføre ændringen.';
            }

            if (req.body.password !== '') {
              updateObject.password = req.body.password;
              req.session.status = 'Dit password er blevet ændret.';
            }

            if (req.body.email !== '') {
              updateObject.email = req.body.email;
              req.session.status = 'Din email er nu ændret til "' + req.body.email + '". Log ud og log ind igen for at gennemføre ændringen.';
            }

            await auth0.getManagementService().users.update(
              { id: req.user.user_id }, updateObject
            );
          }
          catch(err) {
            // The API trows an invalid_body error code, if we submit an empty form.
            // We do not want to show that error message, because it's very technical and long.
            if (JSON.parse(err.originalError.response.text).errorCode !== 'invalid_body') {
              req.session.error = helpers.translate(err.message);
            }
          }
        }

        res.redirect('/rediger-min-side');
      });

    app.get('/reset-password', async (req, res) => {
      const {email, connection} = req.query;
      let status;

      try {
        await Auth.requestChangePasswordEmail({email, connection});
        status = 200;
      }
      catch(err) {
        console.log(err.message);
        status = 500;
      }

      res.status(status).json({});
    });

    app.get('/delete-account', async (req, res) => {
      try {
        await auth0.getManagementService().users.delete({ id: req.user.user_id });
        status = 200;
        res.redirect('/logout');
      }
      catch (err) {
        console.log(err.message);
        status = 500;
      }
    });

    app.get('/auth/callback', passport.authenticate('auth0', {
      failureRedirect: '/'
    }), function(req, res) {
      const serializedState = req.session["auth_redirect"];

      if(typeof(serializedState) === 'string') {
        const returnPath = helpers.decodeReturnState(serializedState);
        res.redirect(returnPath);
      } else {
        res.redirect('/');
      }
    });
  }
};
