(() => {
  if (customElements.get('featured-articles-carousel')) {
    return;
  }

  class FeaturedArticlesCarousel extends HTMLElement {
    constructor() {
      super();
      this.slider = null;
      this.options = {};
    }

    connectedCallback() {
      this.slides = [...this.querySelector('.swiper-wrapper').children]

      this.slides.forEach(slide => {
        slide.classList.add('swiper-slide')
      })
      this.initSlider();
    }

    initSlider() {
      if (!this.querySelector('[data-slider]')) return;

      this.options = {
        slidesPerView: 1.2,
        spaceBetween: 40,
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

  customElements.define('featured-articles-carousel', FeaturedArticlesCarousel);
})();
