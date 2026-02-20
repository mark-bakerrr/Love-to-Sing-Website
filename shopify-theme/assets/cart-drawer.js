const sectionsToRender = [
  {
    id: '#CartDrawer-Body',
    section: 'cart-drawer',
    selector: '#shopify-section-cart-drawer #CartDrawer-Body',
  },
];

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener(
      'keyup',
      (event) => event.code.toUpperCase() === 'ESCAPE' && this.close(),
    );
    this.querySelector('#CartDrawer-Overlay').addEventListener(
      'click',
      this.close.bind(this),
    );
    this.setCartLinks();
    this.handleReload = this.reloadCartDrawer.bind(this);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:reload', this.handleReload);
  }

  connectedCallback() {
    document.addEventListener('cart:reload', this.handleReload);
  }

  setCartLinks() {
    const cartLinks = document.querySelectorAll('[data-cart-link]');

    cartLinks.forEach((cartLink) => {
      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');
      cartLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(cartLink);
      });
      cartLink.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() !== 'SPACE') return;
        event.preventDefault();
        this.open(cartLink);
      });
    });
  }

  open(opener) {
    if (opener) this.setActiveElement(opener);
    this.classList.add('is-visible');
    this.addEventListener(
      'transitionend',
      () => {
        this.focusOnCartDrawer();
      },
      { once: true },
    );
    bodyScroll.lock(this.querySelector('#CartDrawer-Body'));
  }

  close() {
    this.classList.remove('is-visible');
    removeTrapFocus(this.activeElement);
    bodyScroll.unlock(this.querySelector('#CartDrawer-Body'));
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  focusOnCartDrawer() {
    const containerToTrapFocusOn = this.querySelector('#CartDrawer');
    const focusElement = this.querySelector('[data-drawer-close]');
    trapFocus(containerToTrapFocusOn, focusElement);
  }

  renderContents(response) {
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = document.querySelector(section.id);
      sectionElement.innerHTML = this.getSectionInnerHTML(
        response.sections[section.section],
        section.selector,
      );
    });
    this.open();
  }

  getSectionsToRender() {
    return [...Cart.getLiveRegions(), ...sectionsToRender];
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  reloadCartDrawer() {
    const sectionsToFetch = this.getSectionsToRender().map((section) => section.section);
    const url = `${window.Shopify.routes.root}?sections=${sectionsToFetch.join(',')}`;

    fetch(url)
      .then((response) => response.json())
      .then((response) => {
        this.renderContents({ sections: response});
        return response;
      })
      .catch((error) => {
        console.error('Failed to fetch cart:', error);
      });
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [...Cart.getLiveRegions(), ...sectionsToRender];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
