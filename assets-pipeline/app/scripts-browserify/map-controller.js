﻿'use strict';

/**
 * Clean up results from Elastic Search and map them to Asset results
 *
 * @param results
 *   List of elastic search results
 * @param searchParameters
 *   The parameters that resulted in the search results.
 * @returns list of Assets
 * @private
 */
function _mapEsResultsToAssets(results, searchParameters) {
  // If the results are aggregated geo-hashes, produce assets with hashes.
  if (searchParameters.geohash) {
    return results.aggregations.geohash_grid.buckets.map(function(hashBucket) {
      let count = hashBucket.doc_count;
      return {
        geohash: hashBucket.key,
        clustered: true,
        count: count,
      };
    });
  }

  // We're looking at a result-set with full assets.
  return results.hits.hits
    .filter((hit) => hit._source.location)
    .map((hit) => {
      const asset = hit._source;
      const colid = `${asset.collection}/${asset.id}`;

      const assetResult = {
        id: colid,
        short_title: asset.short_title,
        description: asset.description,
        image_url: `${colid}/thumbnail`,
        latitude: asset.location.lat,
        longitude: asset.location.lon,
        clustered: false,
        // We keep the count property to make upstream handling easier.
        count: 1
      };

      // Heading is optional, so only add it if we have one.
      if (asset.heading) {
        assetResult.heading = asset.heading;
      }

      return assetResult;
    });
}

/**
 * The MapController handles the integration between a map provider and
 * kbhbilleder.
 *
 * The Controller is allowed to use knowledge about kbh billeder (ie. it has
 * access to a search provider), and knows how to handle the concrete map
 * provider implementation. It can not know anything about the internals of the
 * map provider.
 *
 * All interaction between the map controller and the map provider must happen
 * via public api calls.
 *
 * Should we want to support multiple map providers this controller could be
 * made more general, for now it assumes we're integrating with historisk
 * atlas.
 *
 * @param mapElement
 *   DOM-element the map should be attached to
 *
 * @param searchControllerCallbacks
 *   Callback object the map-controller can use to access the search controller.
 *
 * @param options
 *   Optional options object
 *   - icons: List of icon assets
 *   - geohashAtZoomLevel: the zoom-level at which we should be hashing search
 *     results
 *   - clusterAtZoomLevel: the zoom-level at which frontend placemark-clustering
 *     should be enabled
 *   - assetMapper: function that maps raw search-results to assets
 *   - initialCenter: [lon, lat] array the map should be centered at
 *   - initialZoomLevel: initial zoom-level for the map
 *   - initialOffset: [x, y] initial offset in pixels for the map
 *
 * @constructor
 */
function MapController (mapElement, searchControllerCallbacks, options) {
  var initialized = false;
  var defaultMapHandler;
  var assetMapper;
  var frozenState = {frozen: false};

  /**
   * Initialize the Map
   *
   * To support instansiating the MapController without loading the map into
   * the dom we have an explicit initialization step.
   *
   * @private
   */
  function _initializeMap() {
    if (initialized) {
      return;
    }

    // Options are default, so populate any missing settings with defaults.
    if (!options) {
      options = {};
    }

    if (!options.icons) {
      options.icons = {
        clusterSmall: '../images/icons/map/m1.png',
        clusterMedium: '../images/icons/map/m2.png',
        clusterLarge: '../images/icons/map/m3.png',
        asset: '../images/icons/map/pin.png',
        assetSelected: '../images/icons/map/pinselected.png',
        assetHeading: '../images/icons/map/pinheading.png',
        assetHeadingSelected: '../images/icons/map/pinheadingselected.png',
        assetEdit: '../images/icons/map/pinedit.png',
        assetHeadingEdit: '../images/icons/map/pinheadingedit.png',
        camera: '../images/icons/map/camera.png',
        target: '../images/icons/map/pintarget.png',
        image: '../images/icons/map/image.png',
        pinlocation: '../images/icons/map/pinlocation.png'
      };

      // If the user has not given us a specific set of icons, switch to a
      // different set for single assets.
      if (options.mode === 'single') {
        options.icons.asset = '../images/icons/map/pinselected.png';
        options.icons.assetHeading = '../images/icons/map/pinheadingselected.png';
        options.icons.assetEdit = '../images/icons/map/pinedit.png';
        options.icons.assetHeadingEdit = '../images/icons/map/pinheadingedit.png';
      }
    }

    if (options.mapInitParam) {
      // Map state serialized down into a string.
      var parts = options.mapInitParam.split(',');
      // The expected format is nn.nnnnnn,nn.nnnnnn,nnz
      // Eg. 55.67175956237506,12.766296393235555,11.420000000000002z
      // Do a simple verification of the parameters, check that we have 3 parts
      // and that the last part ends on a z.
      if (parts.length === 3 && parts[2].charAt(parts[2].length - 1) === 'z') {
        // Parse the individual parts, and add them if we're successful.
        var parsedCenter = [parseFloat(parts[1]), parseFloat(parts[0])];
        if (!isNaN(parsedCenter[0]) && !isNaN(parsedCenter[1])) {
          options.initialCenter = parsedCenter;
        }
        var parsedZoom = parseFloat(parts[2].substring(0, parts[2].length - 1));
        if (!isNaN(parsedZoom)) {
          options.initialZoomLevel = parsedZoom;
        }
      }
    }

    if (options.sMapInitParam) {
      // Time Warp state serialized down into a string.
      var parts = options.sMapInitParam.split(',');
      // The expected format is nn.nnnnnn,nn.nnnnnn,nnr,nnid
      // Eg. 55.67175956237506,12.766296393235555,300z,55id
      // Do a simple verification of the parameters, check that we have 4 parts
      // and that the last two part ends on a r and id.
      if (parts.length === 4 && parts[2].charAt(parts[2].length - 1) === 'r' && parts[3].substring(parts[3].length - 2) === 'id') {
        // Parse the individual parts, and add them if we're successful.
        options.initialTimeWarpShown = true;
        var parsedCenter = [parseFloat(parts[1]), parseFloat(parts[0])];
        if (!isNaN(parsedCenter[0]) && !isNaN(parsedCenter[1])) {
          options.initialTimeWarpCenter = parsedCenter;
        }
        var parsedRadius = parseInt(parts[2].substring(0, parts[2].length - 1));
        if (!isNaN(parsedZoom)) {
          options.initialTimeWarpRadius = parsedRadius;
        }
        var parsedMapId = parseInt(parts[3].substring(0, parts[3].length - 2));
        if (!isNaN(parsedMapId)) {
          options.initialTimeWarpMapId = parsedMapId;
        }
      }
    }

    if (!options.geohashAtZoomLevel) {
      options.geohashAtZoomLevel = 15;
    }

    if (!options.clusterAtZoomLevel) {
      options.clusterAtZoomLevel = 16;
    }

    if (!options.initialZoomLevel) {
      options.initialZoomLevel = 12;
    }

    if (!options.mode) {
      options.mode = 'search';
    }

    // Allow the client to inset a custom mapper that maps from the search-
    // providers results to assets that can be handled by the map-provider.
    if(options.assetMapper) {
      assetMapper = options.assetMapper;
    } else {
      assetMapper = _mapEsResultsToAssets;
    }

    // Prepare callback functions for the map.

    // Clear the map when the user interacts with it.
    var onMoveStart = function (eventMapHandler) {
      if (options.mode === 'search') {
        eventMapHandler.clear();
      }
    };

    // When the user lets go of the map, trigger a refresh of the search.
    var onMoveEnd = function (eventMapHandler) {
      // Trigger a new search, well get pinged via onUpdate where we'll set our
      // bounding box.
      if (options.mode === 'search') {
        searchControllerCallbacks.refresh();
      }
    };

    // Invoked if HA makes an internal update that we need to reflect.
    // This is mostly done to have a hook we can use to update the browser url
    // with the new state.
    var onHaUpdate = function() {
      if (options.mode === 'search') {
        searchControllerCallbacks.refresh();
      }
    };

    // Create and init map object.
    defaultMapHandler = HistoriskAtlas(
      mapElement,
      {
        mode: options.mode,
        center: options.initialCenter,
        zoomLevel: options.initialZoomLevel,
        timeWarpShown: options.initialTimeWarpShown,
        timeWarpCenter: options.initialTimeWarpCenter,
        timeWarpRadius: options.initialTimeWarpRadius,
        timeWarpMapId: options.initialTimeWarpMapId,
        offset: options.initialOffset,
        clusterAtZoomLevel: options.clusterAtZoomLevel,
        onMoveStart: onMoveStart,
        onMoveEnd: onMoveEnd,
        onUpdate: onHaUpdate,
        onDirectionRemoved: searchControllerCallbacks.onDirectionRemoved,
        icons: options.icons
      }
    );

    if(options.keyboardNavigationHandler) {
      setUpKeyboardNavigation(mapElement, defaultMapHandler);
    }

    // We're now attached to the dom.
    initialized = true;
  }

  // Produce callback object for the caller.
  const handlerCallbacks = {
    /**
     * Plot a single asset on map.
     *
     * Use this function for populating a map with mode=single
     *
     * @param asset
     *   An asset to plot with the properties latitude, longitude,
     *   heading(optional), approximate
     */
    onSingleResult: function (asset) {
      // Make sure we're not working on an uninitialized map.
      _initializeMap();
      defaultMapHandler.show([asset]);
    },

    /**
     * Triggered when new search results are available.
     *
     * The map controller will clear the map, process the search results, and
     * plot them on the map.
     *
     * @param results
     *   List of search results from Elastic Search.
     *
     * @param searchParameters
     *   The parameters that produced the result.
     */
    onResults: function (results, searchParameters) {
      // Make sure we're not working on an uninitialized map.
      _initializeMap();

      // Convert search-results to a list of map-compatible assets.
      var assets = assetMapper(results, searchParameters);

      // Plot the assets on the map.
      defaultMapHandler.show(assets);
    },

    /**
     * Triggered when the search-parameters changes.
     *
     * This will typically be
     * - When trigger it ourselves via onMoveEnd
     * - When the user eg. changes a filter.
     *
     * @param searchParams
     * @param searchCallback
     */
    onUpdate: function (searchParams, searchCallback) {
      // Make sure we're not working on an uninitialized map.
      _initializeMap();

      // Search parameters has been updated and we need to get ready to do a
      // search
      if (!searchParams.filters) {
        searchParams.filters = {};
      }

      // Only show results with location on map.
      searchParams.filters.location = ['Har placering'];

      // Get the current bounding box from the map and add it as a filter.
      let bounds = frozenState.frozen ? frozenState.bounds : defaultMapHandler.getBoundingBox();
      if (bounds) {
        let esBounds = {
          'top_left': {
            'lat': bounds.topLeft.latitude,
            'lon': bounds.topLeft.longitude
          },
          'bottom_right': {
            'lat': bounds.bottomRight.latitude,
            'lon': bounds.bottomRight.longitude
          }
        };

        searchParams.filters.geobounds = esBounds;
      }

      // Add centerpoint and zoom-level, this will go into the url.
      const center =  frozenState.frozen ? frozenState.center : defaultMapHandler.getCenter();
      const zoomLevel =  frozenState.frozen ? frozenState.zoomLevel : defaultMapHandler.getZoomLevel();
      searchParams.map = `${center.latitude},${center.longitude},${zoomLevel}z`;

      // Add values from the time warp (secondary map or smap).
      if (frozenState.frozen ? frozenState.twShown : defaultMapHandler.getTimeWarpShown()) {
        const twCenter = frozenState.frozen ? frozenState.twCenter : defaultMapHandler.getTimeWarpCenter();
        const twRadius = frozenState.frozen ? frozenState.twRadius : defaultMapHandler.getTimeWarpRadius();
        const mapId = frozenState.frozen ? frozenState.mapId : defaultMapHandler.getMapId();
        searchParams.smap = `${twCenter.latitude},${twCenter.longitude},${twRadius}r,${mapId}id`;
      }
      else {
        searchParams.smap = null;
      }
      // If we're zoomed out wide enough, use hash-based results.
      searchParams.geohash = zoomLevel <= options.geohashAtZoomLevel;

      // Hand the parameters back to the search controller and let it do the the
      // search. We'll get control back via onResults().
      searchCallback(searchParams);
    },

    /**
     * Freeze values that might change while the map is being manipulated.
     */
    freeze: function() {
      frozenState.center = defaultMapHandler.getCenter();
      frozenState.zoomLevel = defaultMapHandler.getZoomLevel();
      frozenState.bounds = defaultMapHandler.getBoundingBox();
      frozenState.twCenter = defaultMapHandler.getTimeWarpCenter();
      frozenState.twRadius = defaultMapHandler.getTimeWarpRadius();
      frozenState.mapId = defaultMapHandler.getMapId();
      frozenState.twShown = defaultMapHandler.getTimeWarpShown();
      frozenState.frozen = true;
      defaultMapHandler.freeze();
    },

    /**
     * Thaw values that might change while the map is being manipulated.
     */
    unfreeze: function() {
      frozenState.frozen = false;
      defaultMapHandler.unfreeze();
    },

    toggleEditMode: function(editOn) {
      if (options.mode !== 'single') {
        return false;
      }

      return defaultMapHandler.toggleEditMode(editOn);
    },

    toggleTimeWarp: function () {
      defaultMapHandler.toggleTimeWarp();
    },

    addDirection: function () {
      defaultMapHandler.addDirection();
    },
  };

  // Hand the callbacks back to the Search Controller.
  return handlerCallbacks;
}

function setUpKeyboardNavigation(mapElement, defaultMapHandler) {
  var canvas = $(mapElement).find('canvas')[0];

  var instructionBox = document.createElement('label');
  instructionBox.setAttribute('style', 'height: 0; padding: 0; overflow: hidden;');
  instructionBox.classList.add('map-instruction-box');

  instructionBox.innerHTML =
    `Brug piletasterne til at bevæge kortet, og PLUS (+) og MINUS (-)
    for at zoome ind og ud.
    Tryk ENTER for at begynde at gennemgå elementerne der vises på det
    aktuelle udsnit af kortet, TAB for at navigere mellem elementerne,
    og ESCAPE for at stoppe gennemgang og komme tilbage hertil.
  `;

  $(mapElement).parent()[0].appendChild(instructionBox);

  //Create random ID to refer to as label, so multiple maps can exist on a single page
  instructionBox.id = 'instruction-box-' + Math.random().toString(36).substring(2,15);
  canvas.setAttribute('aria-labelledby', instructionBox.id);

  canvas.setAttribute('tabindex', '0');
  canvas.addEventListener('focus', function(e) {
    instructionBox.setAttribute('style', '');
  });

  canvas.addEventListener('blur', function(e) {
    instructionBox.setAttribute('style', 'height: 0; padding: 0; overflow: hidden;');
  });

  // Key press support
  canvas.addEventListener('keydown', function(e) {
    var currentCenter = defaultMapHandler.getCenter();
    var currentZoomLevel = defaultMapHandler.getZoomLevel();

    //The pan speed is calculated with an exponential fit based on three
    //points in order to get a reasonable speed for each pan step at all
    //the zoom levels people are likely to use with the maps.
    //zoom level 17 => ~0.0001 pan distance
    //zoom level 15 => ~0.001 pan distance
    //zoom level 10 => ~0.01 pan distance
    var panSpeed = 1.29976 * Math.exp(-0.486705 * currentZoomLevel);

    var panKeys = {
      ArrowLeft: {x: -panSpeed, y: 0},
      ArrowRight: {x: panSpeed, y: 0},
      ArrowUp: {x: 0, y: panSpeed},
      ArrowDown: {x: 0, y: -panSpeed},
    };

    if(Object.keys(panKeys).includes(e.key)) {
      e.preventDefault();
      var pan = panKeys[e.key];
      var newCenter = {
        longitude: currentCenter.longitude + pan.x,
        latitude: currentCenter.latitude + pan.y,
      };

      defaultMapHandler.setCenter(newCenter);
      return;
    }

    // Zoom is implemented by navigating up or down a single zoom level.
    var zoomKeys = {
      '+': 1,
      '-': -1,
    };

    if(Object.keys(zoomKeys).includes(e.key)) {
      e.preventDefault();
      var zoom = zoomKeys[e.key];
      defaultMapHandler.setZoomLevel(currentZoomLevel + zoom);
      return;
    }

    if(e.key == 'Enter') {
      e.preventDefault();
      defaultMapHandler.showFirstAssetPopup();
    }
  });
}

module.exports = MapController;
