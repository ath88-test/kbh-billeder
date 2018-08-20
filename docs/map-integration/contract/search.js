﻿'use strict';

//MapController for demo purpose
var MC = (function () {

  function MC () {
    var onMoveStart = function (mapHandler) {
      console.log("move start");
      mapHandler.clear();
    };

    var onMoveEnd = function (mapHandler) {
      console.log("move end");
      console.log("New center");
      console.log(mapHandler.getCenter());

      //STATIC demonstration
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'search-asset-list.json', true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      xhr.onload = function (e) {
        console.log("Showing");
        mapHandler.show(JSON.parse(xhr.responseText));
      };
      xhr.send(null);

      ////DYNAMIC demonstration (using kbhbilleder.dk/api)
      //var boundingBox = mapHandler.getBoundingBox();
      //var xhr = new XMLHttpRequest();
      //xhr.open("POST", "https://kbhbilleder.dk/api/_search?size=0&_source=location%2Clongitude%2Clatitude%2Ccollection%2Cid%2Cshort_title%2Ctype", true);
      //xhr.setRequestHeader('Content-Type', 'application/json')
      //xhr.onload = function (e) {
      //  var data = JSON.parse(xhr.responseText);
      //  var assets = [];
      //  for (var i = 0, buckets = data.aggregations.geohash_grid.buckets; i < buckets.length; i++) {
      //    var bucket = buckets[i];
      //    assets.push({
      //      "geohash" : bucket.key,
      //      "clustered": true,
      //      "count": bucket.doc_count
      //    })
      //  }
      //  mapHandler.show(assets);
      //}
      //xhr.send(JSON.stringify({ "query": { "boosting": { "positive": { "bool":
      // { "must": [{ "bool": { "must_not": { "term": {
      //   "related.assets.direction": "parent" } } } }, { "bool": { "should": [{
      //     "bool": { "should": [{ "exists": { "field": "google_maps_coordinates" }
      //     }, { "exists": { "field": "google_maps_coordinates_crowd" } }] } }] } },
      // { "geo_bounding_box": { "location": { "top_left": { "lat":
      // boundingBox.topLeft.latitude, "lon": boundingBox.topLeft.longitude }, "bottom_right": { "lat":
      // boundingBox.bottomRight.latitude, "lon": boundingBox.bottomRight.longitude } } } }] } }, "negative":
      // { "query_string": { "default_operator": "OR", "default_field":
      // "tags_vision", "query": "" } }, "negative_boost": 0.5 } }, "sort":
      // "_score", "aggregations": { "geohash_grid": { "geohash_grid": { "field": 
      //   "location", "precision": 6 } } } }));

    };

    var onPopupClick = function (id) {
      console.log("popup click with id: " + id);
    }

    //create and init map object
    this.map = Map(
      document.getElementById('map'),
      {
        center: [12.8, 55.67],
        zoomLevel: 10,
        clusterAtZoomLevel: 11,
        onMoveStart: onMoveStart,
        onMoveEnd: onMoveEnd,
        onPopupClick: onPopupClick,
        icons: {
          clusterSmall: '/app/images/icons/map/m1.png',
          clusterMedium: '/app/images/icons/map/m2.png',
          clusterLarge: '/app/images/icons/map/m3.png',
          asset: '/app/images/icons/map/pin.png',
          assetHeading: '/app/images/icons/map/pinheading.png'
        }
      }
    );
  }

  return MC;
}());

window.onload = function () {
  //create and init map controller object
  var mc = new MC();
};
