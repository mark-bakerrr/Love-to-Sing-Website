if (!customElements.get('dropdown-tabs')) {
  class DropdownTabs extends HTMLElement {
    selectors = {
      action: '[dropdown-tabs="action"]',
      tab: '[dropdown-tabs="tab"]'
    }

    constructor() {
      super();
      this.activeIndex = 1;
    }

    connectedCallback() {
      this.elements = {
        actions: [...this.querySelectorAll(this.selectors.action)],
        tabs: [...this.querySelectorAll(this.selectors.tab)]
      }

      this.elements.actions.forEach(select => {
        select.addEventListener('change', (e) => {
          if (select.value == this.activeIndex) {
            return;
          }

          this.activeIndex = select.value;

          const targetTab = this.elements.tabs.find(tab => tab.dataset.index == this.activeIndex)

          if (targetTab) {
            if (this.elements.actions[this.activeIndex - 1]) {
              this.elements.actions[this.activeIndex - 1].value = this.activeIndex
            }

            targetTab.classList.add('is-active')
          }

          select.closest(this.selectors.tab)?.classList.remove('is-active')
        })
      })
    }
  }
  customElements.define('dropdown-tabs', DropdownTabs);
}
