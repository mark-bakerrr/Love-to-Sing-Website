if (!customElements.get('facets-mobile')) {
  class FacetsMobile extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      document.addEventListener('click', (e) => {
        if (e.target.closest('.facets-mobile')) {
          return;
        }

        this.closest('details').removeAttribute('open')
      })
    }
  }

  customElements.define('facets-mobile', FacetsMobile);
}
