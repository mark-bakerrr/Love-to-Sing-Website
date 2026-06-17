class ProductRecommendations extends customElements.get('products-carousel') {
  constructor() {
    super();

    this.carousel = this.querySelector('products-carousel');
    this.carousel.classList.add('hidden');

    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then((response) => response.text())
        .then((text) => {
          const html = document.createElement('div');
          html.innerHTML = text;
          const recommendations = html.querySelector(
            '[data-container-products]',
          );

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.carousel.querySelector('[data-container-products]').innerHTML =
              recommendations.innerHTML;
            this.carousel.classList.remove('hidden');
            this.carousel.initSlider();
          }
        })
        .catch((e) => {
          console.error(e);
        });
    };

    new IntersectionObserver(handleIntersection.bind(this), {
      rootMargin: '0px 0px 200px 0px',
    }).observe(this);
  }
}

customElements.define('product-recommendations', ProductRecommendations);
