'use strict';

const helpers = require('../../../shared/helpers');

// General function to add 'is-mobile' and 'is-desktop' class to body.
// Used to adjust styling for mobile/desktop and called on multiple events.
function adjustClasses() {
  if (helpers.isMobile($) === true) {
    $('body').addClass('is-mobile').removeClass('is-desktop');
  }
  else {
    $('body').addClass('is-desktop').removeClass('is-mobile');
  }
}

window.addEventListener('resize', adjustClasses, false);
window.addEventListener('load', adjustClasses, false);
document.addEventListener('DOMContentLoaded', adjustClasses, false);