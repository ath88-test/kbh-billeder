/**
 * Handle tiled zoom on asset pages.
 */
// Register click listener that acts on the 'toggle-expandable' action
const DOCUMENT_SELECTOR = '.document';
const FOOTER_SELECTOR = 'footer.footer';
const HEADER_SELECTOR = 'header.topbar';
const LEAFLET_INNER_SELECTOR = '.leaflet-image-layer.leaflet-zoom-animated';
const TILE_ID_DATA_ATTRIBUTE = 'data-tile-id';
const TILED_ZOOM_ELEMENT_ID = 'tiled-zoom';
const TILED_ZOOM_ELEMENT_SELECTOR = '#tiled-zoom';
const TOGGLE_TILED_ZOOM = '[data-action="toggle-tiled-zoom"]';
const TOGGLE_TILED_ZOOM_IN = '[data-action="tiled-zoom-in"]';
const TOGGLE_TILED_ZOOM_OUT = '[data-action="tiled-zoom-out"]';
const ZOOM_API_DATA_ENDPOINT = 'https://api.kbharkiv.dk/data/';

/**
 * Clear out any elements added by leaflet.
 */
function removeLeaflet (tileId) {
  const img = $(LEAFLET_INNER_SELECTOR);
  if (img[0]) {
    img[0].src = '';
  }

  const parent = $(TILED_ZOOM_ELEMENT_SELECTOR).parent();
  $(TILED_ZOOM_ELEMENT_SELECTOR).remove();

  // Add as the first child so that the button comes after and can be displayed
  // on top.
  parent.prepend('<div id="tiled-zoom" '+ TILE_ID_DATA_ATTRIBUTE + '="' + tileId + ' "></div>');
}

/**
 * Register click-listeners for the zoom buttons.
 */
function registerZoomHandles (map) {
  $(TOGGLE_TILED_ZOOM_IN).unbind('click').click(function(){
    map.setZoom(map.getZoom() + 1);
  });

  $(TOGGLE_TILED_ZOOM_OUT).unbind('click').click(function(){
    map.setZoom(map.getZoom() - 1);
  });
}

/**
 * Register a handler that can resize the zoom container on resize.
 */
function registerResizeHandler (map) {
  const resizeHandler = () => {
    // Recalculate the canvas size by getting the inner (thanks ios)
    // windowheight, and then subtracting the header and footer (if visible).
    const $header = $(HEADER_SELECTOR);
    const $footer = $(FOOTER_SELECTOR);
    const windowHeight = window.innerHeight;
    const headerHeight = $header.is(':visible') ? $header.height() : 0;
    const footerHeight = $footer.is(':visible') ? $footer.height() : 0;
    const canvasSize = windowHeight - (headerHeight + footerHeight);

    $('.tiled-zoom-container').height(canvasSize);
    $(TILED_ZOOM_ELEMENT_SELECTOR).height(canvasSize);
    map.invalidateSize();
  };

  $(window).on('resize', resizeHandler).trigger('resize');

  // De-register when the zoom-layer is disabled.
  $(TILED_ZOOM_ELEMENT_SELECTOR).on('disable', () => {
    $(window).off('resize', resizeHandler);
  });
}

/**
 * Return callback that can process tiling metadata and initialize leaflet.
 * @param tileId
 *   The tileid attached to the element that leaflet will attach to.
 */
function getTileFetchCallback(tileId) {
  return (data) => {
    // Make sure what we got back seems ok.
    if (
      !data
      || !Array.isArray(data)
      || !data[0]
      || !data[0]['images']
      || !Array.isArray(data[0]['images'])
      || data[0]['images'].length === 0
      || !data[0]['metadata']
      || !data[0]['metadata']['height']
      || !data[0]['metadata']['width']
    ) {
      return;
    }

    removeLeaflet(tileId);
    window.scrollTo(0,0);

    let height = data[0]['metadata']['height'];
    let width = data[0]['metadata']['width'];
    let imageSrc = data[0]['images'].pop();

    let map = L.map(TILED_ZOOM_ELEMENT_ID, {
      // We have our own zoom controllers.
      zoomControl: false,
      // Hide the "leaflet" watermark.
      attributionControl: false
    }).setView(new L.LatLng(0, 0), 3);

    // Configure the leaflet plugin that integrates to the tiled zoom.
    L.tileLayer.deepzoom(imageSrc, {
      width: width,
      height: height,
      // Zoom in tight from the start
      tolerance: 0.6,
      imageFormat: 'jpeg',
      minZoom: 9
    }).addTo(map);
    registerResizeHandler(map);

    registerZoomHandles(map);
  };
}

/**
 * Handled tiled zoom
 */
const tiledZoomer = {
  /**
   * @param element
   *   The element that the user click to toggle. It must be placed under main
   *   asset .document parent.
   */
  toggle: (element) => {
    // Drill up to the first parent, and then toggle all children visibility-
    // state. This assumes that we start in a state where the the main asset-
    // page is visible, and the zoom overlay is hidden (or vice-versa).
    $(element).parents('.document').first().children().toggle();

    let tileId = $(TILED_ZOOM_ELEMENT_SELECTOR).attr(TILE_ID_DATA_ATTRIBUTE);

    // We just enabled the zoom overlay.
    if ($(TILED_ZOOM_ELEMENT_SELECTOR).is(':visible')) {
      // Let styling react on us being enabled.
      $('body').addClass('is-tiled-zoom');

      const tileFetchId = $(TILED_ZOOM_ELEMENT_SELECTOR).attr(TILE_ID_DATA_ATTRIBUTE);

      // Fetch data about the zoom-layer using jsonp.
      $.ajax({
        url: ZOOM_API_DATA_ENDPOINT + tileFetchId,
        jsonp: 'callback',
        dataType: 'jsonp',
        success: getTileFetchCallback(tileId),
      });

    } else {
      // Let handles unregister.
      $(TILED_ZOOM_ELEMENT_SELECTOR).trigger('disable');
      removeLeaflet(tileId);

      $('body').removeClass('is-tiled-zoom');
    }
  }
};

// Register a click-listener on any tiled zoom button.
$(DOCUMENT_SELECTOR).on('click', TOGGLE_TILED_ZOOM, (element) => {
  tiledZoomer.toggle(element.target);
});

// Toggle the overlay if escape is pressed while it is visible.
$(document).keyup(function(e) {
  if (e.keyCode === 27 && $(TILED_ZOOM_ELEMENT_SELECTOR).is(':visible')) {
    tiledZoomer.toggle($(TILED_ZOOM_ELEMENT_SELECTOR).first().get());
  }
});



module.exports = tiledZoomer;
