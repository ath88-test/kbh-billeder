/* global config */

var getSearchParams = require('./get-parameters');
var elasticsearchQueryBody = require('./es-query-body');
var elasticsearchAggregationsBody = require('./es-aggregations-body');
var generateQuerystring = require('./generate-querystring');

// How many assets should be loaded at once?
const PAGE_SIZE = 24;
module.exports.PAGE_SIZE = PAGE_SIZE;

var resultsDesired = PAGE_SIZE;
var resultsLoaded = 0;

var templates = {
  searchResultAsset: require('views/includes/search-result-asset'),
  resultsHeader: require('views/includes/results-header'),
};

// We have to listen to #sidebar since the other elements doesn't exist at
// $documentready
$(function() {

  // parseInt(window.location.hash.substr(1), 10)

  var $results = $('#results');
  var $resultsHeader = $('#results-header');

  // Update the freetext search input
  var $searchInput = $('#search-input');

  function update() {
    var searchParams = getSearchParams();
    var freetext = searchParams.filters.freetext ?
                   searchParams.filters.freetext.join(' ') :
                   '';
    $searchInput.val(freetext);

    // Get actual results from the index
    es.search({
      index: config.es.assetsIndex,
      body: elasticsearchQueryBody(searchParams, true),
      from: resultsLoaded,
      size: resultsDesired - resultsLoaded
    }).then(function (response) {
      resultsLoaded += response.hits.hits.length;
      response.hits.hits.forEach(function(asset) {
        var markup = templates.searchResultAsset({
          asset: asset._source
        });
        $results.append(markup);
      });
      $resultsHeader.html(templates.resultsHeader({
        filters: searchParams.filters,
        sorting: searchParams.sort,
        sortOptions: config.sortOptions,
        result: {
          totalCount: response.hits.total
        }
      }));
    }, function (error) {
      console.trace(error.message);
    });

    if(config.features.filterSidebar) {
      // Get aggragations for the sidebar
      es.search({
        index: config.es.assetsIndex,
        body: elasticsearchAggregationsBody(searchParams),
        size: 0
      }).then(function (response) {
        response.hits.hits.forEach(function(asset) {
          var markup = templates.searchResultAsset({
            asset: asset._source
          });
          $results.append(markup);
        });

        var sidebar = require('./filter-sidebar');
        sidebar.update(response.aggregations, searchParams.filters);
      }, function (error) {
        console.trace(error.message);
      });
    }
  }

  function changeSearchParams(searchParams) {
    // Change the URL
    if(history) {
      var qs = generateQuerystring(searchParams);
      $results.empty();
      history.pushState({}, '', location.pathname + qs);
      update();
    } else {
      throw new Error('History API is required');
    }
  }

  function enableEndlessScrolling() {
    $(window).on('scroll', function() {
      var $lastResult = $('#results .box:last-child');
      console.log('Scrolled!', $lastResult);
    });
    resultsDesired += PAGE_SIZE;
    update();
  }

  if(config.features.clientSideSearchResultRendering) {

    var elasticsearch = require('elasticsearch');
    var es = new elasticsearch.Client({
      host: location.origin + '/es',
      log: config.es.log
    });

    update();
    // When the user navigates the state, update it
    window.addEventListener('popstate', function(event) {
      update();
    }, false);

    $('#sidebar').on('click', '.btn-filter', function() {
      var action = $(this).data('action');
      var field = $(this).data('field');
      var value = $(this).data('value');
      var searchParams = getSearchParams();
      var filters = searchParams.filters;
      if(action === 'add-filter') {
        // console.log('Adding ', field, 'value', value);
        if(typeof(filters[field]) === 'object') {
          filters[field].push(value);
        } else {
          filters[field] = [value];
        }
        changeSearchParams(searchParams);
      } else if(action === 'remove-filter') {
        // console.log('Removing ', field, 'value', value);
        filters[field] = filters[field].filter(function(v) {
          return v !== value;
        });
        changeSearchParams(searchParams);
      }
    });
  }

  $('#results-header').on('click', '#sorting .dropdown__options a', function() {
    var sorting = $(this).data('value');
    var searchParams = getSearchParams();
    searchParams.sort = sorting;
    changeSearchParams(searchParams);
  });

  // Enabled the load-more button
  $('#load-more-btn').on('click', function() {
    $(this).addClass('loading');
    enableEndlessScrolling();
  });
});
