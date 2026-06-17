if (!customElements.get('save-email')) {
  class SaveEmail extends HTMLElement {
    constructor() {
      super();
    }

    handleSubmit() {
      const email = this.form.querySelector('[name="contact[email]"]');
      if(!email) return;

      localStorage.setItem('subscribed_email', email);
    }

    loadFromStorage() {
      const email = localStorage.getItem('subscribed_email');
      if(!email) return;

      this.form.classList.add('is-submitted');
    }

    connectedCallback() {
      this.form = this.querySelector('form');

      this.form.addEventListener('submit', this.handleSubmit.bind(this));

      this.loadFromStorage();
    }
  }

  customElements.define('save-email', SaveEmail);
}
