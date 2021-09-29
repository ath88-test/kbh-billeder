$(function() {
  if(typeof ga !== "undefined" && window.Cookiebot && window.Cookiebot.consent.statistics) {
    $('[data-content="asset-download"] .btn').on('click', function(){
      var href = $(this).attr('href');
      var hrefArray = href.split("/");
      var size = hrefArray[hrefArray.length-1];
      // TODO: Get the id and catalog from another element
      var id = $('.asset').data('id');
      var catalog = $('.asset').data('catalog');
      var catalogIdSize = catalog + '-' + id + '-' + size;
      ga('send', 'event', 'asset', 'download', catalogIdSize);
      console.log('send', 'event', 'asset', 'download', catalogIdSize);
    });

    $('.search-box').submit(function() {
      var text = $('.search-box input').val();
      ga('send', 'event', 'search', 'text', text);
      console.log('send', 'event', 'search', 'text', text);
    });
  }
});
