class MainCollection extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.sectionId = this.dataset.sectionId;
    this.onLoadMoreClickHandler = this.onLoadMoreClick.bind(this);
    this.onFilterChangeHandler = this.onFilterChange.bind(this);

    this.getElements()
    this.setupEventListeners();
    document.addEventListener('collection:updated', (event) => {
      this.getElements();
      this.setupEventListeners();
    });
  }

  disconnectedCallback() {
    this.detachEventListeners()
  }

  getElements() {
    this.productGrid = this.querySelector('#product-grid');
    this.loadMoreButton = this.querySelector('[main-collection="show-more"]');
    this.facetsContainer = this.querySelector('.collection-facets');
  }

  setupEventListeners() {
    if (this.loadMoreButton) {
      this.loadMoreButton.addEventListener('click', this.onLoadMoreClickHandler);
    }

    if (this.facetsContainer) {
      this.facetsContainer.addEventListener('change', this.onFilterChangeHandler);
      this.facetsContainer.addEventListener('submit', this.onFilterChangeHandler);
    }
  }

  detachEventListeners() {
    if (this.loadMoreButton) {
      this.loadMoreButton.removeEventListener('click', this.onLoadMoreClickHandler);
    }

    if (this.facetsContainer) {
      this.facetsContainer.removeEventListener('change', this.onFilterChangeHandler);
      this.facetsContainer.removeEventListener('submit', this.onFilterChangeHandler);
    }
  }

  onFilterChange(event) {
    event.preventDefault();
    const form = event.target.closest('form');
    if (!form) return;

    // // Use the form's action or current page URL as the base
    // const url = `${form.action || window.location.pathname}?${new URLSearchParams(new FormData(form)).toString()}`;
    // this.renderPage(url, false);
  }

  onLoadMoreClick(event) {
    event.preventDefault();
    const nextUrl = this.loadMoreButton.dataset.next;
    if (nextUrl) {
      this.renderPage(nextUrl, true);
    }
  }

  /**
   * Fetches and renders a new page of products or a filtered view.
   * @param {string} url - The URL to fetch (e.g., from pagination or filters).
   * @param {boolean} append - If true, appends new products. If false, replaces the grid.
   */
  async renderPage(url, append) {
    this.classList.add('is-loading');

    if (this.loadMoreButton) this.loadMoreButton.disabled = true;

    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}section_id=${this.sectionId}`;
      console.log(fetchUrl);

      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(response.statusText);
      const htmlText = await response.text();

      const parser = new DOMParser();
      const newDom = parser.parseFromString(htmlText, 'text/html');

      const newProductGrid = newDom.querySelector('#product-grid');
      const newLoadMoreButton = newDom.querySelector('[main-collection="show-more"]');

      if (append) {
        this.productGrid.append(...newProductGrid.children);
      } else {
        this.productGrid.innerHTML = newProductGrid.innerHTML;
        if (!this.loadOnInit) {
          window.history.pushState({}, '', url);
        }
      }

      if (!this.loadMoreButton) {
        return;
      }

      if (newLoadMoreButton) {
        this.loadMoreButton.style.display = 'inline-block';
        this.loadMoreButton.dataset.next = newLoadMoreButton.dataset.next;
      } else if (this.loadMoreButton) {
        this.loadMoreButton.style.display = 'none';
      }

    } catch (error) {
      console.error('Error fetching collection:', error);
    } finally {
      this.classList.remove('is-loading');
      if (this.loadMoreButton) this.loadMoreButton.disabled = false;
    }
  }
}

// Define the custom element
customElements.define('main-collection', MainCollection);
