'use strict';

const config = require('../../../shared/config');
const helpers = require('../../../shared/helpers');
const elasticsearchQueryBody = require('./search/es-query-body');

const elasticsearch = require('elasticsearch');
const es = new elasticsearch.Client({
  host: location.origin + '/api'
});

/**
 * Injects a map view into each .mini-map-with-query div.
 */
$(function ($) {
  const MAP_ELEMENT_SELECTOR = '.mini-map-with-query';

  function _extractQuery (mapElement) {
    // Extract asset differently depending on whether we have a location.
    let queryString = $(mapElement).data('queryString');
    
    if(!queryString.startsWith('?')) {
      throw new Error('Malformed query string in minimap: ' + queryString);
    }

    let queryParts = queryString.slice(1).split('&');
    let query = {};
    queryParts
      .map((part) => part.split('='))
      .forEach(([key, value]) => query[decodeURIComponent(key)] = decodeURIComponent(value).replace(/\+/g, ' '));
    
    if(!query.location || !query.map) {
      throw new Error('Malformed query: has no location, it seems?');
    }

    const [longitude, lattitude, zoom] = query.map.split(',');

    const filters = {};

    Object.keys(query).forEach(function(field) {
      var filter = config.search.filters[field];
      if(filter) {
        var value = query[field];
        if(!filter.skipSplit) {
          value = value.split(',');
        }
        filters[field] = value;
      }
    });

    return {
      longitude,
      lattitude,
      zoom: parseInt(zoom.slice(0, zoom.length - 1)),
      sorting: '',
      filters: filters,
      map: query.map,
      smap: query.smap,
    };
  }

  function _initializeMap (mapElement) {
    // Extract query from the div
    let data = _extractQuery($(mapElement));
    let searchParams = data;
  
    // Instantiate a map controller and load it up
    const MapController = require('./map-controller');
    const options = {
      initialZoomLevel: data.zoom,
      initialCenter: [data.longitude, data.latitude],
      mapInitParam: data.map,
      sMapInitParam: data.smap,
    };

    //Set up the flow that loads assets into the map based on the query
    const searchCallbacks = {
      refresh: function() {
        //Map controller sets some query parameters for us, which we then
        // convert to an es query, and let helpers modify.
        mapController.onUpdate(searchParams, function(searchParams) {
          let queryBody = elasticsearchQueryBody(searchParams);
          if(typeof(helpers.modifySearchQueryBody) === 'function') {
            queryBody = helpers.modifySearchQueryBody(queryBody, searchParams);
          }
    
          if (searchParams.geohash) {
            queryBody.aggregations = {
              'geohash_grid' : {
                'geohash_grid' : {
                  'field' : 'location',
                  'precision' : config.search.geohashPrecision
                }
              }
            };
          }

          const searchObject = {
            body: queryBody,
            // We only want the aggregation so we don't care about the hits.
            size: searchParams.geohash ? 0 : config.search.maxAssetMarkers,
            _source: [
              'location',
              'longitude',
              'latitude',
              'collection',
              'id',
              'short_title',
              'type',
              'heading',
              'description'
            ],
          };
    
          es.search(searchObject).then(function (response) {
            mapController.onResults(response, searchParams);
          });
        });
      }
    };

    options.keyboardNavigationHandler = true;

    var mapController = MapController(mapElement, searchCallbacks, options);
    searchCallbacks.refresh();
  }

  //Run for each map element on page
  $(MAP_ELEMENT_SELECTOR).each(function (index, mapElement) {
    _initializeMap(mapElement);
  });
});
