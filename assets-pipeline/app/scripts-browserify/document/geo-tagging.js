'use strict';
/**
 * Injects a map into each .geo-tagging-mini-map div.
 */
$(function ($) {
  const _ = require('lodash');
  const START_GEO_TAGGING_SELECTOR = '[data-action="geo-tagging:start"]';
  const ADD_HEADING_SELECTOR = '[data-action="geo-tagging:add-direction"]';
  const STOP_GEOTAGGING_SELECTOR = '[data-action="geo-tagging:stop"]';
  const SAVE_GEO_TAG_SELECTOR = '[data-action="save-geo-tag"]';
  const INIT_GEO_TAGGING_SELECTOR = '[data-action="geo-tagging:init"]';
  const DATA_SECTION_NO_LOCATION = '.document__section-2--no-location';
  const MAP_SECTION_SELECTOR = '.document__section-2--map';
  const MAP_ELEMENT_SELECTOR = '.geo-tagging-mini-map';
  const config = require('../../../../shared/config');

  const controllerState = {
    assetBackup: undefined,
    assetData: undefined,
    saving: false,
    noLocation: false,
    hasHeading: false
  };

  /**
   * Determines whether the map on the asset-page has been loaded with a location.
   */
  function _map_has_location (mapElement) {
    // We have a location if has-location is not explicitly not true. This allows
    // us to have missing has-location attribute and still have a location.
    return $(mapElement).data('has-location');
  }

  /**
   * Extract information about an asset from the mapelement on an asset page.
   */
  function _extractAsset (mapElement) {
    let asset = {};
    // Extract asset differently depending on whether we have a location.
    if (controllerState.hasLocation) {
      asset.latitude = $(mapElement).data('latitude');
      asset.longitude = $(mapElement).data('longitude');
      asset.approximate = $(mapElement).data('approximate');
    }
    else {
      asset.latitude = config.geoTagging.initialCenter['lat'];
      asset.longitude = config.geoTagging.initialCenter['lon'];
    }

    // Only add heading to the asset object if we actually have one.
    if ($(mapElement).data('heading') && $(mapElement).data('heading') !== 'null') {
      asset.heading = $(mapElement).data('heading');
      controllerState.hasHeading = true;
    }
    return asset;
  }

  /**
   * Given a map element, configures a map-controller and initializes the map.
   *
   * The initialization is postponed if a location cannot be found.
   */
  function _initializeMap (mapElement) {
    // Extract asset meta-data from the div.
    controllerState.hasLocation = _map_has_location($(mapElement));
    controllerState.assetData = _extractAsset(mapElement);

    // Instantiate a map controller and load it up
    const MapController = require('../map-controller');
    const options = {
      mode: 'single',
      initialZoomLevel: 16,
      initialCenter: [controllerState.assetData.longitude, controllerState.assetData.latitude]
    };

    // Push the marker a bit to the right if we're on desktop.
    if (!window.helpers.isMobile($)) {
      options.initialOffset = [250, 0];
    }

    // Setup callbacks for the controller.
    var callBacks = {
      onDirectionRemoved: function () {
        // If the user removes heading from the place-marker, display a
        // button for adding a heading back.
        $(ADD_HEADING_SELECTOR).removeClass('hidden');
      }
    };

    var mapController = MapController(mapElement, callBacks, options);

    // Have the map display the asset if we have a location.
    if (controllerState.hasLocation) {
      mapController.onSingleResult(controllerState.assetData);
    }
    return mapController;
  }

  // Hide the edit button and show save/cancel.
  function _setStateEdit () {
    $(START_GEO_TAGGING_SELECTOR).addClass('hidden');
    $(STOP_GEOTAGGING_SELECTOR).removeClass('hidden');
    $(SAVE_GEO_TAG_SELECTOR).removeClass('hidden');
    if (!controllerState.hasHeading) {
      $(ADD_HEADING_SELECTOR).removeClass('hidden');
    }
  }

  // Hide the save/cancel button and show edit.
  function _setStateView () {
    $(START_GEO_TAGGING_SELECTOR).removeClass('hidden');
    $(STOP_GEOTAGGING_SELECTOR).addClass('hidden');
    $(SAVE_GEO_TAG_SELECTOR).addClass('hidden');
  }

  // Show the map pane and hide the data pane.
  function _setStateNoLocationStartEdit () {
    $(MAP_SECTION_SELECTOR).removeClass('hidden');
    $(DATA_SECTION_NO_LOCATION).addClass('hidden');
  }

  // Show the data pane and hide the map pane.
  function _setStateNoLocationEndEdit () {
    $(MAP_SECTION_SELECTOR).addClass('hidden');
    $(DATA_SECTION_NO_LOCATION).removeClass('hidden');
  }

  function _registerListeners (mapController) {
    function _start_edit_mode () {
      // Toggle edit mode and get the live asset
      var liveAsset = mapController.toggleEditMode(true);

      // Clone the asset so we have something to return to if the user bails
      // out.
      controllerState.assetBackup = JSON.parse(JSON.stringify(liveAsset));

      // Set button state.
      _setStateEdit();
    }

    // The user clicked "edit".
    $(document).on('click', START_GEO_TAGGING_SELECTOR, () => {
      _start_edit_mode();
    });

    // The user clicked "cancel".
    $(document).on('click', STOP_GEOTAGGING_SELECTOR, () => {
      // Switch the map back to single mode.
      mapController.toggleEditMode(false);

      // Restore the original asset.
      mapController.onSingleResult(controllerState.assetBackup);

      // Set button state.
      _setStateView();

      // If the user bailed out and started out in "no location" mode, revert
      // back to not showing the map.
      if (!controllerState.hasLocation) {
        _setStateNoLocationEndEdit();
      }
    });

    // The user clicked "add heading".
    $(document).on('click', ADD_HEADING_SELECTOR, () => {
      // Add direction to the place-marker.
      mapController.addDirection();
      $(ADD_HEADING_SELECTOR).addClass('hidden');
    });

    // The user clicked "save".
    $(document).on('click', SAVE_GEO_TAG_SELECTOR, () => {
      // Protect us against multiple clicks.
      if (controllerState.saving) {
        console.log('Already saving');
        return;
      }

      var liveAsset = mapController.toggleEditMode(false);

      // Don't store anything if the user did not make any changes.
      // If the location was approximate and the user clicks save we take it as
      // a confirmation of the location and go ahead with the save.
      if (_.isEqual(liveAsset, controllerState.assetBackup) && !liveAsset.approximate) {
        _setStateView();
        return;
      }

      controllerState.saving = true;

      var saveObject = {
        latitude: liveAsset.latitude,
        longitude: liveAsset.longitude
      };

      // Only include heading if the user specified one.
      if (liveAsset.heading || liveAsset.heading === 0) {
        saveObject.heading = liveAsset.heading;
      }

      const saveGeotagUrl = location.pathname + '/save-geotag';
      $.post(saveGeotagUrl, saveObject, () => {
        // We're done saving, lift the protection and reload the page.
        controllerState.saving = false;
        window.location.reload();
      }, 'json');

      _setStateView();
    });

    // The user clicked "edit" on an asset without a location.
    $(document).on('click', INIT_GEO_TAGGING_SELECTOR, () => {
      // Hide "no location" document info pane
      // Show map pane
      _setStateNoLocationStartEdit();

      // If the user has not previously inited the map:
      if (!$(MAP_ELEMENT_SELECTOR).data('initialized')) {
        // The asset data has already been loaded from the dom on init, pass it
        // the MapController which will trigger an init.
        mapController.onSingleResult(controllerState.assetData);
        $(MAP_ELEMENT_SELECTOR).data('initialized', true);
      }
    });
  }

  $(MAP_ELEMENT_SELECTOR).each(function (index, mapElement) {
    var mapController = _initializeMap(mapElement);
    _registerListeners(mapController);
  });
});
