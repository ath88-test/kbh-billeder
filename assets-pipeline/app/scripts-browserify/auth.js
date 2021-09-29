'use strict';

const config = require('../../../shared/config');
const helpers = require('../../../shared/helpers');

const RESET_PASSWORD_SELECTOR = '[data-action="reset-password"]';
const RESET_PASSWORD_SUCCESS_ELEMENT = '<p>Tjek din mail for videre instruktioner.</p>';
const RESET_PASSWORD_FAILURE_ELEMENT = '<p>Der skete en fejl, prøv igen senere.</p>';
const DELETE_ACCOUNT_SELECTOR = '[data-action="delete-account-verification"]';

$(function() {
  restrictActions({
    'login': 'authenticated',
    'geo-tagging:start': 'verified',
    'motif-tagging:start': 'verified',
    'feedback:start': 'verified',
  }, verify());

  function verify(showOverlay) {
    // Define a function that can be used to show and hide the overlay.
    const overlayHandler = function(show = showOverlay) {
      var OVERLAY_ACTIVE_CLASS = 'overlay__container--active';
      var OVERLAY_ANIM_IN_CLASS = 'overlay__container--anim-in';
      var $el = $('[data-content="auth-verification"]');
      if (show === true) {
        $el.addClass(OVERLAY_ACTIVE_CLASS);
        $el.addClass(OVERLAY_ANIM_IN_CLASS);
        setTimeout(function(){
          $el.find('.btn:first').focus();
        }, 50); // wait for the elements to be visible otherwise focus won't happen
      }
      else if (show === false) {
        $el.removeClass(OVERLAY_ANIM_IN_CLASS);
        $(DELETE_ACCOUNT_SELECTOR).focus();
        // Animate the removal.
        setTimeout(function () {
          $el.removeClass(OVERLAY_ACTIVE_CLASS);
        }, 300);
      }
    };

    // When requested we assume that the handler will be used right away so we
    // bind the hide-call to the now visible overlay.
    $('[data-content="auth-verification"]')
      .on('click', overlayHandler.bind({}, false));

    overlayHandler(showOverlay);

    return overlayHandler;
  }

  function restrictActions(actions, verify) {
    const authenticated = $('meta[name="authenticated"]').attr('content');
    const verified = authenticated ? $('meta[name="verified"]').attr('content') : 'false';
    const dataActions = Object.keys(actions).map(action => {
      return `[data-action="${action}"]`;
    }).join(', ');

    $(dataActions).on('click', e => {
      const requirement = actions[e.target.getAttribute('data-action')];

      // If the user is not authenticated, block the use of the action and
      // redirect the user to a login saving the current url as state.
      if (authenticated !== 'true' && (requirement === 'authenticated' ||  requirement === 'verified')) {
        e.stopPropagation();
        window.location = '/login?state=' + helpers.encodeReturnState(window.location.href);
      }

      // If the user is authenticated but not verified, show the verification
      // overlay if it is required.
      if (config.features.requireEmailVerification &&
        authenticated === 'true' &&
        requirement === 'verified' && verified !== 'true') {
        e.stopPropagation();
        verify();
      }
    });
  }

  $(RESET_PASSWORD_SELECTOR).on('click', e => {
    const url = location.origin + '/reset-password';
    const element = $(e.target);
    const email = element.data('email');
    const connection = element.data('connection');

    $
      .get(url, {email, connection})
      .done(response => element.replaceWith(RESET_PASSWORD_SUCCESS_ELEMENT))
      .fail(err => element.replaceWith(RESET_PASSWORD_FAILURE_ELEMENT));
  });

  $(DELETE_ACCOUNT_SELECTOR).on('click', e => {
    verify(true);
  });
});
