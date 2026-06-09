(function () {
  function init() {
    const strip = document.querySelector('[data-search-context]');
    if (!strip) return;

    const hearts = strip.querySelectorAll('.search-context__heart');
    const countEl = strip.querySelector('[data-count-target]');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !window.gsap) {
      hearts.forEach(h => { h.style.opacity = ''; });
      return;
    }

    window.gsap.set(hearts, { y: -28, opacity: 0, rotation: -12, scale: 0.7 });
    window.gsap.to(hearts, {
      y: 0,
      opacity: (i, el) => parseFloat(getComputedStyle(el).opacity) || 0.18,
      rotation: 0,
      scale: 1,
      duration: 1.0,
      ease: 'power3.out',
      stagger: { each: 0.08, from: 'random' }
    });

    if (countEl) {
      const target = parseInt(countEl.dataset.countTarget, 10);
      const template = countEl.dataset.countTemplate || '{{ count }} results';
      const obj = { v: 0 };
      countEl.textContent = template.replace('%%COUNT%%', '0').replace('{{ count }}', '0');
      window.gsap.to(obj, {
        v: target,
        duration: 1.0,
        ease: 'power2.out',
        onUpdate() {
          const n = Math.round(obj.v);
          countEl.textContent = template.replace('%%COUNT%%', n).replace('{{ count }}', n);
        }
      });
    }
  }

  function whenReady() {
    if (window.gsap) return init();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.gsap || tries > 40) {
        clearInterval(timer);
        init();
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', whenReady);
  } else {
    whenReady();
  }
})();
