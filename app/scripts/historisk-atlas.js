'use strict';

/**
 * Read in options and set defaults.
 */
function _prepareMapOptions (options) {
  if (!options) {
    options = {};
  }

  if (!options.center) {
    options.center = [12.58, 55.67];
  }

  if (!options.zoomLevel) {
    options.zoomLevel = 12;
  }

  if (!options.clusterAtZoomLevel) {
    options.clusterAtZoomLevel = 11;
  }

  if (!options.onMoveStart) {
    options.onMoveStart = function () {};
  }

  if (!options.onMoveEnd) {
    options.onMoveEnd = function () {};
  }

  if (!options.onPopupClick) {
    options.onPopupClick = function (id) { };
  }

  options.maps = options.maps || [
    { id: 161, title: 'Standard', year: '2018' },
    { id: 85, title: 'Luftfoto', year: '2016' },
    { id: 39, title: '4 cm kort', year: '1977-85' },
    { id: 38, title: '4 cm kort', year: '1953-76' },
    { id: 105, title: 'K�benhavn', year: '1939' },
    { id: 54, title: 'Lavkantkort', year: '1901-1945' },
    { id: 55, title: 'H�jkantkort', year: '1840-1899' },
    { id: 154, title: 'Geddes kort', year: '1761' }
  ];

  return options;
}

/**
 * Setup a map instance and wrap it in an object containing references to
 * everything we'll need to handle the map going forward.
 */
function _prepareMap(mapElement, center, zoomLevel, icons, mode, maps, onTimeWarpToggle) {
  // Collect any map-related objects we're going to be referencing in the rest
  // of the setup and in callbacks.
  var mapState = {};

  mapState.mapElement = mapElement;

  mapState.mapSelectControl = function () {
    mapState.mapSelectElement = document.createElement('select');
    mapState.mapSelectElement.addEventListener('change', function (event) {      
      var source = mapState.isMultiMode() ? mapState.timeWarp.getSource() : mapState.rasterLayer.getSource();
      source.setUrl(mapState.getMapUrl(mapState.mapSelectElement.value));
    }, false);

    for (var i = 0; i < maps.length; i++) {
      var elementOption = document.createElement('option');
      elementOption.value = maps[i].id;
      elementOption.innerText = maps[i].title + ' ' + maps[i].year;
      mapState.mapSelectElement.appendChild(elementOption);
    }

    var element = document.createElement('div');
    element.id = 'mapSelect';
    element.className = 'ol-unselectable ol-control';
    element.appendChild(mapState.mapSelectElement);

    ol.control.Control.call(this, {
      element: element
    });
  };
  ol.inherits(mapState.mapSelectControl, ol.control.Control);

  mapState.getMapUrl = function(id) {
    return 'https://tile.historiskatlas.dk/tile/a2JoYmlsbG/' + id + '/{z}/{x}/{y}.jpg';
  }

  mapState.vectorSource = new ol.source.Vector({
    features: []
  });
  mapState.clusterSource = new ol.source.Cluster({
    distance: 70,
    source: mapState.vectorSource
  });

  var styleCache = {};
  var featureIcons = [, icons.clusterSmall, icons.clusterMedium, icons.clusterLarge];

  mapState.vectorLayer = new ol.layer.Vector({
    source: mode == 'single' ? mapState.vectorSource : mapState.clusterSource,
    updateWhileInteracting: true,
    updateWhileAnimating: true,
    style: function (feature) {
      var subFeatures = feature.get('features');
      if (!subFeatures)
        subFeatures = [feature];

      if (subFeatures.length == 1) {
        if (!subFeatures[0].asset)
          return subFeatures[0].getStyle();
        if (!subFeatures[0].asset.clustered)
          return subFeatures[0].getStyle();
      }

      //var style = feature.getStyle()
      //if (style)
      //  return style;

      var count = 0;
      for (var i = 0; i < subFeatures.length; i++) {
        count += subFeatures[i].asset.count;
      }
      var style = styleCache[count];
      if (!style) {
        style = new ol.style.Style({
          image: new ol.style.Icon({
            src: featureIcons[Math.min(count.toString().length, 3)]
          }),
          text: new ol.style.Text({
            text: count.toString(),
            font: '11px Arial, sans-serif',
            fill: new ol.style.Fill({
              color: '#e32166'
            }),
            stroke: new ol.style.Stroke({
              color: '#fff',
              width: 3
            })
          })
        });
        styleCache[count] = style;
      }
      return style;
    }
  });

  mapState.view = new ol.View({
    center: ol.proj.fromLonLat(center),
    zoom: zoomLevel
  });

  mapState.rasterLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: mapState.getMapUrl(161)
    })
  });

  var minus = document.createElement('span')
  minus.innerHTML = '&minus;'
  mapState.map = new ol.Map({
    target: mapElement,
    layers: [mapState.rasterLayer, mapState.vectorLayer],
    view: mapState.view,
    controls: [new ol.control.Zoom({
      zoomOutLabel: minus
    }), new mapState.mapSelectControl()],
    interactions: [new ol.interaction.DragPan(), new ol.interaction.PinchRotate(), new ol.interaction.PinchZoom(), new ol.interaction.MouseWheelZoom()],
    loadTilesWhileInteracting: true,
    loadTilesWhileAnimating: true
  });

  //Create popup
  mapElement.insertAdjacentHTML('beforeend', '<div id="mapPopup"><div id="mapPopupImage"></div><div id="mapPopupClose"></div><div id="mapPopupHeading"></div><div id="mapPopupDescription"></div></div>');
  mapState.mapPopupElement = document.getElementById('mapPopup');

  mapState.mapSelectDivElement = document.getElementById('mapSelect');
  if (mode == 'single') {
    mapState.mapSelectDivElement.style.display = 'block';
    mapState.mapSelectDivElement.style.bottom = '18px';
    mapState.mapSelectDivElement.style.right = '18px';
  } else
    mapState.timeWarp = _prepareTimeWarp(mapState.map, mapElement, mapState.mapSelectDivElement, mapState.getMapUrl, onTimeWarpToggle);

  return mapState;
}

function _prepareTimeWarp(map, mapElement, mapSelectDivElement, getMapUrl, onTimeWarpToggle) {

  var timeWarp = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: getMapUrl(55)
    })
  });

  timeWarp.setVisible(false);
  map.getLayers().insertAt(1, timeWarp);

  timeWarp.modes = { CIRCLE: 0, SPLIT: 1 };
  timeWarp.mode = timeWarp.modes.CIRCLE;

  timeWarp.dragModes = { NONE: 0, CIRCLE_RADIUS: 1, CIRCLE_MOVE: 2, SPLIT: 3 }
  timeWarp.dragMode = timeWarp.dragModes.NONE;

  timeWarp.position = [300, 300];
  timeWarp.radius = 200;
  timeWarp.minRadius = 100;
  //timeWarp.radiusDisplace;
  timeWarp.rectWidth = 2;
  //timeWarp.rectX;
  timeWarp.lineWidth = 4.0;

  //timeWarp.listenerKeyPointerDrag;
  //timeWarp.listenerKeyPointerMove;

  timeWarp.closeControl = function () {
    timeWarp.closeElement = document.createElement('div');
    timeWarp.closeElement.id = 'timeWarpClose';
    timeWarp.closeElement.className = 'ol-unselectable ol-control time-warp-button';
    timeWarp.closeElement.addEventListener('click', function (event) {
      timeWarp.hide();
      if (onTimeWarpToggle)
        onTimeWarpToggle();
    }, false);
    ol.control.Control.call(this, {
      element: timeWarp.closeElement
    });
  };
  ol.inherits(timeWarp.closeControl, ol.control.Control);
  map.addControl(new timeWarp.closeControl());

  timeWarp.modeControl = function () {
    timeWarp.modeElement = document.createElement('div');
    timeWarp.modeElement.id = 'timeWarpMode';
    timeWarp.modeElement.className = 'ol-unselectable ol-control time-warp-button';
    timeWarp.modeElement.addEventListener('click', function (event) {
      timeWarp.mode = timeWarp.mode == timeWarp.modes.CIRCLE ? timeWarp.modes.SPLIT : timeWarp.modes.CIRCLE
      if (timeWarp.mode == timeWarp.modes.SPLIT) {
        timeWarp.rectX = map.getSize()[0] / 2;
        timeWarp.rectWidth = map.getSize()[0] - timeWarp.rectX + timeWarp.lineWidth / 2.0;
        timeWarp.modeElement.className = 'ol-unselectable ol-control time-warp-button split'
      } else
        timeWarp.modeElement.className = 'ol-unselectable ol-control time-warp-button'
      timeWarp.updateControls();
      map.renderSync();
    }, false);
    ol.control.Control.call(this, {
      element: timeWarp.modeElement
    });
  };
  ol.inherits(timeWarp.modeControl, ol.control.Control);
  map.addControl(new timeWarp.modeControl());

  timeWarp.precomposeTimeWarp = function(event) {
    var ctx = event.context;
    timeWarp.pixelRatio = event.frameState.pixelRatio;
    this.applyPath(ctx);
    ctx.save();
    ctx.clip();
  }
  timeWarp.on('precompose', timeWarp.precomposeTimeWarp);

  timeWarp.postcomposeTimeWarp = function (event) {
    var ctx = event.context;
    ctx.restore();
    timeWarp.applyPath(ctx);
    if (timeWarp.position) {
      ctx.strokeStyle = '#e61a64';
      ctx.lineWidth = timeWarp.lineWidth * timeWarp.pixelRatio;
      ctx.stroke();

    }
  }
  timeWarp.on('postcompose', timeWarp.postcomposeTimeWarp);

  timeWarp.applyPath = function (ctx) {
    var x = timeWarp.position[0] * timeWarp.pixelRatio;
    var y = timeWarp.position[1] * timeWarp.pixelRatio;
    ctx.beginPath();
    switch (timeWarp.mode) {
      case timeWarp.modes.CIRCLE:
        ctx.arc(x, y, timeWarp.radius * timeWarp.pixelRatio, 0, 2 * Math.PI);
        break;
      case timeWarp.modes.SPLIT:
        var rectY = -10.0;
        var rectHeight = map.getSize()[1] + 20.0;
        ctx.rect((timeWarp.rectX * timeWarp.pixelRatio), (rectY * timeWarp.pixelRatio), (timeWarp.rectWidth * timeWarp.pixelRatio), (rectHeight * timeWarp.pixelRatio));
        break;
    }
  }

  timeWarp.show = function() {
    timeWarp.mode = timeWarp.modes.CIRCLE;
    var size = map.getSize();
    timeWarp.position = [size[0] / 2, size[1] / 2];
    timeWarp.radius = Math.min(size[0], size[1]) * 0.3;
    timeWarp._show();
  }
  timeWarp._show = function() {
    mapElement.addEventListener('touchstart', timeWarp.touchDownEventHandle = function (event) { timeWarp.touchDown(event.originalEvent) });
    window.addEventListener('touchend', timeWarp.touchUpEventHandle = function (event) { timeWarp.touchUp(event.originalEvent) });
    mapElement.addEventListener('mousedown', timeWarp.downEventHandle = function (event) { timeWarp.down([event.pageX, event.pageY]) });
    window.addEventListener('mouseup', timeWarp.upEventHandle = function (event) { timeWarp.up() });
    timeWarp.listenerKeyPointerDrag = map.on('pointerdrag', (event) => { timeWarp.pointerDrag(event); });
    timeWarp.setVisible(true);
    mapSelectDivElement.style.display = 'block';
    timeWarp.closeElement.style.display = 'block';
    timeWarp.modeElement.style.display = 'block';
    timeWarp.updateControls();
  }

  timeWarp.hide = function () {
    mapElement.removeEventListener('touchstart', timeWarp.touchDownEventHandle);
    window.removeEventListener('touchend', timeWarp.touchUpEventHandle);
    mapElement.removeEventListener('mousedown', timeWarp.downEventHandle);
    window.removeEventListener('mouseup', timeWarp.upEventHandle);
    ol.Observable.unByKey(this.listenerKeyPointerDrag);
    timeWarp.setVisible(false);
    mapSelectDivElement.style.display = 'none';
    timeWarp.closeElement.style.display = 'none';
    timeWarp.modeElement.style.display = 'none';
  }

  timeWarp.updateControls = function () {
    mapSelectDivElement.style.left = timeWarp.mode == timeWarp.modes.CIRCLE ? (timeWarp.position[0] - mapSelectDivElement.clientWidth / 2) + 'px' : null;
    mapSelectDivElement.style.top = timeWarp.mode == timeWarp.modes.CIRCLE ?(timeWarp.position[1] + timeWarp.radius - 21) + 'px' : null;
    mapSelectDivElement.style.right = timeWarp.mode == timeWarp.modes.CIRCLE ? null : '18px';
    mapSelectDivElement.style.bottom = timeWarp.mode == timeWarp.modes.CIRCLE ? null : '18px';

    timeWarp.updateButton(timeWarp.closeElement, timeWarp.mode == timeWarp.modes.CIRCLE, timeWarp.mode == timeWarp.modes.CIRCLE ? -Math.PI / 4 - 22 / timeWarp.radius : 18)
    timeWarp.updateButton(timeWarp.modeElement, timeWarp.mode == timeWarp.modes.CIRCLE, timeWarp.mode == timeWarp.modes.CIRCLE ? -Math.PI / 4 + 22 / timeWarp.radius : 62)
  }
  timeWarp.updateButton = function (element, circle, radians) {
    element.style.left = circle ? (timeWarp.position[0] + Math.cos(radians) * timeWarp.radius - element.clientWidth / 2) + 'px' : null;
    element.style.top = circle ? (timeWarp.position[1] + Math.sin(radians) * timeWarp.radius - element.clientWidth / 2) + 'px' : radians + 'px';
    element.style.right = circle ? null : '18px';
  }

  timeWarp.touchDown = function(event) {
    timeWarp.lastTouchDist = 0;
    timeWarp.lastTouchDist = timeWarp.touchDistFromTouches(event.touches);
    timeWarp.down(timeWarp.centerCoordFromTouches(event.touches));
  }
  timeWarp.down = function(coord, forceMove) {
    var offset = mapElement.getBoundingClientRect();
    coord = [coord[0] - offset.left, coord[1] - offset.top];
    var dist = Math.sqrt(Math.pow(timeWarp.position[0] - coord[0], 2) + Math.pow(timeWarp.position[1] - coord[1], 2));
    if (timeWarp.position && timeWarp.mode == timeWarp.modes.CIRCLE) {
      if (dist < (timeWarp.radius + 8) && dist > (timeWarp.radius - 8) && !forceMove) {
        timeWarp.dragMode = timeWarp.dragModes.CIRCLE_RADIUS;
        timeWarp.radiusDisplace = timeWarp.radius - dist;
      }
      else if (dist < timeWarp.radius) {
        timeWarp.dragMode = timeWarp.dragModes.CIRCLE_MOVE;
        timeWarp.mouseDisplace = [timeWarp.position[0] - coord[0], timeWarp.position[1] - coord[1]]
      }
      else
        timeWarp.dragMode = timeWarp.dragModes.NONE;
    }
    else if (timeWarp.position && timeWarp.mode == timeWarp.modes.SPLIT) {
      var displace = timeWarp.rectX - coord[0];
      if (Math.abs(displace) < 8) {
        timeWarp.dragMode = timeWarp.dragModes.SPLIT;
        timeWarp.mouseDisplace = [displace, 0];
      }
    } else
      timeWarp.dragMode = timeWarp.dragModes.NONE;
  }

  timeWarp.pointerDrag = function(event) {
    var newposition = event.originalEvent.type == 'touchmove' ? timeWarp.centerCoordFromTouches(event.originalEvent.touches, true) : (event.pixel ? event.pixel : [event.offsetX, event.offsetY]);
    switch (timeWarp.dragMode) {
      case timeWarp.dragModes.CIRCLE_RADIUS:
        var dist = Math.sqrt(Math.pow(timeWarp.position[0] - newposition[0], 2) + Math.pow(timeWarp.position[1] - newposition[1], 2));
        dist += timeWarp.radiusDisplace;
        timeWarp.radius = dist > timeWarp.minRadius ? dist : timeWarp.minRadius;
        event.preventDefault();
        break;
      case timeWarp.dragModes.CIRCLE_MOVE:
        timeWarp.position = [newposition[0] + timeWarp.mouseDisplace[0], newposition[1] + timeWarp.mouseDisplace[1]];
        if (event.originalEvent.type == 'touchmove') {
          var touchDist = timeWarp.touchDistFromTouches(event.originalEvent.touches);
          timeWarp.radius += touchDist - timeWarp.lastTouchDist;
          timeWarp.radius = timeWarp.radius < timeWarp.minRadius ? timeWarp.minRadius : timeWarp.radius;
          timeWarp.lastTouchDist = touchDist;
        }
        event.preventDefault();
        break;
      case timeWarp.dragModes.SPLIT:
        timeWarp.rectX = newposition[0] + timeWarp.mouseDisplace[0];
        timeWarp.rectWidth = map.getSize()[0] - timeWarp.rectX + timeWarp.lineWidth / 2.0;
        event.preventDefault();
        break;
    }
    map.renderSync();
    timeWarp.updateControls();
  }

  timeWarp.centerCoordFromTouches = function(touches, relative) {
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

  timeWarp.touchDistFromTouches = function(touches) {
    if (touches.length < 2)
      return timeWarp.lastTouchDist;

    if (Math.sqrt(Math.pow(timeWarp.position[0] - touches[0].pageX, 2) + Math.pow(timeWarp.position[1] - touches[0].pageY, 2)) > timeWarp.radius + 8)
      return timeWarp.lastTouchDist;

    if (Math.sqrt(Math.pow(timeWarp.position[0] - touches[1].pageX, 2) + Math.pow(timeWarp.position[1] - touches[1].pageY, 2)) > timeWarp.radius + 8)
      return timeWarp.lastTouchDist;

    return Math.sqrt(Math.pow(touches[0].pageX - touches[1].pageX, 2) + Math.pow(touches[0].pageY - touches[1].pageY, 2));
  }

  timeWarp.touchUp = function(event)
  {
    if(event.touches.length == 0)
      timeWarp.up();
    else
      timeWarp.touchDown(event);
  }

  timeWarp.up = function() {
    clearInterval(timeWarp.intervalHandle);
    timeWarp.intervalHandle = null;
    timeWarp.dragMode = timeWarp.dragModes.NONE;
  }

  timeWarp.getHoverInterface = function(pixel) {
    if (!timeWarp.getVisible())
      return '';

    if (timeWarp.mode == timeWarp.modes.SPLIT)
      return Math.abs(timeWarp.rectX - pixel[0]) < 8 ? 'ew-resize' : '';

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
      if (dist < timeWarp.radius)
        return 'move';
    }

    return '';
  }

  return timeWarp;
}

/**
 * Integration between kbhbilleder and a map-provider.
 */
function HistoriskAtlas(mapElement, options) {
  // Clean up our options.
  options = _prepareMapOptions(options);

  // Then prepare the map for use and get a state object we can use to interact
  // with the map.
  var mapState = _prepareMap(mapElement, options.center, options.zoomLevel, options.icons, options.mode, options.maps, options.onTimeWarpToggle);

  // Setup handler functions the client will use to interact with the map - ie.
  // we never expose the mapState to the user, only handler functions.
  var mapHandler = {};

  // TODO: Document handler functions, and deside whether "handler" is the
  // best name.
  mapHandler.toggleTimeWarp = function () {

    if (mapState.timeWarp.getVisible())
      mapState.timeWarp.hide();
    else
      mapState.timeWarp.show();
  }

  mapHandler.show = function (assets) {
    mapState.vectorSource.clear(true);
    var features = [];
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i];
      var coords = asset.geohash ? mapState.getCoordinateFromGeohash(asset.geohash) : [asset.longitude, asset.latitude];
      var feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(coords))
      });
      if (!asset.clustered)
        feature.setStyle(mapHandler.getFeatureStyle(asset));
      feature.asset = asset;
      features.push(feature);

      if (mapState.feature && mapState.isMultiMode()) {
        if (asset.id == mapState.feature.asset.id) {
          mapState.feature = feature;
          mapState.feature.setStyle(mapHandler.getFeatureStyle(feature, true))
        }
      }
    }
    mapState.vectorSource.addFeatures(features);
    if (features.length > 0) {
      if (mapState.isSingleOrEditMode())
        mapState.feature = features[0];
      else {
        if (mapState.feature)
          mapState.showPopup(mapState.feature, mapState.map.getPixelFromCoordinate(mapState.feature.getGeometry().getCoordinates()))
      }
    }
  };

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

    return style
  }

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

  mapHandler.getCenter = function () {
    var center = ol.proj.toLonLat(mapState.view.getCenter());
    return {
      longitude: center[0],
      latitude: center[1]
    };
  };

  mapHandler.clear = function () {
    mapState.vectorSource.clear(true);
  };
  mapHandler.getZoomLevel = function () {
    return mapState.view.getZoom();
  };
  mapHandler.toggleEditMode = function () {
    options.mode = options.mode == 'edit' ? 'single' : 'edit'
    
    if (options.mode == 'edit') {

      mapHandler.translate = new ol.interaction.Translate({
        features: new ol.Collection([mapState.feature])
      });
      mapHandler.translate.on('translating', mapState.translating);
      mapState.map.addInteraction(mapHandler.translate);

      if (mapState.feature.asset.heading) {
        var coordinates = mapState.feature.getGeometry().getCoordinates()
        var pixel = mapState.map.getPixelFromCoordinate(coordinates);
        var radian = (mapState.feature.asset.heading - 90) * (Math.PI / 180);
        pixel[0] += Math.cos(radian) * 120;
        pixel[1] += Math.sin(radian) * 120;
        var targetCoordinates = mapState.map.getCoordinateFromPixel(pixel);
        
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

        mapState.targetFeature = new ol.Feature({
          geometry: new ol.geom.Point(targetCoordinates)
        });
        mapState.targetFeature.setStyle(mapHandler.getTargetFeatureStyle(mapState.feature.asset));

        mapState.vectorSource.addFeature(mapState.targetFeature);
        mapHandler.translateTarget = new ol.interaction.Translate({
          features: new ol.Collection([mapState.targetFeature])
        });
        mapHandler.translateTarget.on('translating', mapState.translating);
        mapState.map.addInteraction(mapHandler.translateTarget);
      }
    } else {
      if (mapState.targetFeature) {
        mapState.vectorSource.removeFeature(mapState.targetFeature);
        mapState.vectorSource.removeFeature(mapState.lineFeature);
      }
      mapState.map.removeInteraction(mapHandler.translate);
      mapState.map.removeInteraction(mapHandler.translateTarget);
    }

    mapState.feature.setStyle(mapHandler.getFeatureStyle(mapState.feature.asset));

    return mapState.feature.asset;
  };

  mapState.translating = function (feature) {
    var coordinates = mapState.feature.getGeometry().getCoordinates();

    if (mapState.targetFeature) { 
      var targetCoordinates = mapState.targetFeature.getGeometry().getCoordinates();
      var pixel = mapState.map.getPixelFromCoordinate(coordinates);
      var pixelTarget = mapState.map.getPixelFromCoordinate(targetCoordinates);
      mapState.feature.asset.heading = (Math.atan2(pixel[1] - pixelTarget[1], pixel[0] - pixelTarget[0]) * 180 / Math.PI + 270) % 360;
    }

    var lonLat = ol.proj.toLonLat(coordinates);
    mapState.feature.asset.longitude = lonLat[0];
    mapState.feature.asset.latitude = lonLat[1];

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
  mapState.isMultiMode = function () {
    return options.mode == 'multi' || !options.mode;
  }

  // Event handling - integrate the clients event handlers.
  mapState.map.on('movestart', function (event) {
    options.onMoveStart(mapHandler);
  });
  mapState.map.on('moveend', function (event) {
    if (!mapState.isSingleMode() && !mapState.isEditMode())
      mapState.vectorLayer.setSource(options.clusterAtZoomLevel < mapState.view.getZoom() ? mapState.vectorSource : mapState.clusterSource);
    options.onMoveEnd(mapHandler);
  });

  mapState.map.on('pointermove', function (event) {
    if (mapState.isSingleMode())
      return;

    var hoverFeature;
    var pixel = mapState.map.getEventPixel(event.originalEvent);
    mapState.map.forEachFeatureAtPixel(pixel, function (feature) {
      if (feature != mapState.lineFeature) {
        hoverFeature = feature;
        return true;
      }
    });
    mapState.mapElement.style.cursor = hoverFeature ? (mapState.isEditMode() ? 'move' : 'pointer') : (mapState.timeWarp ? mapState.timeWarp.getHoverInterface(pixel) : '');
  })
  mapState.map.on('pointerdrag', function (event) {
    mapState.hidePopup();
    //  if (mapState.isSingleMode())
  //    return;

  //  var pixel = mapState.map.getEventPixel(event.originalEvent);
  //  mapState.mapElement.style.cursor = mapState.timeWarp.getHoverInterface(pixel);
  })

  mapState.map.getView().on('change:resolution', function () {
    mapState.hidePopup();
  });

  mapState.map.on('click', function (event) {
    if (mapState.isSingleMode() || mapState.isEditMode())
      return;

    var clickFeature;
    mapState.map.forEachFeatureAtPixel(mapState.map.getEventPixel(event.originalEvent), function (feature) { clickFeature = feature; return true; });
    mapState.hidePopup();

    if (!clickFeature)
      return;

    var subFeatures = clickFeature.get('features');
    if (!subFeatures)
      subFeatures = [clickFeature];

    var asset = subFeatures[0].asset;

    if (subFeatures.length == 1 && !asset.clustered) {
      var pixel = mapState.map.getPixelFromCoordinate(clickFeature.getGeometry().getCoordinates());

      if (pixel[1] < 310 || pixel[0] < 225 || pixel[0] > mapState.map.getSize()[0] - 225) {
        mapState.feature = subFeatures[0];
        pixel[1] -= 155;
        mapState.view.animate({
          center: mapState.map.getCoordinateFromPixel(pixel),
          duration: 500
        }, function () {
          //mapState.showPopup(subFeatures[0], mapState.map.getPixelFromCoordinate(clickFeature.getGeometry().getCoordinates()))
        });
        return;
      }
      
      mapState.showPopup(subFeatures[0], pixel)
      return;
    }

    mapState.view.animate({
      center: clickFeature.getGeometry().getCoordinates(),
      duration: 1000,
      zoom: mapState.view.getZoom() + 2
    });
  })

  mapState.mapPopupElement.addEventListener('click', function () {
    options.onPopupClick(mapState.mapPopupElement.assetId);
  })

  document.getElementById('mapPopupClose').addEventListener('click', function (evt) {
    mapState.hidePopup();
    evt.stopPropagation();
  })

  mapState.showPopup = function (feature, pixel) {
    mapState.feature = feature;
    feature.setStyle(mapHandler.getFeatureStyle(feature.asset, true))

    //var offset = mapElement.getBoundingClientRect();
    //pixel = [pixel[0] + offset.left, pixel[1] + offset.top];
    mapState.mapPopupElement.style.left = (pixel[0] - 110) + 'px';
    mapState.mapPopupElement.style.top = (pixel[1] - 315) + 'px';
    document.getElementById('mapPopupImage').style.backgroundImage = "url('" + feature.asset.image_url + "')";
    document.getElementById('mapPopupHeading').innerText = feature.asset.short_title;
    document.getElementById('mapPopupDescription').innerText = feature.asset.description;
    mapState.mapPopupElement.style.display = 'block';
    mapState.mapPopupElement.assetId = feature.asset.id;
  }

  mapState.hidePopup = function () {
    mapState.mapPopupElement.style.display = 'none';
    if (mapState.feature && mapState.isMultiMode()) {
      mapState.feature.setStyle(mapHandler.getFeatureStyle(mapState.feature.asset))
      mapState.feature = null;
    }
  }

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

  mapState.getBoundsFromGeohash = function (geohash) {
    if (geohash.length === 0) throw new Error('Invalid geohash');

    geohash = geohash.toLowerCase();

    var evenBit = true;
    var latMin =  -90, latMax =  90;
    var lonMin = -180, lonMax = 180;

    for (var i=0; i<geohash.length; i++) {
      var chr = geohash.charAt(i);
      var idx = '0123456789bcdefghjkmnpqrstuvwxyz'.indexOf(chr);
      if (idx == -1) throw new Error('Invalid geohash');

      for (var n=4; n>=0; n--) {
        var bitN = idx >> n & 1;
        if (evenBit) {
          // longitude
          var lonMid = (lonMin+lonMax) / 2;
          if (bitN == 1) {
            lonMin = lonMid;
          } else {
            lonMax = lonMid;
          }
        } else {
          // latitude
          var latMid = (latMin+latMax) / 2;
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

// TODO - integrate into the site.
// module.exports = Map;