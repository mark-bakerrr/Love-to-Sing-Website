/**
 * Accordion item.
 */
if (!customElements.get('accordion-item')) {
  class AccordionItem extends DropdownDisclosure {
    constructor() {
      super();
    }

    connectedCallback() {
      super.connectedCallback();

      this.summary.setAttribute('role', 'button');
      this.summary.setAttribute(
        'aria-expanded',
        this.details.hasAttribute('open'),
      );
    }

    /**
     * Open.
     * @override
     */
    open() {
      super.open();

      this.closeAllSiblings();
    }

    /**
     * Close all siblings.
     */
    closeAllSiblings() {
      this.parentElement
        .querySelectorAll('accordion-item:has(.is-open)')
        .forEach((item) => {
          if (item == this) {
            return;
          }

          item.close && item.close();
        });
    }
  }

  customElements.define('accordion-item', AccordionItem);
}
