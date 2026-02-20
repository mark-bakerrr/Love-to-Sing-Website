if (!customElements.get('header-megamenu')) {
  class HeaderMegamenu extends HTMLElement {
    selectors = {
      container: '[megamenu="container"]',
      mainWrapper: '[megamenu="main-wrapper"]',
      mainMenuList: '[megamenu="main-menu-list"]',
      item: '[megamenu="item"]',
      logoContainer: '[megamenu="logo-container"]',
      logoItem: '[megamenu="logo-item"]',
      productsContainer: '[megamenu="products-container"]',
      submenu: '[megamenu="submenu"]',
      submenuItem: '[megamenu="submenu-item"]',
      subMenuActions: '[megamenu="submenu-actions"]',
    };

    constructor() {
      super();
    }

    connectedCallback() {
      this.elements = {
        mainWrapper: this.querySelector(this.selectors.mainWrapper),
        items: [...this.querySelectorAll(this.selectors.item)],
        submenuItems: [...this.querySelectorAll(this.selectors.submenuItem)],
        mainMenuList: this.querySelector(this.selectors.mainMenuList),
        logoContainer: this.querySelector(this.selectors.logoContainer),
        logoItems: [...this.querySelectorAll(this.selectors.logoItem)],
        container: this.closest(this.selectors.container),
        subMenuActions: this.querySelector(this.selectors.subMenuActions),
        submenu: this.querySelector(this.selectors.submenu),
        productsContainer: [
          ...this.querySelectorAll(this.selectors.productsContainer),
        ],
        header: document.querySelector('header.header'),
      };

      this.addEvents();
      this.updateMenuHeight();

      this.elements.items
        .filter((item) => item.classList.contains('is-active'))
        .forEach((activeItem) => {
          this.updateActiveItem(activeItem);
        });
    }

    addEvents() {
      this.elements.container?.addEventListener('mouseenter', () => {
        this.elements.header?.classList.add('menu-open');
      });

      this.elements.container?.addEventListener('mouseleave', () => {
        this.elements.header?.classList.remove('menu-open');
      });

      this.elements.items.forEach((item) => {
        item.addEventListener('mouseenter', () => {
          this.updateActiveItem(item);
        });
      });

      this.elements.submenuItems.forEach((item) => {
        item.addEventListener('mouseenter', () => {
          this.updateActiveSubItem(item);
        });
      });
    }

    updateActiveItem(activeItem) {
      const activeIndex = activeItem.getAttribute('data-item-index');
      const colorScheme = activeItem.getAttribute('data-color-scheme');

      if (colorScheme) {
        const currentClass = [...this.classList].filter((c) =>
          c.startsWith('color-'),
        );
        this.classList.remove(...currentClass);
        this.classList.add(colorScheme);
      }

      this.elements.items.forEach((item) => {
        if (item == activeItem) {
          item.classList.add('is-active');
          return;
        }

        item.classList.remove('is-active');
      });

      this.elements.logoItems.forEach((logoItem) => {
        const logoIndex = logoItem.getAttribute('data-logo-index');

        if (logoIndex == activeIndex) {
          logoItem.classList.remove('hidden');
          return;
        }

        logoItem.classList.add('hidden');
      });

      this.updateMenuHeight();
    }

    updateActiveSubItem(activeSubItem) {
      this.elements.submenuItems.forEach((item) => {
        if (
          item == activeSubItem &&
          activeSubItem.closest(`${this.selectors.item}.is-active`)
        ) {
          item.classList.add('is-active');
          return;
        }

        item.classList.remove('is-active');
      });

      this.updateMenuHeight();
    }

    getVerticalPadding(el) {
      if (!el) {
        return {
          top: 0,
          bottom: 0,
          total: 0,
        };
      }
      const style = getComputedStyle(el);
      return {
        top: parseFloat(style.paddingTop),
        bottom: parseFloat(style.paddingBottom),
        total: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
      };
    }

    /**
     * Update menu height.
     * Calculates the heights of main menu, submenu(if opened), products container.
     */
    updateMenuHeight() {
      const activeProductsContainer = this.elements.productsContainer.find(
        (container) =>
          container.closest(
            `${this.selectors.item}.is-active ${this.selectors.submenuItem}.is-active, ${this.selectors.item}.is-active > ${this.selectors.productsContainer}`,
          ),
      );

      const activeProductsHeight = activeProductsContainer?.scrollHeight || 0;

      const mainMenuPadding = this.getVerticalPadding(
        this.elements.mainWrapper,
      )?.total;

      const subMenuPadding = this.getVerticalPadding(
        this.elements.submenu,
      )?.total;

      const mainMenuHeight =
        mainMenuPadding +
          this.elements.logoContainer?.scrollHeight +
          this.elements.mainMenuList?.scrollHeight || 0;

      let subMenuHeight =
        subMenuPadding +
        this.elements.submenuItems?.reduce(
          (total, item) => total + item.scrollHeight,
          0,
        ) +
        (this.elements.subMenuActions?.scrollHeight || 0);

      // If submenu is not opened, we should not consider its height.
      if (!this.elements.submenu?.closest(`${this.selectors.item}.is-active`)) {
        subMenuHeight = 0;
      }

      this.style.setProperty(
        '--megamenu-height',
        `${Math.max(activeProductsHeight, mainMenuHeight, subMenuHeight)}px`,
      );
    }
  }

  customElements.define('header-megamenu', HeaderMegamenu);
}
