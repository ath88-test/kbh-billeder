$('[data-action="toggle-sidebar-menu"], .gray-overlay').click(function() {
  var wasOpen = $('body').hasClass('sidebar-menu-open');
  $('body').toggleClass('sidebar-menu-open');

  if(wasOpen) {
    $('[data-action="toggle-sidebar-menu"]').attr('aria-label', 'Åbn menu');
  }
  else {
    $('[data-action="toggle-sidebar-menu"]').attr('aria-label', 'Luk menu');
    $('.sidebar-menu a').first().focus();
  }
});

$('[data-action="toggle-sidebar-submenu-item"]').click(function() {
  $(this).parent('li').find('.children').toggleClass('hidden');
  $(this).parent('.sidebar-menu__children').toggleClass('sidebar-menu__children--inactive');
  $(this).parent('.sidebar-menu__children').attr('aria-expanded', function (i, attr) {
    return attr == 'true' ? 'false' : 'true';
  });
});