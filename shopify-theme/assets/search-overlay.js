/*
 * Full-screen search overlay — open/close controller.
 *
 * The SEARCH itself (fetch + render) is owned by the <predictive-search> custom
 * element (assets/predictive-search.js), which binds to the input on construction.
 * This script only shows/hides the overlay shell, manages focus + scroll-lock,
 * and lets the visual chips steer the full /search submit's hidden `type` field.
 *
 * Triggers: any element with [data-search-open] (desktop + mobile header icons).
 * Close:    [data-search-close], backdrop click, or Escape.
 */
(function () {
  'use strict';

  var overlay = document.getElementById('SearchOverlay');
  if (!overlay) return;

  var input = overlay.querySelector('[data-search-overlay-input]');
  var form = overlay.querySelector('.search-overlay__form');
  var lastFocused = null;
  var isOpen = false;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lockScroll() {
    // Compensate is handled by `scrollbar-gutter: stable` on <html>; just hide overflow.
    document.documentElement.classList.add('search-overlay-open');
  }

  function unlockScroll() {
    document.documentElement.classList.remove('search-overlay-open');
  }

  function open(e) {
    if (e) e.preventDefault();
    if (isOpen) return;
    isOpen = true;
    lastFocused = document.activeElement;

    overlay.hidden = false;
    // Force a reflow so the transition from .is-open runs.
    // eslint-disable-next-line no-unused-expressions
    overlay.offsetHeight;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    lockScroll();

    var focusInput = function () {
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    };
    if (reduceMotion) {
      focusInput();
    } else {
      // Wait for the entrance transition so focus scroll doesn't jump.
      window.setTimeout(focusInput, 60);
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    unlockScroll();

    var finish = function () {
      overlay.hidden = true;
    };
    if (reduceMotion) {
      finish();
    } else {
      window.setTimeout(finish, 260);
    }

    // Restore focus to whatever opened the overlay.
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  // Open triggers (delegated so injected icons still work).
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-search-open]');
    if (trigger) open(e);
  });

  // Close: dedicated button.
  overlay.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-close]')) {
      close();
      return;
    }
    // Backdrop click: only when the click lands on the overlay root itself
    // (the frosted backdrop), not on its inner content.
    if (e.target === overlay) close();
  });

  // Escape closes.
  document.addEventListener('keydown', function (e) {
    if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
      e.preventDefault();
      close();
    }
  });

  // Chips: visual active state + steer the full-search `type` on submit.
  var chips = overlay.querySelectorAll('[data-search-chip]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');
      if (!form) return;
      var type = chip.getAttribute('data-search-type') || '';
      var typeField = form.querySelector('input[name="type"]');
      if (type) {
        if (!typeField) {
          typeField = document.createElement('input');
          typeField.type = 'hidden';
          typeField.name = 'type';
          form.appendChild(typeField);
        }
        typeField.value = type;
      } else if (typeField) {
        typeField.remove();
      }
      if (input) input.focus();
    });
  });
})();
