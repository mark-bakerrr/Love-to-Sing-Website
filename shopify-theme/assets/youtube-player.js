if (!customElements.get('youtube-player')) {
  class YouTubePlayer extends HTMLElement {
    constructor() {
      super();

      this.handleClick = this.handleClick.bind(this);
    }

    connectedCallback() {
      this.addEventListener('click', this.handleClick);
    }

    handleClick() {
      const videoId = this.getAttribute('video-id');
      const iframe = this.querySelector('iframe');

      this.classList.add('is-active');

      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

      this.removeEventListener('click', this.handleClick);
    }
  }

  customElements.define('youtube-player', YouTubePlayer);
}
