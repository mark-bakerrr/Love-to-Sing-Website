if (!customElements.get('collapsible-tab')) {
  class CollapsibleTab extends HTMLElement {
    constructor() {
      super();
    }

    /**
     * @param {MouseEvent} event - Click event
     */
    toggle(event) {
      event.preventDefault();
      this.classList.toggle('is-active');
    }

    connectedCallback() {
      /** @type {HTMLElement | null} */
      this.head = this.querySelector('[js-head]');

      if(this.head) this.head.addEventListener('click', this.toggle.bind(this));
    }
  }

  customElements.define('collapsible-tab', CollapsibleTab);
}
