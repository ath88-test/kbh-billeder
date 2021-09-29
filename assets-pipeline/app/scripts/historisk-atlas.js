'use strict';

/**
 * Read in options and set defaults.
 */
function _prepareMapOptions(options) {
  if (!options) {
    options = {};
  }

  if (!options.center) {
    options.center = [12.58, 55.67];
  }

  if (!options.zoomLevel) {
    options.zoomLevel = 12;
  }

  if (!options.timeWarpShown) {
    options.timeWarpShown = false;
  }

  if (!options.timeWarpCenter) {
    options.timeWarpCenter = options.center;
  }

  if (!options.timeWarpRadius) {
    options.timeWarpRadius = 200;
  }

  if (!options.timeWarpMapId) {
    options.timeWarpMapId = 239;
  }

  if (!options.clusterAtZoomLevel) {
    options.clusterAtZoomLevel = 11;
  }

  if (!options.onMoveStart) {
    options.onMoveStart = function () { };
  }

  if (!options.onMoveEnd) {
    options.onMoveEnd = function () { };
  }

  if (!options.maps) {
    options.maps = [
      { id: 239, title: 'Luftfoto', year: '2019' },
      { id: 39, title: '4 cm kort', year: '1977-85' },
      { id: 38, title: '4 cm kort', year: '1953-76' },
      { id: 228, title: 'K\u00F8benhavn', year: '1860' },
      { id: 105, title: 'K\u00F8benhavn', year: '1939' },
      { id: 54, title: 'Lavkantkort', year: '1901-1945' },
      { id: 55, title: 'H\u00F8jkantkort', year: '1840-1899' },
      { id: 154, title: 'Geddes kort', year: '1761' }
    ];

    if (options.mode == 'single')
      options.maps.unshift({ id: 161, title: 'Standard', year: '2018' });
  }

  return options;
}

/**
 * Setup a map instance and wrap it in an object containing references to
 * everything we'll need to handle the map going forward.
 */
function _prepareMap(mapElement, center, offset, zoomLevel, timeWarpShown, timeWarpCenter, timeWarpRadius, timeWarpMapId, icons, mode, maps, onUpdateMapControllerCallback) {
  // Collect any map-related objects we're going to be referencing in the rest
  // of the setup and in callbacks.
  var mapState = {};

  mapState.mapElement = mapElement;

  //check that timeWarpMapId reference an existing map
  var newTimeWarpMapId = 239;
  for (var i = 0; i < maps.length; i++)
    if (maps[i].id == timeWarpMapId)
      newTimeWarpMapId = timeWarpMapId;
  timeWarpMapId = newTimeWarpMapId;
  mapState.id = timeWarpMapId;

  // Dropdown select control for the map. In single mode used to select the
  // background map, otherwise used to select the time warp map.
  mapState.mapSelectControl = function () {
    mapState.mapSelectElement = document.createElement('select');
    mapState.mapSelectElement.title = 'Vælg kort';

    // When select is changes update the source of the appropriate source.
    mapState.mapSelectElement.addEventListener('change', function (event) {
      var source = mapState.isSearchMode() ? mapState.timeWarp.getSource() : mapState.rasterLayer.getSource();
      mapState.id = mapState.mapSelectElement.value;
      source.setUrl(mapState.getMapUrl(mapState.id));
      onUpdateMapControllerCallback();

    }, false);

    // Read in the maps passed in "maps" and crates options for them
    for (var i = 0; i < maps.length; i++) {
      var mapTitle = maps[i].title + ' ' + maps[i].year;
      var elementOption = document.createElement('option');
      elementOption.title = mapTitle;
      elementOption.value = maps[i].id;
      elementOption.innerText = mapTitle;
      elementOption.selected = maps[i].id == timeWarpMapId;
      mapState.mapSelectElement.appendChild(elementOption);
    }

    // Create the div that holds the select element
    var element = document.createElement('div');
    element.id = 'mapSelect';
    element.className = 'ol-unselectable ol-control';
    element.appendChild(mapState.mapSelectElement);

    // Extends the OpenLayers Control Class
    ol.control.Control.call(this, {
      element: element
    });
  };
  ol.inherits(mapState.mapSelectControl, ol.control.Control);

  // If mode is other than "single" we need to create the location
  // and time warp toggle control
  if (mode !== 'single') {
    mapState.locationControl = function () {

      // Create the div that represents the location button
      mapState.locationElement = document.createElement('button');
      mapState.locationElement.setAttribute('aria-label', 'Find din lokation på kortet');
      mapState.locationElement.id = 'mapLocation';
      mapState.locationElement.className = 'ol-unselectable ol-control';

      // Add listener to catch clicks on the element
      mapState.locationElement.addEventListener('click', function (event) {

        // Toggle the "location" class on the main map element and
        // check if it is present now
        if (mapElement.classList.toggle('location')) {

          // Request postion from browser. Will popup security request box if first time.
          navigator.geolocation.getCurrentPosition(function (pos) {

            // Convert coords from lat/lon to native projection
            var coords = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]);

            // Animate center to the new coords.
            mapState.view.animate({
              center: coords,
              duration: 1000
            });

            // Create location feature representing the users location on the map
            var locationFeature = new ol.Feature(mapState.locationPoint = new ol.geom.Point(coords));
            locationFeature.setStyle(new ol.style.Style({
              image: new ol.style.Icon({
                src: icons.pinlocation
              })
            }));

            // Create layer for the location feature
            mapState.locationLayer = new ol.layer.Vector({
              source: new ol.source.Vector({ features: [locationFeature] }), updateWhileInteracting: true, updateWhileAnimating: true
            });

            // Add the layer to the map
            mapState.map.addLayer(mapState.locationLayer);

            // Continually update the position as the users moves around
            mapState.watchId = navigator.geolocation.watchPosition(function (pos) {
              mapState.locationPoint.setCoordinates(ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]));
            }, function (error) {
              navigator.geolocation.clearWatch(mapState.watchId);
            });
          }, function (error) { });
        } else {

          // Remove location feature by remoung the layer and
          // stop watching the users movement
          mapState.map.removeLayer(mapState.locationLayer);
          navigator.geolocation.clearWatch(mapState.watchId);
        }
      }, false);

      // Extends the OpenLayers Control Class
      ol.control.Control.call(this, {
        element: mapState.locationElement
      });
    };
    ol.inherits(mapState.locationControl, ol.control.Control);

    mapState.timeWarpToggleControl = function () {

      // Create the div that represents the toggle time warp button
      mapState.timeWarpToggleElement = document.createElement('button');
      mapState.timeWarpToggleElement.setAttribute('aria-label', 'Slå tidsrejse til/fra');
      mapState.timeWarpToggleElement.id = 'timeWarpToggle';
      mapState.timeWarpToggleElement.className = 'ol-unselectable ol-control';

      // Add listener to catch clicks on the element
      mapState.timeWarpToggleElement.addEventListener('click', function (event) {
        mapState.timeWarp.toggle();
      }, false);
      ol.control.Control.call(this, {
        element: mapState.timeWarpToggleElement
      });
    };
    ol.inherits(mapState.timeWarpToggleControl, ol.control.Control);
  }

  /**
  * Returns the url template for map tiles
  *
  * @param {number} id
  *   DOM object for the table to be made draggable.
  *
  * @return {string}
  *   Url template for maps with id "id".
  */
  mapState.getMapUrl = function (id) {
    return `https://haapi.historiskatlas.dk/cache/tile_normal/${id}/{z}/{x}/{y}.jpg?key=f92f73160d844ba2a91f6386804bb129`;
  }

  // Create OpenLayers vector source (main source for assets)
  mapState.vectorSource = new ol.source.Vector({
    features: []
  });

  // Create OpenLayers cluster source
  mapState.clusterSource = new ol.source.Cluster({
    distance: 70,
    source: mapState.vectorSource
  });

  // Style cache for features. Used to hold style objects for reuse
  var styleCache = {};

  // Array for easy acces to different size icons
  var featureIcons = [, icons.clusterSmall, icons.clusterMedium, icons.clusterLarge];

  // Create OpenLayers vector layer to hold assets
  mapState.vectorLayer = new ol.layer.Vector({

    // Set source. If single mode then dont use clustering.
    source: mode == 'single' ? mapState.vectorSource : mapState.clusterSource,

    updateWhileInteracting: true,
    updateWhileAnimating: true,

    /**
    * Calculates the style for a feature (asset)
    *
    * @param {ol.fature} feature
    *   The feature for which a style should be calculated
    *
    * @return {ol.style.Style}
    *   The resulting style
    */
    style: function (feature) {

      // If this is a client side clustered feature it
      // will contain a number of subfeatures
      var subFeatures = feature.get('features');

      // If no sub features is present create an array
      // with one feature in it
      if (!subFeatures)
        subFeatures = [feature];

      // If only one feature is present calculate the style
      // based on that feature.
      if (subFeatures.length == 1) {
        if (!subFeatures[0].asset)
          return subFeatures[0].getStyle();
        if (!subFeatures[0].asset.clustered)
          return subFeatures[0].getStyle();
      }

      // Count the number of sub features by iterating the client
      // side cluster and count the number of server side clustered
      // assets
      var count = 0;
      for (var i = 0; i < subFeatures.length; i++) {
        count += subFeatures[i].asset.count;
      }

      // Check if we have a cached version of the style with the count
      var style = styleCache[count];

      // Of not, create a new style
      if (!style) {
        style = new ol.style.Style({
          image: new ol.style.Icon({
            // The size of the icon is determined by how many digits
            // is in count, ie. (1-9 = small), (10-99) = medium, (100+) = large
            src: featureIcons[Math.min(count.toString().length, 3)]
          }),
          text: new ol.style.Text({

            // Show number of assets in clusterd on icon
            text: count.toString(),
            font: '11px Arial, sans-serif',
            fill: new ol.style.Fill({
              color: '#E01962'
            }),
            stroke: new ol.style.Stroke({
              color: '#fff',
              width: 3
            })
          })
        });

        // Put the style in the cache for later use
        styleCache[count] = style;
      }
      return style;
    }
  });

  // Create the OpenLayers View that controls the map
  mapState.view = new ol.View({
    center: ol.proj.fromLonLat(center),
    zoom: zoomLevel,
  });

  // Create the raster layer which shows the background map
  mapState.rasterLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: mapState.getMapUrl(161)
    })
  });

  // Creating the "-" content for the zoom out button
  var minus = document.createElement('span')
  minus.innerHTML = '&minus;'

  // Create zoom controls and build controls array with
  // the needed controls
  var controls = [new ol.control.Zoom({ zoomOutLabel: minus }), new mapState.mapSelectControl()];
  if (mapState.locationControl)
    controls.push(new mapState.locationControl());
  if (mapState.timeWarpToggleControl)
    controls.push(new mapState.timeWarpToggleControl());

  // Create the open layers map
  mapState.map = new ol.Map({
    target: mapElement,
    layers: [mapState.rasterLayer, mapState.vectorLayer],
    view: mapState.view,
    controls: controls,

    // Only interactions enabled: "drag to pan", "pinch to zoom" and "scroll to zoom"
    interactions: [new ol.interaction.DragPan(), new ol.interaction.PinchZoom(), new ol.interaction.MouseWheelZoom()],

    loadTilesWhileInteracting: true,
    loadTilesWhileAnimating: true
  });

  // Create popup element and place it before the end of the map element
  mapElement.insertAdjacentHTML('beforeend', '<a id="mapPopup" href="#"></a>');
  mapState.mapPopupElement = document.getElementById('mapPopup');
  mapState.mapPopupElement.innerHTML = '<div id="mapPopupImage"></div><a href="#" id="mapPopupClose"></a><div id="mapPopupHeading"></div><div id="mapPopupDescription"></div>';

  mapState.mapSelectDivElement = document.getElementById('mapSelect');
  mapElement.classList.add('map');

  if (mode == 'single') {
    // If mode is "single" we need to position the map select
    // in the lower right corner.
    mapElement.classList.add('single');
    mapState.mapSelectDivElement.style.display = 'block';
    mapState.mapSelectDivElement.style.bottom = '18px';
    mapState.mapSelectDivElement.style.right = '18px';

    // If an offset is given in options center the map accordingly
    if (offset) {
      var size = mapState.map.getSize();
      mapState.view.centerOn(ol.proj.fromLonLat(center), size, [size[0] / 2 + offset[0], size[1] / 2 + offset[1]]);
    }
  } else {
    // If mode is not "single" we should create and prepare the time warp
    mapState.timeWarp = _prepareTimeWarp(mapState.map, mapElement, mapState.mapSelectDivElement, mapState.getMapUrl, onUpdateMapControllerCallback, maps, timeWarpShown, timeWarpCenter, timeWarpRadius, timeWarpMapId);
  }

  return mapState;
}

/**
* Prepares the time warp for use and defines functions
*
* @param {ol.Map} map
*   The open layers map object
*
* @param {HTMLElement} mapElement
*   The html element holding the open layers map
*
* @param {HTMLElement} mapSelectDivElement
*   The html element holding the map selector
*
* @param {Function} getMapUrl
*   Function to get map url template by id
*
* @param {Function} onUpdateMapControllerCallback
*   Callback function called when the time warp is toggled
*
* @param {Array} maps
*   Array of maps to choose from
*
* @return {ol.layer.Tile}
*   The tile layer representing the time warp
*/
function _prepareTimeWarp(map, mapElement, mapSelectDivElement, getMapUrl, onUpdateMapControllerCallback, maps, shown, center, radius, mapId) {

  // Create the tile layer and init it with the
  // first map in the map array
  var timeWarp = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: getMapUrl(mapId)
    })
  });

  // The time warp starts hidden
  timeWarp.setVisible(false);

  // Insert it after the background map, but before
  // the feature (asset) layer.
  map.getLayers().insertAt(1, timeWarp);

  // The time warp can be in either CIRCLE or
  // SPLIT mode.
  timeWarp.modes = { CIRCLE: 0, SPLIT: 1 };

  // The time warp starts as a CIRCLE
  timeWarp.mode = timeWarp.modes.CIRCLE;

  // When dragging the time warp their are 4 resulting modes:
  // NONE: The time warp is not being dragged
  // CIRCLE_RADIUS: The circle is changing its radius
  // CIRCLE_MOVE: The circle is being moved around
  // SPLIT: In SPLIT mode the divider is being moved left or right
  timeWarp.dragModes = { NONE: 0, CIRCLE_RADIUS: 1, CIRCLE_MOVE: 2, SPLIT: 3 }
  timeWarp.dragMode = timeWarp.dragModes.NONE;

  // Default time warp position. Not used, as it
  // becomes centered or set on show
  timeWarp.position = [300, 300];

  // The minimum radius in pixels
  timeWarp.minRadius = 100;

  // Default radius. Not used, as it is set on show
  timeWarp.radius = radius < timeWarp.minRadius ? timeWarp.minRadius : radius;

  timeWarp.rectWidth = 2;

  // The width of the outline of the TW in pixels
  timeWarp.lineWidth = 4.0;

  // Create the close control for the TW
  timeWarp.closeControl = function () {
    timeWarp.closeElement = document.createElement('button');
    timeWarp.closeElement.setAttribute('aria-label', 'Luk tidsrejse');
    timeWarp.closeElement.id = 'timeWarpClose';
    timeWarp.closeElement.className = 'ol-unselectable ol-control time-warp-button';

    // When the close button is clicked
    timeWarp.closeElement.addEventListener('click', function (event) {

      // Toggle (close) the TW.
      timeWarp.toggle();

    }, false);
    ol.control.Control.call(this, {
      element: timeWarp.closeElement
    });
  };
  ol.inherits(timeWarp.closeControl, ol.control.Control);
  map.addControl(new timeWarp.closeControl());

  // Crate the mode (CIRCLE or SPLIT) control for the TW
  timeWarp.modeControl = function () {
    timeWarp.modeElement = document.createElement('button');
    timeWarp.modeElement.setAttribute('aria-label', 'Skift tidsrejsevisning');
    timeWarp.modeElement.id = 'timeWarpMode';
    timeWarp.modeElement.className = 'ol-unselectable ol-control time-warp-button';

    // When the mode button is clicked
    timeWarp.modeElement.addEventListener('click', function (event) {

      // Toggle the mode
      timeWarp.mode = timeWarp.mode == timeWarp.modes.CIRCLE ? timeWarp.modes.SPLIT : timeWarp.modes.CIRCLE

      if (timeWarp.mode == timeWarp.modes.SPLIT) {
        // Set the rectangular width and postion to half the width of the map
        timeWarp.rectX = map.getSize()[0] / 2;
        timeWarp.rectWidth = map.getSize()[0] - timeWarp.rectX + timeWarp.lineWidth / 2.0;
        mapElement.classList.add('split')
      } else
        mapElement.classList.remove('split')

      timeWarp.updateControls();

      // Redraw the map to reflect the change
      map.renderSync();
    }, false);
    ol.control.Control.call(this, {
      element: timeWarp.modeElement
    });
  };
  ol.inherits(timeWarp.modeControl, ol.control.Control);
  map.addControl(new timeWarp.modeControl());

  /**
  * Called just before the TW layer is drawn
  *
  * @param {Event} event
  *   The event containg the drawing context
  */
  timeWarp.precomposeTimeWarp = function (event) {
    var ctx = event.context;
    timeWarp.pixelRatio = event.frameState.pixelRatio;

    // Apply the outline (Circle or rectangle)
    this.applyPath(ctx);

    ctx.save();

    // Clip to prevent drawing map outside outline
    ctx.clip();
  }
  timeWarp.on('precompose', timeWarp.precomposeTimeWarp);

  /**
  * Called just after the TW layer is drawn
  *
  * @param {Event} event
  *   The event containg the drawing context
  */
  timeWarp.postcomposeTimeWarp = function (event) {
    var ctx = event.context;

    // Remove the clipping again
    ctx.restore();

    timeWarp.applyPath(ctx);

    // Draw the outline
    if (timeWarp.position) {
      ctx.strokeStyle = '#e61a64';
      ctx.lineWidth = timeWarp.lineWidth * timeWarp.pixelRatio;
      ctx.stroke();
    }
  }
  timeWarp.on('postcompose', timeWarp.postcomposeTimeWarp);

  /**
  * Applies the path to the drawing context
  *
  * @param {CanvasRenderingContext2D} ctx
  *   The context being drawn on for the TW
  */
  timeWarp.applyPath = function (ctx) {
    var x = timeWarp.position[0] * timeWarp.pixelRatio;
    var y = timeWarp.position[1] * timeWarp.pixelRatio;
    ctx.beginPath();
    switch (timeWarp.mode) {
      case timeWarp.modes.CIRCLE:

        // apply the path of the circle in CIRCLE mode
        ctx.arc(x, y, timeWarp.radius * timeWarp.pixelRatio, 0, 2 * Math.PI);

        break;
      case timeWarp.modes.SPLIT:
        var rectY = -10.0;
        var rectHeight = map.getSize()[1] + 20.0;

        // apply the path of the rectangle in SPLIT mode
        ctx.rect((timeWarp.rectX * timeWarp.pixelRatio), (rectY * timeWarp.pixelRatio), (timeWarp.rectWidth * timeWarp.pixelRatio), (rectHeight * timeWarp.pixelRatio));

        break;
    }
  }

  /**
  * Toggles the time warp visibility
  */
  timeWarp.toggle = function (center, radius) {
    if (mapElement.classList.toggle('time-warp'))
      timeWarp.show(center, radius)
    else
      timeWarp.hide()

    // If callback onUpdateMapControllerCallback is defined call it
    if (onUpdateMapControllerCallback)
      onUpdateMapControllerCallback();
  }

  /**
  * Returns the toggel state of the TW
  */
  timeWarp.shown = function () {
    return (mapElement.classList.contains('time-warp'))
  }

  /**
  * Shows the TW
  */
  timeWarp.show = function (center, radius) {

    // Always start as a CIRCLE
    timeWarp.mode = timeWarp.modes.CIRCLE;

    var size = map.getSize();

    // Set position at middle of map
    if (center) {
      timeWarp.position = map.getPixelFromCoordinate(ol.proj.fromLonLat(center));
      if (timeWarp.position[0] < 0)
        timeWarp.position[0] = 0;
      if (timeWarp.position[1] < 0)
        timeWarp.position[1] = 0;
      if (timeWarp.position[0] > size[0])
        timeWarp.position[0] = size[0];
      if (timeWarp.position[1] > size[1])
        timeWarp.position[1] = size[1];
    } else
      timeWarp.position = [size[0] / 2, size[1] / 2];

    // Set radius af the TW to approx 1/3 of smallest dimension of map
    timeWarp.radius = radius ? radius : Math.min(size[0], size[1]) * 0.3;
    timeWarp._show();
  }
  timeWarp._show = function () {

    // Register listeners
    mapElement.addEventListener('touchstart', timeWarp.touchDownEventHandle = function (event) { timeWarp.touchDown(event) });
    mapElement.addEventListener('mousedown', timeWarp.downEventHandle = function (event) { timeWarp.down([event.pageX, event.pageY]) });
    mapElement.addEventListener('touchmove', timeWarp.touchMoveEventHandle = function (event) { timeWarp.touchMove(event); });
    timeWarp.listenerKeyPointerDrag = map.on('pointerdrag', function (event) { timeWarp.pointerDrag(event); });

    // Unhide elements
    timeWarp.setVisible(true);
    mapSelectDivElement.style.display = 'block';
    timeWarp.closeElement.style.display = 'block';
    timeWarp.modeElement.style.display = 'block';
    mapElement.classList.remove('split');
    timeWarp.updateControls();
  }

  /**
  * Hides the TW
  */
  timeWarp.hide = function () {

    //Unregister listeners
    mapElement.removeEventListener('touchstart', timeWarp.touchDownEventHandle);
    mapElement.removeEventListener('mousedown', timeWarp.downEventHandle);
    mapElement.removeEventListener('touchmove', timeWarp.touchMoveEventHandle);
    ol.Observable.unByKey(this.listenerKeyPointerDrag);

    // Hide elements
    timeWarp.setVisible(false);
    mapSelectDivElement.style.display = 'none';
    timeWarp.closeElement.style.display = 'none';
    timeWarp.modeElement.style.display = 'none';
    mapElement.classList.remove('split');
  }

  /**
  * Updates the position of the TW controls
  */
  timeWarp.updateControls = function () {
    mapSelectDivElement.style.left = timeWarp.mode == timeWarp.modes.CIRCLE ? (timeWarp.position[0] - mapSelectDivElement.clientWidth / 2) + 'px' : null;
    mapSelectDivElement.style.top = timeWarp.mode == timeWarp.modes.CIRCLE ? (timeWarp.position[1] + timeWarp.radius - 21) + 'px' : null;
    mapSelectDivElement.style.right = timeWarp.mode == timeWarp.modes.CIRCLE ? null : '18px';
    mapSelectDivElement.style.bottom = timeWarp.mode == timeWarp.modes.CIRCLE ? null : '18px';

    timeWarp.updateButton(timeWarp.closeElement, timeWarp.mode == timeWarp.modes.CIRCLE, timeWarp.mode == timeWarp.modes.CIRCLE ? -Math.PI / 4 - 22 / timeWarp.radius : 18);
    timeWarp.updateButton(timeWarp.modeElement, timeWarp.mode == timeWarp.modes.CIRCLE, timeWarp.mode == timeWarp.modes.CIRCLE ? -Math.PI / 4 + 22 / timeWarp.radius : 62);
  }
  /**
  * Updates the position of the individual controls (Close and mode toggle)
  */
  timeWarp.updateButton = function (element, circle, radians) {
    element.style.left = circle ? (timeWarp.position[0] + Math.cos(radians) * timeWarp.radius - element.clientWidth / 2) + 'px' : null;
    element.style.top = circle ? (timeWarp.position[1] + Math.sin(radians) * timeWarp.radius - element.clientWidth / 2) + 'px' : radians + 'px';
    element.style.right = circle ? null : '18px';
  }

  /**
  * Called when user start touch event
  *
  * @param {Event} event
  *   The event holding the incoming touches
  */
  timeWarp.touchDown = function (event) {

    // Calculate the distance of touches
    timeWarp.lastTouchDist = timeWarp.touchDistFromTouches(event.touches);
    timeWarp.down(timeWarp.centerCoordFromTouches(event.touches, true), false, true);
  }

  /**
  * Called when user start touch event or mouse down event
  *
  * @param {Array} coord
  *   The coordinates of the event
  *
  * @param {boolean} forceMove
  *   Should this be forced to start a move
  *
  * @param {boolean} relative
  *   Is the supplied coords relative to the map element or the screen
  */
  timeWarp.down = function (coord, forceMove, relative) {

    // If the supplied coords are not relative, we need to offset with the mapElement offset
    if (!relative) {
      var offset = mapElement.getBoundingClientRect();
      coord = [coord[0] - offset.left, coord[1] - offset.top];
    }

    // Calculate the distance to the center circle OR the edge of the split
    var dist = Math.sqrt(Math.pow(timeWarp.position[0] - coord[0], 2) + Math.pow(timeWarp.position[1] - coord[1], 2));

    if (timeWarp.position && timeWarp.mode == timeWarp.modes.CIRCLE) {

      // If the event happend on the border of the circle, start a CIRCLE_RADIUS
      if (dist < (timeWarp.radius + 8) && dist > (timeWarp.radius - 8) && !forceMove) {
        timeWarp.dragMode = timeWarp.dragModes.CIRCLE_RADIUS;
        timeWarp.radiusDisplace = timeWarp.radius - dist;
      }

      // If the event happend inside the border of the circle, start a CIRCLE_MOVE
      else if (dist < timeWarp.radius) {
        timeWarp.dragMode = timeWarp.dragModes.CIRCLE_MOVE;
        timeWarp.mouseDisplace = [timeWarp.position[0] - coord[0], timeWarp.position[1] - coord[1]]
      }
      else
        timeWarp.dragMode = timeWarp.dragModes.NONE;
    }
    else if (timeWarp.position && timeWarp.mode == timeWarp.modes.SPLIT) {
      var displace = timeWarp.rectX - coord[0];

      // If the event happend inside the border of the split, start a SPLIT drag mode
      if (Math.abs(displace) < 8) {
        timeWarp.dragMode = timeWarp.dragModes.SPLIT;
        timeWarp.mouseDisplace = [displace, 0];
      }
    } else
      timeWarp.dragMode = timeWarp.dragModes.NONE;
  }

  /**
  * Called when user start Open Layers pointer drag event
  *
  * @param {Event} event
  *   The event containing coords
  */
  timeWarp.pointerDrag = function (event) {
    var newposition = event.pixel ? event.pixel : [event.offsetX, event.offsetY];
    switch (timeWarp.dragMode) {

      // If we are in CIRCLE_RADIUS calculate new radius of circle
      case timeWarp.dragModes.CIRCLE_RADIUS:
        var dist = Math.sqrt(Math.pow(timeWarp.position[0] - newposition[0], 2) + Math.pow(timeWarp.position[1] - newposition[1], 2));
        dist += timeWarp.radiusDisplace;
        timeWarp.radius = dist > timeWarp.minRadius ? dist : timeWarp.minRadius;

        //Prevent the map being dragged
        event.preventDefault();
        break;

      // If we are in CIRCLE_MOVE calculate new position of circle
      case timeWarp.dragModes.CIRCLE_MOVE:
        if (event.originalEvent.pointerType != 'touch')
          timeWarp.position = [newposition[0] + timeWarp.mouseDisplace[0], newposition[1] + timeWarp.mouseDisplace[1]];

        //Prevent the map being dragged
        event.preventDefault();
        break;

      // If we are in SPLIT calculate new position of rectangle
      case timeWarp.dragModes.SPLIT:
        timeWarp.rectX = newposition[0] + timeWarp.mouseDisplace[0];
        timeWarp.rectWidth = map.getSize()[0] - timeWarp.rectX + timeWarp.lineWidth / 2.0;

        //Prevent the map being dragged
        event.preventDefault();
        break;
    }
    map.renderSync();
    timeWarp.updateControls();
  }

  /**
  * Called when user is dragging finger
  *
  * @param {Event} event
  *   The event containing touches
  */
  timeWarp.touchMove = function (event) {

    // This is only relevant if we are moving the TW
    if (timeWarp.dragMode != timeWarp.dragModes.CIRCLE_MOVE)
      return;

    // Calculate new position
    var newposition = timeWarp.centerCoordFromTouches(event.touches, true)
    timeWarp.position = [newposition[0] + timeWarp.mouseDisplace[0], newposition[1] + timeWarp.mouseDisplace[1]];

    // Calculate new radius
    var touchDist = timeWarp.touchDistFromTouches(event.touches);
    timeWarp.radius += touchDist - timeWarp.lastTouchDist;
    timeWarp.radius = timeWarp.radius < timeWarp.minRadius ? timeWarp.minRadius : timeWarp.radius;
    timeWarp.lastTouchDist = touchDist;

    map.renderSync();
    timeWarp.updateControls();
  }

  /**
  * Calculates average coords of multiple touch points
  *
  * @param {Array} touches
  *   Array containg touch points
  *
  * @param {boolean} relative
  *   Are the coords relative to the map element?
  *
  * @return {Array}
  *   The average coords
  */
  timeWarp.centerCoordFromTouches = function (touches, relative) {
    var center = [0, 0];
    var offset = mapElement.getBoundingClientRect();
    var count = 0;
    for (var i = 0; i < touches.length; i++) {
      var x = relative ? touches[i].pageX - offset.left : touches[i].pageX;
      var y = relative ? touches[i].pageY - offset.top : touches[i].pageY;

      if (timeWarp.dragMode == timeWarp.dragModes.CIRCLE_MOVE || timeWarp.dragMode == timeWarp.dragModes.NONE) {
        var dist = Math.sqrt(Math.pow(timeWarp.position[0] - x, 2) + Math.pow(timeWarp.position[1] - y, 2));
        if (dist > timeWarp.radius + 8)
          continue;
      }

      center[0] += x;
      center[1] += y;
      count++;
    }
    center[0] /= count;
    center[1] /= count;
    return center;
  }

  /**
  * Calculates distance between touches
  *
  * @param {Array} touches
  *   Array containg touch points
  *
  * @return {Array}
  *   The distance between the first to touch points
  */
  timeWarp.touchDistFromTouches = function (touches) {

    // Only calculate new distance if there are morhe than one touch point
    if (touches.length < 2)
      return timeWarp.lastTouchDist;

    // Only calculate new distance if first touch point is inside circle
    if (Math.sqrt(Math.pow(timeWarp.position[0] - touches[0].pageX, 2) + Math.pow(timeWarp.position[1] - touches[0].pageY, 2)) > timeWarp.radius + 8)
      return timeWarp.lastTouchDist;

    // Only calculate new distance if second touch point is inside circle
    if (Math.sqrt(Math.pow(timeWarp.position[0] - touches[1].pageX, 2) + Math.pow(timeWarp.position[1] - touches[1].pageY, 2)) > timeWarp.radius + 8)
      return timeWarp.lastTouchDist;

    // Calculate and return distance between the two touch points
    return Math.sqrt(Math.pow(touches[0].pageX - touches[1].pageX, 2) + Math.pow(touches[0].pageY - touches[1].pageY, 2));
  }

  /**
  * Called when touch point is released
  *
  * @param {Event} event
  *   Event containg touch points
  */
  timeWarp.touchUp = function (event) {

    // If all touches are released we are done
    if (event.touches.length == 0)
      timeWarp.up();

    // Otherwise calculate as new situation
    else
      timeWarp.touchDown(event);

    onUpdateMapControllerCallback();
  }

  /**
  * Called when mouse or touch is released on TW
  */
  timeWarp.up = function () {

    // Drag set to NONE
    timeWarp.dragMode = timeWarp.dragModes.NONE;
    onUpdateMapControllerCallback();
  }

  /**
  * Caculate what pointer type to show in relation to TW
  */
  timeWarp.getHoverInterface = function (pixel) {

    // If TW is hidden return empty
    if (!timeWarp.getVisible())
      return '';

    // If mode is SPLIT and mouse is on border return 'ew-resize'
    if (timeWarp.mode == timeWarp.modes.SPLIT)
      return Math.abs(timeWarp.rectX - pixel[0]) < 8 ? 'ew-resize' : '';

    // If mode is CIRCLE and mouse is on border return resize accoring to position on border
    if (timeWarp.mode == timeWarp.modes.CIRCLE) {
      var dist = Math.sqrt(Math.pow(timeWarp.position[0] - pixel[0], 2) + Math.pow(timeWarp.position[1] - pixel[1], 2));
      if ((dist < (timeWarp.radius + 8) && dist > (timeWarp.radius - 8)) || timeWarp.dragMode == timeWarp.dragModes.CIRCLE_RADIUS) {
        var radiusX = timeWarp.position[0] * timeWarp.pixelRatio;
        var radiusY = timeWarp.position[1] * timeWarp.pixelRatio;
        if (pixel[0] < (radiusY + 40) && pixel[1] > (radiusY - 40)) return 'ew-resize';
        if (pixel[0] < (radiusX + 40) && pixel[0] > (radiusX - 40)) return 'n-resize';
        if (pixel[0] < radiusX && pixel[1] > radiusY) return 'sw-resize';
        if (pixel[0] > radiusX && pixel[1] < radiusY) return 'sw-resize';
        return 'se-resize';
      }
      // If mouse is inside border return 'move' pointer
      if (dist < timeWarp.radius)
        return 'move';
    }

    return '';
  }

  // Toggles on if shown is true
  if (shown)
    map.once('postrender', function () {
      timeWarp.toggle(center, timeWarp.radius)
    });

  return timeWarp;
}

/**
* Integration between kbhbilleder and a map-provider.
*
* @param {HTMLElement} mapElement
*   The html element holding the open layers map
*
* @param {Object} options
*   Object containing options for the map
*
* @return {Object}
*   The maphandler
*/
function HistoriskAtlas(mapElement, options) {
  // Clean up our options.
  options = _prepareMapOptions(options);

  // Then prepare the map for use and get a state object we can use to interact
  // with the map.
  var mapState = _prepareMap(mapElement, options.center, options.offset, options.zoomLevel, options.timeWarpShown, options.timeWarpCenter, options.timeWarpRadius, options.timeWarpMapId, options.icons, options.mode, options.maps, options.onUpdate);

  // Setup handler functions the client will use to interact with the map - ie.
  // we never expose the mapState to the user, only handler functions.
  var mapHandler = {};

  // Set up keyboard controls of viewing popups
  mapState.mapPopupElement.addEventListener('keydown', function(e) {
    if(e.key == 'Escape') {
      e.preventDefault();
      mapState.hidePopup();
      return;
    }

    if(e.key == 'Tab') {
      e.preventDefault();
      var currentFeatureIndex = features.findIndex((feature) => feature.ol_uid == mapState.feature.ol_uid);
      if(currentFeatureIndex === -1) {
        mapState.hidePopup();
        mapHandler.showFirstAssetPopup();
        return;
      }

      var nextFeature = features
        .slice(currentFeatureIndex + 1)
        .find((f) => !f.asset.clustered);

      if(!nextFeature) {
        mapState.hidePopup();
        return;
      }

      mapState.hidePopup();
      mapState.feature = nextFeature;
      var coords = mapState.feature.getGeometry().getCoordinates();
      var pixel = mapState.map.getPixelFromCoordinate(coords);
      mapState.showPopup(mapState.feature, pixel);
      return;
    }
  });

  /**
   * "Freeze" the map by removing all interactions from the map.
   */
  mapHandler.freeze = function () {
    if (!mapState.map) {
      return;
    }

    mapState.map.getInteractions().clear();
  };

  /**
   * "Unfreeze" the map by adding interactions back to the map.
   */
  mapHandler.unfreeze = function () {
    if (!mapState.map) {
      return;
    }

    mapState.map.getInteractions().extend([new ol.interaction.DragPan(), new ol.interaction.PinchZoom(), new ol.interaction.MouseWheelZoom()]);
  };

  /**
  * Toggle the TW display state
  */
  mapHandler.toggleTimeWarp = function () {
    if (mapState.timeWarp.getVisible())
      mapState.timeWarp.hide();
    else
      mapState.timeWarp.show();
  }

  var features;

  /**
  * Called to show assets on the map
  *
  * @param {Array} assets
  *   Array containg the asset objects
  */
  mapHandler.show = function (assets) {

    // Start by removing exisisting assets
    mapState.vectorSource.clear(true);
    features = [];

    // Iterate over the assets array
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i];

      // Get coords of assets
      var coords = asset.geohash ? mapState.getCoordinateFromGeohash(asset.geohash) : [asset.longitude, asset.latitude];

      // Create feature from coords
      var feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(coords))
      });

      // If asset is approximate draw circle around point instead
      if (asset.approximate) {
        feature.setStyle(new ol.style.Style({
          geometry: new ol.geom.Circle(ol.proj.fromLonLat(coords), 90, 'XY'),
          fill: new ol.style.Fill({
            color: 'rgba(227,33,102,0.33)'
          })
        }));
      } else
        if (!asset.clustered)
          feature.setStyle(mapHandler.getFeatureStyle(asset));

      // Put reference to asset on feature
      feature.asset = asset;

      features.push(feature);

      // If mapState has a selected feature and the id matches this
      // it is the new selected (persists selction accros show calls)
      if (mapState.feature && mapState.isSearchMode()) {
        if (asset.id == mapState.feature.asset.id) {
          mapState.feature = feature;
          mapState.feature.setStyle(mapHandler.getFeatureStyle(feature, true))
        }
      }
    }

    // Add the features to the vector source
    mapState.vectorSource.addFeatures(features);

    if (features.length > 0) {
      // If in single or edit mode set as selected feature
      if (mapState.isSingleOrEditMode()) {
        mapState.feature = features[0];
      }
      // Otherwise if a feature is selected, show popup
      // persists popup across map manipulations
      else if (mapState.feature) {
        var coords = mapState.feature.getGeometry().getCoordinates();
        var pixel = mapState.map.getPixelFromCoordinate(coords);
        mapState.showPopup(mapState.feature, pixel);
      }
    }
  };

  mapHandler.showFirstAssetPopup = function() {
    if (features.length > 0) {
      // Disallow going through clustered features, pick one that isnt
      var nextFeature = features.find((f) => !f.asset.clustered);
      if(!nextFeature) {
        return;
      }

      mapState.feature = nextFeature;
      var coords = mapState.feature.getGeometry().getCoordinates();
      var pixel = mapState.map.getPixelFromCoordinate(coords);
      mapState.showPopup(mapState.feature, pixel);
    }
  };

  /**
  * Returns feature style by asset
  *
  * @param {Object} asset
  *   Asset for which a style needs to be calculated
  *
  * @param {boolean} selected
  *   Is the feature selected?
  */
  mapHandler.getFeatureStyle = function (asset, selected) {
    var style = new ol.style.Style({
      image: new ol.style.Icon({
        src: asset.heading == undefined ? (mapState.isEditMode() ? options.icons.assetEdit : (selected ? options.icons.assetSelected : options.icons.asset)) : (mapState.isEditMode() ? options.icons.assetHeadingEdit : (selected ? options.icons.assetHeadingSelected : options.icons.assetHeading)),
        rotation: asset.heading ? asset.heading * (Math.PI / 180) : 0
      })
    })

    if (mapState.isEditMode())
      style = [style, new ol.style.Style({
        image: new ol.style.Icon({
          src: options.icons.camera
        })
      })];

    return style;
  }

  /**
  * Returns target feature style by asset
  *
  * @param {Object} asset
  *   Asset for which a target style needs to be calculated
  */
  mapHandler.getTargetFeatureStyle = function (asset) {
    return [new ol.style.Style({
      image: new ol.style.Icon({
        src: options.icons.target,
        rotation: asset.heading ? asset.heading * (Math.PI / 180) : 0
      })
    }), new ol.style.Style({
      image: new ol.style.Icon({
        src: options.icons.image
      })
    })];
  }

  /**
  * Returns bounding box of the map
  *
  * @return {Object}
  *   The bounding box of the format:
  *   {topLeft: { longitude, latitude}, bottomRight: { longitude, latitude } }
  */
  mapHandler.getBoundingBox = function () {
    var extent = mapState.view.calculateExtent();
    var topLeft = ol.proj.toLonLat(ol.extent.getTopLeft(extent));
    var bottomRight = ol.proj.toLonLat(ol.extent.getBottomRight(extent));
    return {
      topLeft: {
        longitude: topLeft[0],
        latitude: topLeft[1]
      },
      bottomRight: {
        longitude: bottomRight[0],
        latitude: bottomRight[1]
      }
    };
  };

  /**
  * Returns the center of the map
  *
  * @return {Object}
  *   The center of the map of the format:
  *   {longitude, latitude}
  */
  mapHandler.getCenter = function () {
    var center = ol.proj.toLonLat(mapState.view.getCenter());
    return {
      longitude: center[0],
      latitude: center[1]
    };
  };

  /**
   *
   * @param {Object} center
   *   The center to place the view at.
   *   {longitude, latitude}
   */
  mapHandler.setCenter = function (center) {
    mapState.view.setCenter(ol.proj.fromLonLat([center.longitude, center.latitude]));
  };

  /**
  * Clears the map for features (assets)
  */
  mapHandler.clear = function () {
    mapState.vectorSource.clear(true);
  };

  /**
  * @return {number}
  *   The zoom level of the map
  */
  mapHandler.getZoomLevel = function () {
    return mapState.view.getZoom();
  };

  /**
   * Set the zoom level
   * @param {number} zoom the new zoom level
   */
  mapHandler.setZoomLevel = function (zoom) {
    mapState.view.setZoom(zoom);
  };

  /**
  * Returns the center of the time warp
  *
  * @return {Object}
  *   The center of where the time warp is placed on the map of the format:
  *   {longitude, latitude}
  */
  mapHandler.getTimeWarpCenter = function () {
    var center = ol.proj.toLonLat(mapState.map.getCoordinateFromPixel(mapState.timeWarp.position));
    return {
      longitude: center[0],
      latitude: center[1]
    };
  };

  /**
  * Returns the radius of the time warp
  *
  * @return {number}
  *   The radius of the of the time warp in pixels
  *
  */
  mapHandler.getTimeWarpRadius = function () {
    return Math.round(mapState.timeWarp.radius);
  };

  /**
  * Returns the mapid of the time warp
  *
  * @return {number}
  *   The id of the map currently shown in the time warp
  *
  */
  mapHandler.getMapId = function () {
    return mapState.id;
  };

  /**
  * Returns the shown state of the time warp
  *
  * @return {boolean}
  *   The shown state of the time warp, ie. true if its turned on, false if not
  *
  */
  mapHandler.getTimeWarpShown = function () {
    return mapState.timeWarp.shown();
  };

  /**
  * Adds a target feature with default heading of 90 (to the right of the asset)
  */
  mapHandler.addDirection = function () {
    mapState.feature.asset.heading = 90;

    //Called twice to force a recalculation
    mapHandler.toggleEditMode();
    mapHandler.toggleEditMode();
  }

  /**
  * Toggles between single and edit mode
  */
  mapHandler.toggleEditMode = function (editOn) {
    // If the user specifically requested a mode, use it.
    if (editOn !== undefined) {
      options.mode = editOn ? 'edit' : 'single';
    } else {
      // Otherwise go for toggle.
      options.mode = options.mode === 'edit' ? 'single' : 'edit';
    }

    if (options.mode === 'edit') {

      // Add a translate interaction to the feature so
      // it can be dragged around
      mapHandler.translate = new ol.interaction.Translate({
        features: new ol.Collection([mapState.feature])
      });
      mapHandler.translate.on('translating', mapState.translating);
      mapState.map.addInteraction(mapHandler.translate);

      // If asset has a heading register a target also
      if (mapState.feature.asset.heading) {
        var coordinates = mapState.feature.getGeometry().getCoordinates()
        var pixel = mapState.map.getPixelFromCoordinate(coordinates);
        var radian = (mapState.feature.asset.heading - 90) * (Math.PI / 180);
        pixel[0] += Math.cos(radian) * 120;
        pixel[1] += Math.sin(radian) * 120;
        var targetCoordinates = mapState.map.getCoordinateFromPixel(pixel);

        // Add a dotted line feature from the asset to the target
        mapState.lineFeature = new ol.Feature({
          geometry: new ol.geom.LineString([coordinates, targetCoordinates])
        });
        mapState.lineFeature.setStyle(new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 2,
            lineDash: [5, 5]
          })
        }))
        mapState.vectorSource.addFeature(mapState.lineFeature);

        // Add a target feature
        mapState.targetFeature = new ol.Feature({
          geometry: new ol.geom.Point(targetCoordinates)
        });
        mapState.targetFeature.setStyle(mapHandler.getTargetFeatureStyle(mapState.feature.asset));

        mapState.vectorSource.addFeature(mapState.targetFeature);

        // The target feature should also be dragable
        mapHandler.translateTarget = new ol.interaction.Translate({
          features: new ol.Collection([mapState.targetFeature])
        });
        mapHandler.translateTarget.on('translating', mapState.translating);
        mapState.map.addInteraction(mapHandler.translateTarget);
      }

    } else {
      // If no heading is present remove the target and line features
      if (mapState.targetFeature) {
        mapState.vectorSource.removeFeature(mapState.targetFeature);
        mapState.vectorSource.removeFeature(mapState.lineFeature);
        mapState.targetFeature = null;
      }

      // Also remove the interactions
      mapState.map.removeInteraction(mapHandler.translate);
      mapState.map.removeInteraction(mapHandler.translateTarget);
    }

    // Set the style of the feature
    mapState.feature.setStyle(mapHandler.getFeatureStyle(mapState.feature.asset));

    return mapState.feature.asset;
  };

  /**
  * Called when a feature or target is dragged by the user
  */
  mapState.translating = function (feature) {

    // Get the coordinates of the currently selected feature
    var coordinates = mapState.feature.getGeometry().getCoordinates();

    // If there is a target present, update the heading of the asset
    if (mapState.targetFeature) {
      var targetCoordinates = mapState.targetFeature.getGeometry().getCoordinates();
      var pixel = mapState.map.getPixelFromCoordinate(coordinates);
      var pixelTarget = mapState.map.getPixelFromCoordinate(targetCoordinates);
      mapState.feature.asset.heading = (Math.atan2(pixel[1] - pixelTarget[1], pixel[0] - pixelTarget[0]) * 180 / Math.PI + 270) % 360;
    }

    // Update the coords of the asset
    var lonLat = ol.proj.toLonLat(coordinates);
    mapState.feature.asset.longitude = lonLat[0];
    mapState.feature.asset.latitude = lonLat[1];

    // If there is a target present, update the line feature
    if (mapState.targetFeature) {
      mapState.feature.setStyle(mapHandler.getFeatureStyle(mapState.feature.asset))
      mapState.lineFeature.getGeometry().setCoordinates([coordinates, targetCoordinates]);
      mapState.targetFeature.setStyle(mapHandler.getTargetFeatureStyle(mapState.feature.asset))
    }
  }

  mapState.isSingleMode = function () {
    return options.mode == 'single';
  }
  mapState.isEditMode = function () {
    return options.mode == 'edit';
  }
  mapState.isSingleOrEditMode = function () {
    return options.mode == 'edit' || options.mode == 'single';
  }
  mapState.isSearchMode = function () {
    return options.mode == 'search' || !options.mode;
  }

  // Event handling - integrate the clients event handlers.
  mapState.map.on('movestart', function (event) {
    options.onMoveStart(mapHandler);
  });
  mapState.map.on('moveend', function (event) {

    // If we are not in single or edit mode, check if we need to switch to / from clustering
    if (!mapState.isSingleMode() && !mapState.isEditMode())
      mapState.vectorLayer.setSource(options.clusterAtZoomLevel < mapState.view.getZoom() ? mapState.vectorSource : mapState.clusterSource);
    options.onMoveEnd(mapHandler);
  });

  /**
   * Checks whether the users hovers over the close icon of the target feature.
   *
   * @param hoverPixel
   *   Pixel the user currently hovers at.
   *
   * @param targetFeature
   *   Coordinate of the target feature.
   */
  function _cursorHoversCloseIcon(hoverPixel, targetFeature) {
    return hoverPixel[0] - targetFeature[0] > 13 && targetFeature[1] - hoverPixel[1] > 10;
  }

  mapState.map.on('pointermove', function (event) {
    if (mapState.isSingleMode()) {
      return;
    }

    var hoverFeature = undefined;
    var pixel = mapState.map.getEventPixel(event.originalEvent);
    mapState.map.forEachFeatureAtPixel(pixel,
      function (feature) {
        if (feature !== mapState.lineFeature) {
          hoverFeature = feature;
          return true;
        } else {
          return false;
        }
      }, { layerFilter: _doNotShowLocationLayerFilter }
    );

    // If we are hovering over a feature and it is the target feature, show pointer if over the "close" icon
    if (hoverFeature == mapState.targetFeature && hoverFeature) {
      var pixelFeature = mapState.map.getPixelFromCoordinate(hoverFeature.getGeometry().getCoordinates());
      if (_cursorHoversCloseIcon(pixel, pixelFeature)) {
        mapState.mapElement.style.cursor = 'pointer';
        return;
      }
    }

    // Set global cursor according to hover state
    mapState.mapElement.style.cursor = hoverFeature ? (mapState.isEditMode() ? 'move' : 'pointer') : (mapState.timeWarp ? mapState.timeWarp.getHoverInterface(pixel) : '');
  })

  // If the map is manipulated (dragged or zommed)
  // the popup should be closed
  mapState.map.on('pointerdrag', function (event) {
    mapState.hidePopup();
  })
  mapState.map.getView().on('change:resolution', function () {
    mapState.hidePopup();
  });

  /**
   * Checks whether the specified layer is the user-location layer.
   */
  function _doNotShowLocationLayerFilter(layer) {
    return layer !== mapState.locationLayer;
  }

  // Handle any click-events on the map.
  mapState.map.on('click', function (event) {
    // We're displaying a single asset, we have no custom functionality on
    // click.
    if (mapState.isSingleMode()) {
      return;
    }

    // Get the pixel the user clicked.
    var eventPixel = mapState.map.getEventPixel(event.originalEvent);
    // Figure out if the click hit a feature.
    var clickFeature = undefined;
    mapState.map.forEachFeatureAtPixel(eventPixel,
      function (feature) {
        // Stop (return true) at the first feature that is not the line-feature.
        if (feature !== mapState.lineFeature) {
          clickFeature = feature;
          return true;
        } else {
          return false;
        }
      },
      { layerFilter: _doNotShowLocationLayerFilter }
    );

    mapState.hidePopup();

    if (mapState.isEditMode()) {
      if (clickFeature !== mapState.targetFeature)
        return;

      if (clickFeature && clickFeature === mapState.targetFeature) {
        // Find the pixels of the event and the feature, and use it to determine
        // whether the user is hovering over the "close" icon.
        var featurePixel = mapState.map.getPixelFromCoordinate(clickFeature.getGeometry().getCoordinates());
        if (_cursorHoversCloseIcon(eventPixel, featurePixel)) {

          // Clear out the heading, redraw the feature, issue a callback to
          // announce the removal.
          mapState.feature.asset.heading = undefined;
          mapHandler.toggleEditMode();
          mapHandler.toggleEditMode();
          if (options.onDirectionRemoved)
            options.onDirectionRemoved();
        }
      }

      return;
    }

    // Only continue if a feature is clicked
    if (!clickFeature)
      return;

    var subFeatures = clickFeature.get('features');
    if (!subFeatures)
      subFeatures = [clickFeature];

    var asset = subFeatures[0].asset;

    // If a single asset is clicked
    if (subFeatures.length == 1 && !asset.clustered) {
      var pixel = mapState.map.getPixelFromCoordinate(clickFeature.getGeometry().getCoordinates());

      // If the popup would go outside the map border, center on the feature first.
      if (pixel[1] < 310 || pixel[0] < 225 || pixel[0] > mapState.map.getSize()[0] - 225) {
        mapState.feature = subFeatures[0];
        pixel[1] -= 155;
        mapState.view.animate({
          center: mapState.map.getCoordinateFromPixel(pixel),
          duration: 500
        });
        return;
      }

      // Otherwise just show the popup
      mapState.showPopup(subFeatures[0], pixel);
      return;
    }

    // If a clustered asset is clicked, zoom in on it
    mapState.view.animate({
      center: clickFeature.getGeometry().getCoordinates(),
      duration: 1000,
      zoom: mapState.view.getZoom() + 2
    });
  });

  // If the close icon on a popup is clicked, close the popup
  document.getElementById('mapPopupClose').addEventListener('click', function (evt) {
    evt.preventDefault();
    mapState.hidePopup();
    evt.stopPropagation();
  });

  /**
  * Shows a popup
  *
  * @param {ol.feature} feature
  *   The feature representing the asset
  *
  * @param {Array} pixel
  *   The pixel coordinate of the feature
  */
  mapState.showPopup = function (feature, pixel) {
    mapState.feature = feature;

    // Set new style now the feature is selected
    feature.setStyle(mapHandler.getFeatureStyle(feature.asset, true));

    // Position and show the popup
    mapState.mapPopupElement.style.left = (pixel[0] - 110) + 'px';
    mapState.mapPopupElement.style.top = (pixel[1] - 315) + 'px';
    mapState.mapPopupElement.href = feature.asset.id;
    document.getElementById('mapPopupImage').style.backgroundImage = "url('" + feature.asset.image_url + "')";
    document.getElementById('mapPopupHeading').innerText = feature.asset.short_title;
    document.getElementById('mapPopupDescription').innerText = feature.asset.description ? feature.asset.description : '';
    mapState.mapPopupElement.style.display = 'block';
    mapState.mapPopupElement.assetId = feature.asset.id;

    mapState.mapPopupElement.focus();
  };

  /**
  * Hides a popup
  */
  mapState.hidePopup = function () {
    mapState.mapPopupElement.style.display = 'none';
    if (mapState.feature && mapState.isSearchMode()) {
      mapState.feature.setStyle(mapHandler.getFeatureStyle(mapState.feature.asset))
      mapState.feature = null;
    }

    mapState.mapPopupElement.parentElement.querySelector('canvas').focus();
  }

  /**
  * Converts geo hash to coordinates
  *
  * @param {string} geohash
  *   The geo hash string
  */
  mapState.getCoordinateFromGeohash = function (geohash) {
    var bounds = this.getBoundsFromGeohash(geohash);
    var latMin = bounds.sw.lat, lonMin = bounds.sw.lon;
    var latMax = bounds.ne.lat, lonMax = bounds.ne.lon;
    var lat = (latMin + latMax) / 2;
    var lon = (lonMin + lonMax) / 2;

    lat = lat.toFixed(Math.floor(2 - Math.log(latMax - latMin) / Math.LN10));
    lon = lon.toFixed(Math.floor(2 - Math.log(lonMax - lonMin) / Math.LN10));

    return [Number(lon), Number(lat)];
  }

  /**
  * Converts geo hash to bounds
  *
  * @param {string} geohash
  *   The geo hash string
  */
  mapState.getBoundsFromGeohash = function (geohash) {
    if (geohash.length === 0) throw new Error('Invalid geohash');

    geohash = geohash.toLowerCase();

    var evenBit = true;
    var latMin = -90, latMax = 90;
    var lonMin = -180, lonMax = 180;

    for (var i = 0; i < geohash.length; i++) {
      var chr = geohash.charAt(i);
      var idx = '0123456789bcdefghjkmnpqrstuvwxyz'.indexOf(chr);
      if (idx == -1) throw new Error('Invalid geohash');

      for (var n = 4; n >= 0; n--) {
        var bitN = idx >> n & 1;
        if (evenBit) {
          // longitude
          var lonMid = (lonMin + lonMax) / 2;
          if (bitN == 1) {
            lonMin = lonMid;
          } else {
            lonMax = lonMid;
          }
        } else {
          // latitude
          var latMid = (latMin + latMax) / 2;
          if (bitN == 1) {
            latMin = latMid;
          } else {
            latMax = latMid;
          }
        }
        evenBit = !evenBit;
      }
    }

    return { sw: { lat: latMin, lon: lonMin }, ne: { lat: latMax, lon: lonMax } };
  }

  return mapHandler;
};
