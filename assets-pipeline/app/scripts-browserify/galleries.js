$(function(){
  const GALLERY_SLICK_SELECTOR = '.gallery--slick';

  $(GALLERY_SLICK_SELECTOR).each(function() {
    $(this).slick({
      infinite: false,
      dots: true,
      speed: 600,
      slidesToShow: 4,
      slidesToScroll: 2,
      prevArrow: $(this).parents('.gallery__container').find('.slick-button-container .slick-prev'),
      nextArrow: $(this).parents('.gallery__container').find('.slick-button-container .slick-next'),
      responsive: [
        {
          breakpoint: 768,
          settings: {
            slidesToShow: 2,
            slidesToScroll: 2,
          }
        }
      ]
    });
  });
});
