'use strict';

(function($, window) {
  var ACTION_ASSET_DOWNLOAD_SHOW = '[data-action="asset-download-show"]';
  var ACTION_ASSET_ZOOMABLE = '.asset-image--zoomable';
  var ACTION_ASSET_LAZY = '.asset-image--lazy';
  var ACTION_BIG_IMAGE_TOGGLE = '[data-action="asset-image-size-toggle"]:not(.dimmed)';
  var ACTION_BIG_IMAGE_DISABLED = '[data-action="asset-image-size-toggle"].dimmed';
  var CONTENT_ASSET_TOP = '.asset-top';
  var CONTENT_ASSET_DOWNLOAD = '[data-content="asset-download"]';
  var CONTENT_ASSET_NO_ZOOM = '.no-zoom-message';
  var CONTENT_EXPANDED_CLASS = 'expanded';
  var CONTENT_SLIDER = '.slider';
  var OVERLAY_ACTIVE_CLASS = 'overlay__container--active';
  var OVERLAY_ANIM_IN_CLASS = 'overlay__container--anim-in';

  var AssetPage = {
    init: function() {
      $(ACTION_ASSET_DOWNLOAD_SHOW)
        .on('click', this.actionAssetDownloadShow.bind(this, true));
      $(CONTENT_ASSET_DOWNLOAD)
        .on('click', this.actionAssetDownloadShow.bind(this, false));
      $(ACTION_BIG_IMAGE_DISABLED)
        .on('click', this.actionAssetNoZoom.bind(this, true));
      $(CONTENT_ASSET_NO_ZOOM)
        .on('click', this.actionAssetNoZoom.bind(this, false));
      $(ACTION_ASSET_ZOOMABLE)
        .on('click', this.toggleBigImage.bind(this));
      $(ACTION_BIG_IMAGE_TOGGLE)
        .on('click', this.toggleBigImage.bind(this));
      $(ACTION_ASSET_LAZY).each(function(){
        $(this).attr('src', $(this).data('src'));
      });

      if ($(CONTENT_SLIDER).size() > 0) {
        $(CONTENT_SLIDER).slick({
          lazyLoad: 'progressive',
          infinite: true,
          speed: 300,
          slidesToShow: 6,
          slidesToScroll: 6,
          prevArrow: '.related-assets__prev-arrow',
          nextArrow: '.related-assets__next-arrow',

          responsive: [{
            breakpoint: 768,
            settings: {
              slidesToShow: 4,
              slidesToScroll: 4,
            }
          }, {
            breakpoint: 480,
            settings: {
              slidesToShow: 3,
              slidesToScroll: 3
            }
          }]
        });
      }
    },

    actionAssetDownloadShow: function(show) {
      var $el = $(CONTENT_ASSET_DOWNLOAD);
      if (show === true) {
        $el.addClass(OVERLAY_ACTIVE_CLASS);
        $el.addClass(OVERLAY_ANIM_IN_CLASS);
      } else if (show === false) {
        $el.removeClass(OVERLAY_ANIM_IN_CLASS);
        setTimeout(function() {
          $el.removeClass(OVERLAY_ACTIVE_CLASS);
        }, 300);
      }
    },

    actionAssetNoZoom: function(show) {
      var $el = $(CONTENT_ASSET_NO_ZOOM);
      if (show === true) {
        $el.addClass(OVERLAY_ACTIVE_CLASS);
        $el.addClass(OVERLAY_ANIM_IN_CLASS);
      } else if (show === false) {
        $el.removeClass(OVERLAY_ANIM_IN_CLASS);
        setTimeout(function() {
          $el.removeClass(OVERLAY_ACTIVE_CLASS);
        }, 300);
      }
    },

    toggleBigImage: function() {
      var $use = $(ACTION_BIG_IMAGE_TOGGLE).find('use');
      $(CONTENT_ASSET_TOP).toggleClass(CONTENT_EXPANDED_CLASS);
      if ($use.attr('xlink:href') === '#icon-zoom-in') {
        $use.attr('xlink:href', '#icon-zoom-out');
      } else {
        $use.attr('xlink:href', '#icon-zoom-in');
      }
    }
  };

  window.AssetPage = AssetPage;

})(jQuery, window);