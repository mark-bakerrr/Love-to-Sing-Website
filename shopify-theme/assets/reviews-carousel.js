(() => {
  if (customElements.get('reviews-carousel')) {
    return;
  }

  class ReviewsCarousel extends HTMLElement {
    constructor() {
      super();
      this.slider = null;
      this.options = {};
    }

    connectedCallback() {
      this.initSlider();
    }

    initSlider() {
      if (!this.querySelector('[data-slider]')) return;

      this.options = {
        navigation: {
          prevEl: this.querySelector('.swiper-arrow--prev'),
          nextEl: this.querySelector('.swiper-arrow--next'),
        },
        pagination: {
          el: '.swiper-pagination',
          type: 'bullets',
          clickable: true,
          enable: true,
        },
        slidesPerView: 'auto',
        spaceBetween: 20,
      };
      if (this.hasAttribute('data-autoplay')) {
        this.options.autoplay = {
          delay: this.dataset.autoplaySpeed,
        };
      }
      this.slider = new Swiper(
        this.querySelector('[data-slider]'),
        this.options,
      );
    }
  }

  customElements.define('reviews-carousel', ReviewsCarousel);
})();
