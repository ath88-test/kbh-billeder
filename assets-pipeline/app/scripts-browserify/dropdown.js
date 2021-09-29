var hideAllDropdowns = function(e) {
  var $target = $(e.target);
  var $dropdown = $target.closest('.dropdown');
  var isInputInDropdown = $target.is('input') || $dropdown.size() > 0;
  if (isInputInDropdown === false) {
    $('.dropdown').removeClass('dropdown--active');
    $('.dropdown').attr('aria-expanded', false);
    $('body').off('click', hideAllDropdowns);
  }
};

$('body').on('keypress click', '.dropdown__selected', function(e) {
  if (e.which === 13 || e.type === 'click') {
    var $this = $(this);
    var $dropdown = $this.closest('.dropdown');
    var wasActive = $dropdown.hasClass('dropdown--active');

    $('.dropdown').removeClass('dropdown--active');
    $('.dropdown').attr('aria-expanded', false);

    if (wasActive === true) {
      return;
    }

    $('body').off('click', hideAllDropdowns);

    $dropdown.addClass('dropdown--active');
    $dropdown.attr('aria-expanded', true);

    // Clicking an option in a dropdown makes it deactivate
    $dropdown.on('click', '.dropdown__options a', function() {
      $dropdown.removeClass('dropdown--active');
      $dropdown.attr('aria-expanded', false);
    });

    setTimeout(function() {
      $('body').on('click', hideAllDropdowns);
    }, 1);
  }
});
