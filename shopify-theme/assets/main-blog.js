if (!customElements.get('main-blog')) {
  class MainBlog extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      const button = this.querySelector('[main-blog="show-more"]');
      const grid = this.querySelector('[main-blog="grid"]');

      if (!button || !grid) return;

      button.addEventListener('click', async () => {
        const nextUrl = button.dataset.next;
        if (!nextUrl) return;

        button.disabled = true;
        button.textContent = 'Loading...';

        try {
          const response = await fetch(nextUrl);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          const newArticles = doc.querySelectorAll('[main-blog="grid"] > *');

          newArticles.forEach(el => grid.appendChild(el));

          const nextButton = doc.querySelector('[main-blog="show-more"]');
          if (nextButton && nextButton.dataset.next) {
            button.dataset.next = nextButton.dataset.next;
            button.disabled = false;
            button.textContent = button.dataset.label;
          } else {
            button.remove();
          }
        } catch (err) {
          console.error('Error loading next page:', err);
          button.textContent = 'Error';
        }
      });
    }
  }
  customElements.define('main-blog', MainBlog);
}
