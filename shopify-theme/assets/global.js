/**
 * ----------------------------------------------------------------------
 * Helper functions list:
 * Cookies:
 * 1. setCookie - setting a browser cookie.
 * 2. getCookie - get cookie data by name.
 * 3. eraseCookie - remove cookie by name.
 *
 * Function calls:
 * 4. debounce - Used generally for scroll/input change/resize events to
 * avoid updating state too often.
 *
 * DOM Manipulation:
 * 5. bodyScroll - combining object used for body scroll locking.
 * 6. getFocusableElements - get focusable elements within a container.
 * 7. trapFocus - trap focus within a container.
 * 8. removeTrapFocus - remove the trap focus.
 * 9. pauseAllMedia - Pause all page media.
 * 10. getOffsetTop - Get offset from start of document.
 *
 * Data operations:
 * 11. serializeForm - turns formData into a JSON string. Accepts form el.
 * 12. decode - Decode a URI string.
 * 13. deepClone - get deep copy of an object.
 * 14. handleize - transform string to lowercase, replace spaces and low
 * dashes with a dash.
 * 15. fetchConfig - config object for a fetch request.
 * ----------------------------------------------------------------------
 */

/**
 * Debounce - group a series of sequential calls to a function
 * into a single call to that function after it stops getting
 * called for `wait` amount of ms.
 * @param {Function} fn
 * @param {Number} wait
 */
const debounce = (fn, wait) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
};

/**
 * Set cookie.
 * @param {String} name
 * @param {String} value
 * @param {Number} days
 * @returns Void
 */
const setCookie = (name, value, days) => {
  var expires = '';
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/';
};

/**
 * Get cookie data.
 * @param {String} name
 * @returns {String|Null}
 */
const getCookie = (name) => {
  var nameEQ = name + '=';
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

/**
 * Erase cookie value
 * @param {String} name
 */
const eraseCookie = (name) => {
  document.cookie = name + '=; Max-Age=-99999999';
};

/**
 * Body Scroll Lock global object.
 * Use this to ensure body scroll is locked across browsers and OS.
 * More info: https://github.com/willmcpo/body-scroll-lock#usage-examples
 */
const bodyScroll = {
  lock(container) {
    bodyScrollLock.disableBodyScroll(container);
  },
  unlock(container) {
    bodyScrollLock.enableBodyScroll(container);
  },
  clear() {
    bodyScrollLock.clearAllBodyScrollLocks();
  },
};

/**
 * Get all focusable elements within a given container.
 * @param {DOM Element} container
 * @returns
 */
const getFocusableElements = (container) => {
  const selectors = [
    'summary',
    'a[href]',
    'button:enabled',
    '[tabindex]:not([tabindex^="-"])',
    '[draggable]',
    'area',
    'input:not([type=hidden]):enabled',
    'select:enabled',
    'textarea:enabled',
    'object',
    'iframe',
  ];
  return Array.from(container.querySelectorAll(selectors.join(',')));
};

const trapFocusHandlers = {};

/**
 * Remove trap focus.
 * @param {DOM Element} elementToFocus
 */
const removeTrapFocus = (elementToFocus = null) => {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
};

/**
 * Trap focus within a container.
 * @param {DOM Element} container to trap focus within
 * @param {DOM Element} elementToFocus on when focus trapped
 */
const trapFocus = (container, elementToFocus = container) => {
  const elements = getFocusableElements(container);
  const first = elements[0];
  const last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();
};

/**
 * Adjust viewport-height css variable.
 */
['load', 'scroll', 'resize'].forEach((eventName) => {
  window.addEventListener(eventName, (e) => {
    document.documentElement.style.setProperty(
      '--viewport-height',
      `${window.innerHeight}px`,
    );
  });
});

/**
 * Close Details element on Esc key press.
 * @param {Event Object} event
 */
const onKeyUpEscape = (event) => {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
};

/**
 * Serialize form.
 * @param {DOM Element} form
 * @returns {String} JSON Object
 */
const serializeForm = (form) => {
  const obj = {};
  const formData = new FormData(form);
  for (const key of formData.keys()) {
    obj[key] = formData.get(key);
  }
  return JSON.stringify(obj);
};

/**
 * Deep cloning of Object.
 * @param {Object} obj
 * @returns {Object} clone
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Handleize a string. Lowercase and replace spaces and low dashes
 * with a dash.
 * @param {String} str
 * @returns {String} Handleized string
 */
const handleize = (str) => str.replace(/[ /_]/g, '-').toLowerCase();

/**
 * Decode URI string
 * @param {String} str
 * @returns {String} Decoded string
 */
const decode = (str) => decodeURIComponent(str).replace(/\+/g, ' ');

/**
 * Get element offset from start of document.
 * @param {DOM Element} element
 * @returns {Number} Offset top
 */
const getOffsetTop = (element) => {
  let offsetTop = 0;

  do {
    if (!isNaN(element.offsetTop)) {
      offsetTop += element.offsetTop;
    }
  } while ((element = element.offsetParent));

  return offsetTop;
};

/**
 * Pause all media on page.
 */
function pauseAllMedia() {
  document.querySelectorAll('.js-youtube').forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + 'pauseVideo' + '","args":""}',
      '*',
    );
  });
  document.querySelectorAll('.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => video.pause());
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

/**
 * Configuration object for a fetch request.
 * @param {String} type of content.
 * @returns {Object} The fetch configuration.
 */
const fetchConfig = (type = 'json') => {
  return {
    method: 'POST',
    headers: {
      'Content-Type': `application/${type}`,
      'Accept': `application/${type}`,
    },
  };
};

/**
 * Handle details aria attributes.
 */
document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute(
    'aria-expanded',
    summary.parentNode.hasAttribute('open'),
  );

  if (summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute(
      'aria-expanded',
      !event.currentTarget.closest('details').hasAttribute('open'),
    );
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

/**
 * Dropdown disclosure.
 *
 * Uses details and summary elements + content div.
 * Used as abstract class for DropdownInput and AccordionItem.
 * If you need additional logic, use a new class, that extends this one.
 *
 * Can be used as base for:
 * - tooltip on click;
 * - link with sublinks dropdown, etc.
 */
class DropdownDisclosure extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.details = this.querySelector('details');
    this.summary = this.querySelector('summary');
    this.contentElement = this.summary.nextElementSibling;
    // Check for transition duration set on content element.
    this.hasTransition =
      parseFloat(
        window.getComputedStyle(this.contentElement).transitionDuration,
      ) != 0;

    if (!this.details || !this.summary || !this.contentElement) {
      console.error(
        'Dropdown disclosure is missing details, summary or content div:',
      );
      console.log(this);

      return;
    }

    this.init();
  }

  /**
   * Init.
   */
  init() {
    this.summary.addEventListener('click', this.onSummaryClick.bind(this));
  }

  /**
   * On summary click.
   *
   * @param {Event} event
   */
  onSummaryClick(event) {
    const isOpen = this.details.hasAttribute('open');

    isOpen ? this.close(event) : this.open();
  }

  /**
   * Open.
   */
  open() {
    setTimeout(() => {
      this.details.classList.add('is-open');
    });
    this.summary.setAttribute('aria-expanded', true);
    trapFocus(this.details, this.summary);
  }

  /**
   * Close.
   *
   * @param {Event} event
   */
  close(event) {
    event?.preventDefault();

    this.hasTransition
      ? this.closeAnimation()
      : this.details.removeAttribute('open');

    this.details.classList.remove('is-open');
    this.summary.setAttribute('aria-expanded', 'false');
    removeTrapFocus(this.summary);
  }

  /**
   * Close animation.
   */
  closeAnimation() {
    this.contentElement.addEventListener(
      'transitionend',
      () => {
        this.details.removeAttribute('open');
      },
      { once: true },
    );
  }
}

customElements.define('dropdown-disclosure', DropdownDisclosure);

/**
 * Menu Drawer Custom element class.
 */
class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach((summary) =>
      summary.addEventListener('click', this.onSummaryClick.bind(this)),
    );
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(this.mainDetailsToggle.querySelector('summary'))
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const isOpen = detailsElement.hasAttribute('open');

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling);
      summaryElement.nextElementSibling.removeEventListener(
        'transitionend',
        addTrapFocus,
      );
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen
        ? this.closeMenuDrawer(summaryElement)
        : this.openMenuDrawer(summaryElement);
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        summaryElement.nextElementSibling.addEventListener(
          'transitionend',
          addTrapFocus,
        );
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    bodyScroll.lock(summaryElement.nextElementSibling);
  }

  closeMenuDrawer(elementToFocus = false) {
    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach((details) => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle
      .querySelectorAll('.submenu-open')
      .forEach((submenu) => {
        submenu.classList.remove('submenu-open');
      });
    bodyScroll.unlock(
      this.mainDetailsToggle.querySelector('summary').nextElementSibling,
    );
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement
      .querySelector('summary')
      .setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute('open');
        if (detailsElement.closest('details[open]')) {
          trapFocus(
            detailsElement.closest('details[open]'),
            detailsElement.querySelector('summary'),
          );
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define('menu-drawer', MenuDrawer);

/**
 * Header drawer custom element class.
 */
class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
    this.header =
      this.header ||
      document.querySelector(
        '#shopify-section-header header, .shopify-section-group-header-group header',
      );
    this.debouncedResize = debounce(() => {
      if (
        !window.matchMedia(
          `(min-width: ${this.getAttribute('data-breakpoint')}px)`,
        ).matches
      )
        return;

      this.closeMenuDrawer();
    }, 300);
    this.closeBtn = this.querySelector('[header-drawer="close-button"]');

    window.addEventListener('resize', this.debouncedResize.bind(this));

    this.closeBtn?.addEventListener('click', () => {
      this.closeMenuDrawer(this.querySelector('summary'));
    });

    this.querySelectorAll('[header-drawer="close-submenu"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const detailsElement = e.currentTarget.closest('details');
        this.closeSubmenu(detailsElement);
      });
    });

    // Header search mobile button
    document
      .querySelector('[data-header="mobile-search-open"]')
      ?.addEventListener('click', (e) => {
        e.preventDefault();

        this.querySelector('summary')?.click();

        setTimeout(() => {
          this.querySelector('predictive-search input[type="search"]')?.focus();
        }, 500);
      });
  }

  setHeaderTopPosition() {
    document.documentElement.style.setProperty(
      '--header-top-position',
      `${parseInt(this.header.offsetHeight)}px`,
    );
  }

  openMenuDrawer(summaryElement) {
    this.setHeaderTopPosition();
    this.header.classList.add('menu-open');
    super.openMenuDrawer(summaryElement);
  }

  closeMenuDrawer(elementToFocus) {
    super.closeMenuDrawer(elementToFocus);
    this.header.classList.remove('menu-open');
  }

  connectedCallback() {
    this.setHeaderTopPosition();

    document.addEventListener('resize', this.setHeaderTopPosition.bind(), {
      passive: true,
    });
  }
}

customElements.define('header-drawer', HeaderDrawer);

/**
 * Quantity Input custom element class.
 */
class QuantityInput extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });

    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', this.onButtonClick.bind(this)),
    );
  }

  onButtonClick(event) {
    event.preventDefault();

    const previousValue = this.input.value;

    event.target.name === 'increment'
      ? this.input.stepUp()
      : this.input.stepDown();

    if (previousValue !== this.input.value)
      this.input.dispatchEvent(this.changeEvent);
  }
}

customElements.define('quantity-input', QuantityInput);

/**
 * Modal opener custom element class.
 * Used in combination with ModalDialog for inserting a dialog
 * trigger in the document.
 * `data-modal` property connects the modal with the modal-opener.
 * Must contain a button element.
 */
class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;

    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));

      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

/**
 * Modal dialog custom element class.
 * Inserts a modal that is connected to a modal-opener.
 */
class ModalDialog extends HTMLElement {
  constructor() {
    super();

    this.dialogHolder = this.querySelector('[role="dialog"]');
    this.querySelector('[id^="ModalClose-"]').addEventListener(
      'click',
      this.hide.bind(this, false),
    );
    this.addEventListener('keyup', (event) => {
      if (event.code?.toUpperCase() === 'ESCAPE') this.hide();
    });
    this.addEventListener('click', (event) => {
      if (event.target === this) this.hide();
    });
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    bodyScroll.lock(this.dialogHolder);
    this.setAttribute('open', '');
    trapFocus(this, this.dialogHolder);
    window.pauseAllMedia();
  }

  hide() {
    bodyScroll.unlock(this.dialogHolder);
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    removeTrapFocus(this.dialogHolder);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

/**
 * Deferred media custom element class.
 * Must contain a button and a template element
 */
class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(
        this.querySelector('template').content.firstElementChild.cloneNode(
          true,
        ),
      );

      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(
        content.querySelector('.deferred-media__wrapper'),
      );
      if (focus) deferredElement.focus();
    }
  }
}

customElements.define('deferred-media', DeferredMedia);

/**
 * Cart class for base cart actions
 * More info: https://shopify.dev/docs/api/ajax/reference/cart
 */
class Cart {
  /**
   * Get global live regions to update on cart change.
   * @returns {Array} Live region sections objects
   */
  static getLiveRegions() {
    return [
      {
        id: '#cart-counter',
        section: 'cart-counter',
        selector: '#shopify-section-cart-counter',
      },
    ];
  }

  /**
   * Add items to cart.
   * @param {Object} body Form data
   * @returns {Promise} Resolves with the cart object
   */
  static add(body) {
    if (!body) {
      return undefined;
    }

    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    return fetch(`${routes.cart_add_url}`, {
      ...config,
      ...{ body },
    });
  }

  /**
   * Update cart quantity, properties and selling plan.
   * @param {String} body JSON object
   * @returns {Promise} Resolves with the cart object
   * @example Body: '{"line":1,"quantity":3}'
   */
  static update(body) {
    if (!body) {
      return undefined;
    }

    return fetch(`${routes.cart_change_url}`, {
      ...fetchConfig(),
      ...{ body },
    });
  }

  /**
   * Clear all items from cart.
   * @returns {Promise} Promise
   */
  static clear() {
    return fetch(`${routes.cart_clear_url}`, {
      ...fetchConfig(),
    });
  }

  /**
   * Get cart Object.
   * @returns {Promise} Resolves with the cart object
   */
  static get() {
    return fetch(`${routes.cart_url}`, {
      ...fetchConfig(),
    });
  }
}

/**
 * Product selector.
 *
 * Requirements:
 * 1. Options must have `data-name` attribute.
 * 2. Product form with unique ID.
 * 3. Price container must have unique ID.
 * 3. Component Attributes:
 *    1. data-url
 *    2. data-form-id
 *    3. data-price-id
 * -------------------------------
 * 4. Required scripts:
    <script type="application/json" data-variants-json>
      {{- product.variants | json -}}
    </script>

    <script type="application/json" data-variants-prices>
      [
        {%- for variant in product.variants -%}
          {%- capture price_html -%}
            {% render 'price', product_ref: product, variant: variant, use_variant: true %}
          {%- endcapture -%}
          {
            "id": {{ variant.id | json }},
            "price_html": {{ price_html | json }},
            "price_single": {{ variant.price | money | json }}
          }{%- unless forloop.last -%},{%- endunless -%}
        {%- endfor -%}
      ]
    </script>
 */

class ProductSelector extends HTMLElement {
  constructor() {
    super();
  }

  /**
   * Connected callback.
   */
  connectedCallback() {
    this.form = document.querySelector(
      `form#${this.getAttribute('data-form-id')}`,
    );
    this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
    this.submitButton = this.form.elements['add'];
    this.submitButtonSpan = this.submitButton.querySelector('span');
    this.cartDrawer = document.querySelector('cart-drawer');
    this.variants = JSON.parse(
      this.querySelector('[data-variants-json][type="application/json"]')
        .textContent,
    );
    this.prices = JSON.parse(
      this.querySelector('[data-variants-prices]').textContent,
    );
    this.addEventListener('change', this.onVariantChange.bind(this));
    this.unavailableText = ` - ${window.variantStrings.unavailable}`;
    this.priceContainer = document.querySelector(
      `#${this.getAttribute('data-price-id')}`,
    );

    this.updateOptions();
    this.filterOptions();
  }

  /**
   * On submit handler.
   *
   * @param {Object} event
   * @returns {Void}
   */
  onSubmitHandler(event) {
    event.preventDefault();

    this.submitButton.classList.add('disabled');

    const formData = new FormData(this.form);
    formData.append(
      'sections',
      this.cartDrawer.getSectionsToRender().map((section) => section.section),
    );
    formData.append('sections_url', window.location.pathname);

    Cart.add(formData)
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          this.handleErrorMessage(response.description);
          return;
        }

        this.cartDrawer.renderContents(response);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.submitButton.classList.remove('disabled');
      });
  }

  /**
   * Handle error message.
   *
   * @param {String/Object} errorMessage Comes from Shopify.
   * @returns {Void}
   */
  handleErrorMessage(errorMessage = false) {
    const errorWrapper = this.querySelector('[data-error-wrapper]');
    if (!errorWrapper || !errorMessage) return;

    window.dispatchEvent(
      new CustomEvent('formError', { detail: errorMessage }),
    );
    errorWrapper.classList.toggle('hidden', !errorMessage);

    if (typeof errorMessage == 'string') {
      errorWrapper.textContent = errorMessage || '';
    }
  }

  /**
   * On variant change.
   *
   * @param {Object} event
   * @returns {Void}
   */
  onVariantChange(event) {
    if (event.target.type === 'number') return;
    this.updateOptions();
    this.updateVariant();
    this.toggleAddButton(false, '');
    this.handleErrorMessage();
    this.filterOptions();

    if (!this.currentVariant) {
      this.toggleAddButton(true, '');
      this.setUnavailable();

      return;
    }

    if (!this.currentVariant.available) {
      this.toggleAddButton(true, window.variantStrings.soldOut);
    }

    this.updateVariantInput();
    this.updatePrice();
  }

  /**
   * Update options.
   *
   * @returns {Void}
   */
  updateOptions() {
    this.options = Array.from(
      this.querySelectorAll('input[type="radio"]:checked, select'),
      (el) => ({ name: el.dataset.name, value: el.value }),
    );
  }

  /**
   * Update variant.
   *
   * @returns {Void}
   */
  updateVariant() {
    this.currentVariant = this.variants.find((variant) => {
      return !variant.options
        .map((option, index) => this.options[index]?.value === option)
        .includes(false);
    });

    this.currentVariantPrice = this.prices.find((priceObj) => {
      return priceObj.id === this.currentVariant?.id;
    });
  }

  /**
   * Update variant input.
   *
   * @returns {Void}
   */
  updateVariantInput() {
    const input = this.form?.elements['id'];

    if (!input) {
      return;
    }

    input.value = this.currentVariant?.id;
  }

  /**
   * Set unavailable.
   *
   * @returns {Void}
   */
  setUnavailable() {
    if (!this.submitButton) return;
    if (!this.submitButtonSpan) return;
    this.this.submitButtonSpan.textContent = window.variantStrings.unavailable;
    this.priceContainer?.classList.add('visually-hidden');
  }

  /**
   * Render product info.
   *
   * @returns {Void}
   */
  updatePrice() {
    if (!this.priceContainer || !this.currentVariantPrice?.price_html) {
      return;
    }

    this.priceContainer.classList.remove('visually-hidden');
    this.priceContainer.innerHTML = this.currentVariantPrice.price_html;
  }

  /**
   * Toggle add button.
   *
   * @param {Boolean} disable
   * @param {String} text
   * @returns {Void}
   */
  toggleAddButton(disable, text) {
    if (!this.submitButton) {
      return;
    }

    if (disable) {
      this.submitButton.setAttribute('disabled', 'disabled');
      if (text) this.submitButtonSpan.textContent = text;

      return;
    }

    this.submitButton.removeAttribute('disabled');
    this.submitButtonSpan.textContent = window.variantStrings.addToCart;
  }

  /**
   * Filter unavailable options.
   * Toggles 'is-unavailable' attribute based on options availability.
   *
   * @returns {Void}
   */
  filterOptions() {
    for (const [key, { name }] of this.options.entries()) {
      this.querySelectorAll(`[data-name="${name}"]`).forEach((swatch) => {
        const selectOptions = swatch.querySelectorAll('option');
        if (selectOptions.length) {
          return selectOptions.forEach((option) => {
            if (this.isOptionAvailable(key, option.value)) {
              return (option.innerHTML = option.innerHTML.replace(
                this.unavailableText,
                '',
              ));
            }

            if (option.innerHTML.includes(this.unavailableText)) return;

            option.innerHTML = `${option.innerHTML}${this.unavailableText}`;
          });
        }

        return swatch.classList.toggle(
          'is-unavailable',
          !this.isOptionAvailable(key, swatch.value),
        );
      });
    }
  }

  /**
   * Is option available.
   * Check if at least one available variant that contains this option exists.
   *
   * @param {Number} index
   * @param {String} value
   * @returns {Boolean}
   */
  isOptionAvailable(index, value) {
    return this.variants.some((variant) => {
      if (!variant.available) return false;

      const valuesToCheck = {};
      const currentHandle = `option${index + 1}`;

      for (let i = 0; i < index; i++) {
        const optionHandle = `option${i + 1}`;
        const optionValue = this.options[i].value;
        valuesToCheck[optionHandle] = optionValue;
      }

      valuesToCheck[currentHandle] = value;

      return Object.entries(valuesToCheck).every(
        ([handle, value]) => variant[handle] === value,
      );
    });
  }
}

customElements.define('product-selector', ProductSelector);

/**
 * Header Sticky Watcher
 * Add/remove class when element reaches top of viewport.
 *
 * @param {string|Element} target   Selector or element (e.g. '.site-header')
 * @param {string} className        Class to add when stuck (default: 'is-stuck')
 * @returns {Function}              cleanup() - call to remove the listener
 */
function simpleStickyWatcher(target, className = 'is-stuck') {
  const el =
    typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return () => {};

  function onScroll() {
    let threshold = el.getBoundingClientRect().top + el.clientHeight;

    if (window.scrollY > threshold) {
      el.classList.add(className);
    } else {
      el.classList.remove(className);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

simpleStickyWatcher(
  '.shopify-section-group-header-group:has(.header)',
  'is-stuck',
);

document.addEventListener('shopify:section:load', (event) => {
  if (!Shopify || !Shopify.designMode) return;

  simpleStickyWatcher(
    '.shopify-section-group-header-group:has(.header)',
    'is-stuck',
  );
});

/**
 * Header transparent-on-scroll controller
 * The header is transparent over the hero at the top of the page and gains
 * `.is-solid` (fill + shadow, styled in section-header.css) once the page is
 * scrolled. Colour is driven by scroll ONLY — opening a mega menu at the top
 * must NOT solidify the header, so this never keys off menu state.
 *
 * @param {string} selector  Header root selector (default: '.header')
 * @returns {Function}       cleanup() - call to remove the listener
 */
function headerSolidOnScroll(selector = '.header') {
  const header = document.querySelector(selector);
  if (!header) return () => {};

  const THRESHOLD = 10;
  let ticking = false;

  function apply() {
    ticking = false;
    header.classList.toggle('is-solid', window.scrollY > THRESHOLD);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  apply(); // set initial state on load

  return () => window.removeEventListener('scroll', onScroll);
}

headerSolidOnScroll('.header');

document.addEventListener('shopify:section:load', (event) => {
  if (event.target.querySelector('.header')) {
    headerSolidOnScroll('.header');
  }
});

// Set scrollbar width css variable.
document.documentElement.style.setProperty(
  '--scrollbar-width',
  window.innerWidth - document.documentElement.offsetWidth + 'px',
);
