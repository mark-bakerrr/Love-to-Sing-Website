/**
 * Shelf Slider
 * Adds drag-to-slide and button navigation for desktop sliders
 */

class ShelfSlider {
  constructor(element) {
    this.shelf = element;
    this.cards = this.shelf.querySelector('.shelf__cards--slider');
    this.prevBtn = this.shelf.querySelector('.shelf__nav--prev');
    this.nextBtn = this.shelf.querySelector('.shelf__nav--next');

    if (!this.cards) return;

    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;

    this.init();
  }

  init() {
    // Button navigation
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.scroll('prev'));
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.scroll('next'));
    }

    // Mouse drag
    this.cards.addEventListener('mousedown', (e) => this.startDrag(e));
    this.cards.addEventListener('mousemove', (e) => this.drag(e));
    this.cards.addEventListener('mouseup', () => this.endDrag());
    this.cards.addEventListener('mouseleave', () => this.endDrag());

    // Update button states on scroll
    this.cards.addEventListener('scroll', () => this.updateButtons());

    // Prevent link clicks while dragging
    this.cards.addEventListener('click', (e) => {
      if (this.wasDragging) {
        e.preventDefault();
        this.wasDragging = false;
      }
    }, true);

    // Initial button state
    this.updateButtons();
  }

  scroll(direction) {
    const card = this.cards.querySelector('.card-article');
    if (!card) return;

    const cardWidth = card.offsetWidth + parseInt(getComputedStyle(this.cards).gap) || 0;
    const scrollAmount = direction === 'prev' ? -cardWidth : cardWidth;

    this.cards.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  startDrag(e) {
    this.isDragging = true;
    this.wasDragging = false;
    this.startX = e.pageX - this.cards.offsetLeft;
    this.scrollLeft = this.cards.scrollLeft;
    this.cards.classList.add('is-dragging');
  }

  drag(e) {
    if (!this.isDragging) return;
    e.preventDefault();

    const x = e.pageX - this.cards.offsetLeft;
    const walk = (x - this.startX) * 1.5;

    if (Math.abs(walk) > 5) {
      this.wasDragging = true;
    }

    this.cards.scrollLeft = this.scrollLeft - walk;
  }

  endDrag() {
    this.isDragging = false;
    this.cards.classList.remove('is-dragging');
  }

  updateButtons() {
    const { scrollLeft, scrollWidth, clientWidth } = this.cards;
    const isAtStart = scrollLeft <= 0;
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 1;

    if (this.prevBtn) {
      this.prevBtn.disabled = isAtStart;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = isAtEnd;
    }
  }
}

// Initialize all shelf sliders
function initShelfSliders() {
  document.querySelectorAll('[data-shelf-slider]').forEach((shelf) => {
    new ShelfSlider(shelf);
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShelfSliders);
} else {
  initShelfSliders();
}
