'use strict';

function checkDateInput() {
  var input = document.createElement('input');
  input.setAttribute('type', 'date');

  var notADateValue = 'not-a-date';
  input.setAttribute('value', notADateValue);

  return (input.value !== notADateValue);
}

function fbshareCurrentPage() {
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + escape(window.location
    .href));
  return false;
}

function twittershareCurrentPage() {
  var twitterAccount = $('meta[name="twitter:site"]').attr('content');
  window.open('https://twitter.com/intent/tweet?url=' + escape(window.location.href) + '&via=' + twitterAccount);
  return false;
}

function pinterestshareCurrentPage() {
  var url = escape(window.location.href);
  // TODO: Get this from the meta-tags instead
  var title = $('.asset').data('title');
  title += ' kbhbilleder.dk'
  window.open('https://pinterest.com/pin/create/button/?url=' + url + '&media=' + url + '/thumbnail&description=' + title);
  return false;
}

/**
 * Handle asset image toggle (toggle main image and backside).
 *
 * @returns {boolean}
 */
function flipAsset() {
  // Image toggle.
  var image = document.getElementsByClassName('asset__image')[0];
  var backside = document.getElementsByClassName('asset__image--backside')[0];
  image.classList.toggle('asset__image--hide');
  backside.classList.toggle('asset__image--hide');
  //TODO : cleanup classes that are used to show and rotate player buttons!
  var backsideText = document.querySelectorAll('.document__player-controls__rotate--backside');
  backsideText.forEach((prop) => {
    prop.classList.toggle('document__player-controls__rotate--item--active');
  })

  var frontText = document.querySelectorAll('.document__player-controls__rotate--front');
  frontText.forEach((prop) => {
    prop.classList.toggle('document__player-controls__rotate--item--active');
  })
  return false;
}

$(function() {
  var AssetPage = window.AssetPage;
  AssetPage.init();

  $('#search-input').on('focus', function() {
    $(this).parent().addClass('input-group--focus');
  });
  $('#search-input').on('blur', function() {
    $(this).parent().removeClass('input-group--focus');
  });

  var updateQueryStringParameter = function(uri, key, value) {
    var re = new RegExp('([?&])' + key + '=.*?(&|$)', 'i');
    var separator = uri.indexOf('?') !== -1 ? '&' : '?';
    if (uri.match(re)) {
      return uri.replace(re, '$1' + key + '=' + value + '$2');
    } else {
      return uri + separator + key + '=' + value;
    }
  };

  $('form[data-method="modify-query"]').on('submit', function(e) {
    e.preventDefault();
    var $this = $(this);
    var $inputs = $this.find('[name]:input');

    var url = window.location.pathname + window.location.search;

    $inputs.each(function() {
      var $this = $(this);
      var key = $this.attr('name');
      var val = $this.val();
      url = updateQueryStringParameter(url, key, val);
    });

    window.location.href = url;

    return false;
  });

  if (checkDateInput() === false) {
    $('input[type="date"]').formatter({
      'pattern': '{{99}}/{{99}}/{{9999}}'
    });
  }

  $('.asset[data-license-id=7] .image-wrap')
  .on('dragstart contextmenu', function(e) {
    e.preventDefault();
  });
});
