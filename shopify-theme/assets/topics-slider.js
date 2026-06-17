(() => {
  if (customElements.get('topics-slider')) {
    return;
  }

  class TopicsSlider extends HTMLElement {
    constructor() {
      super();
      this.slider = null;
    }

    connectedCallback() {
      this.initSlider();
    }

    initSlider() {
      const el = this.querySelector('[data-topics-slider]');
      if (!el) return;

      this.slider = new Swiper(el, {
        slidesPerView: 'auto',
        spaceBetween: 8,
        watchOverflow: true,
        pagination: {
          el: this.querySelector('.blog-category-topics__pagination'),
          clickable: true,
        },
        navigation: {
          prevEl: this.querySelector('.blog-category-topics__arrow--prev'),
          nextEl: this.querySelector('.blog-category-topics__arrow--next'),
        },
        a11y: {
          prevSlideMessage: 'Previous topics',
          nextSlideMessage: 'Next topics',
        },
        on: {
          init: (s) => this.syncEdges(s),
          progress: (s) => this.syncEdges(s),
        },
      });
    }

    syncEdges(s) {
      s.el.classList.toggle('is-at-start', s.isBeginning);
      s.el.classList.toggle('is-at-end', s.isEnd);
    }
  }

  customElements.define('topics-slider', TopicsSlider);
})();
