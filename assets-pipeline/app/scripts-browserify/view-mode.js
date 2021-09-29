'use strict';

// Set default view mode to list.
var viewMode = 'list';

$('.let-it-grow').addClass(`is-${viewMode}-view`);

// Desktop.
$('#filterbar .view-mode').on('click', '[data-action="show-view-list"]', function() {
  $('.let-it-grow').trigger('search:viewModeChanged', ['list']);
});
$('#filterbar .view-mode').on('click', '[data-action="show-view-map"]', function() {
  $('.let-it-grow').trigger('search:viewModeChanged', ['map']);
});

// Mobile.
$('#filterbar--mobile .filterbar--mobile__container').on('click', '[data-action="show-view-list"]', function() {
  $('.let-it-grow').trigger('search:viewModeChanged', ['list']);
});
$('#filterbar--mobile .filterbar--mobile__container').on('click', '[data-action="show-view-map"]', function() {
  $('.let-it-grow').trigger('search:viewModeChanged', ['map']);
});

$('.let-it-grow').on('search:viewModeChanged', function (e, eventViewMode) {
  viewMode = eventViewMode;
  const toggledFrom = (viewMode === 'list') ? 'map' : 'list';

  // Switch view-mode on element with 'let-it-grow' class.
  $('.let-it-grow').removeClass('is-' + toggledFrom + '-view').addClass('is-' + viewMode + '-view');

  // Button is in a container that contains elements we want to react on the
  // change.
  var $viewModes = $('#filterbar .view-mode');

  // Deactivate everything.
  $viewModes.find('.filterbar__tab').removeClass('filterbar__tab--active');

  // mobile
  $('.let-it-grow').removeClass('is-' + toggledFrom + '-view').addClass('is-' + viewMode + '-view');
});

