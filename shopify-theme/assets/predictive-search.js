if (!window.customElements.get('predictive-search')) {
  class PredictiveSearch extends MenuDrawer {
    constructor() {
      super();

      this.cachedResults = {};
      this.input = this.querySelector('input[role="combobox"]');
      this.predictiveSearchResults = this.querySelector(
        'predictive-search-results',
      );
      this.resultsLimit = this.dataset.resultsLimit || 12;
      this.sectionId = this.dataset.sectionId || 'predictive-search';
      this.query = this.dataset.customQuery
      || `&${encodeURIComponent(
          'resources[type]',
        )}=product,article,page&${encodeURIComponent(
          'resources[limit]',
        )}=${this.resultsLimit}
      `

      this.setupEventListeners();
    }

    openMenuDrawer(summaryElement) {
      super.openMenuDrawer(summaryElement);
      setTimeout(() => {
        this.input.focus();
      }, 50);
    }

    setupEventListeners() {
      const form = this.querySelector('form');
      this.action = form.getAttribute('action')
      form.addEventListener('submit', this.onFormSubmit.bind(this));

      this.input.addEventListener(
        'input',
        debounce((event) => {
          this.onChange(event);
        }, 300).bind(this),
      );
      this.input.addEventListener('focus', this.onFocus.bind(this));
      // Close on click outside
      document.addEventListener('click', this.onClick.bind(this));
      this.querySelector('details')?.addEventListener('toggle', (e) => {
        this.closest('.header').classList.toggle('menu-open', e.target.hasAttribute('open'))
      });

      this.addEventListener('click', (e) => {
        if (e.target.getAttribute('predictive-search') !== 'hide-results') {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.closeMobileSearch();
      });
    }

    getQuery() {
      return this.input.value.trim();
    }

    hasQuery() {
      return !!this.getQuery().length;
    }

    onChange() {
      const searchTerm = this.getQuery();

      if (!this.hasQuery()) {
        this.close(true);
        return;
      }

      this.getSearchResults(searchTerm);
    }

    onFormSubmit(event) {
      if (!this.hasQuery() || this.querySelector('[aria-selected="true"] a'))
        event.preventDefault();
    }

    onFocus() {
      const searchTerm = this.getQuery();

      if (!this.hasQuery()) return;

      if (this.getAttribute('results') === 'true') {
        this.open();
      } else {
        this.getSearchResults(searchTerm);
      }
    }

    onClick(e) {
      setTimeout(() => {
        if (!e.target.closest('predictive-search')) this.close();
      });
    }

    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(' ', '-').toLowerCase();

      if (this.cachedResults[queryKey]) {
        this.renderSearchResults(this.cachedResults[queryKey]);
        this.predictiveSearchResults.classList.add('show');

        return;
      }

      fetch(
        `${routes.predictive_search_url}?q=${encodeURIComponent(
          searchTerm,
        )}${this.query}&section_id=${this.sectionId}`,
      )
        .then((response) => {
          if (!response.ok) {
            const error = new Error(response.status);
            this.close();
            throw error;
          }

          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector(`#shopify-section-${this.sectionId}`).innerHTML;
          this.cachedResults[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);
          this.predictiveSearchResults.classList.add('show');
        })
        .catch((error) => {
          this.close();
          throw error;
        });
    }

    populateSearchResults(html = '') {
      this.predictiveSearchResults.innerHTML = html;
    }

    renderSearchResults(resultsMarkup) {
      this.populateSearchResults(resultsMarkup);
      this.open();
    }

    open() {
      this.setAttribute('open', true);
      this.input.setAttribute('aria-expanded', true);
    }

    close(clearSearchTerm = false) {
      if (clearSearchTerm) {
        this.input.value = '';
      }

      const selected = this.querySelector('[aria-selected="true"]');

      if (selected) selected.setAttribute('aria-selected', false);

      this.input.setAttribute('aria-activedescendant', '');
      this.removeAttribute('open');

      this.input.setAttribute('aria-expanded', false);
      this.predictiveSearchResults.classList.remove('show');
    }

    closeMobileSearch() {
      this.input.value = '';
      this.predictiveSearchResults.classList.remove('show');
    }
  }

  customElements.define('predictive-search', PredictiveSearch);
}
