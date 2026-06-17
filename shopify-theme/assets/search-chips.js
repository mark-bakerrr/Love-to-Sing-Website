(function () {
  const nav = document.querySelector('[data-search-chips]');
  if (!nav) return;

  const list = document.querySelector('[data-search-results]');
  const emptyMsg = document.querySelector('[data-search-chip-empty]');
  if (!list) return;

  const tplFallback = 'No {{ type }} results for "{{ terms }}". Try All to see other matches.';

  function renderEmpty(type, terms) {
    const tpl = (emptyMsg && emptyMsg.dataset.template) || tplFallback;
    return tpl.replace('%%TYPE%%', type).replace('%%TERMS%%', terms).replace('{{ type }}', type).replace('{{ terms }}', terms);
  }

  function applyFilter(chip) {
    const items = list.querySelectorAll('.search-results__item');
    let visible = 0;
    items.forEach((item) => {
      const row = item.querySelector('[data-result-type]');
      const type = row ? row.getAttribute('data-result-type') : null;
      const show = chip === 'all' || type === chip;
      item.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
    });

    if (emptyMsg) {
      if (visible === 0 && chip !== 'all') {
        const terms = new URLSearchParams(window.location.search).get('q') || '';
        const label = nav.querySelector(`[data-chip="${chip}"]`).textContent.trim().split(/\s+/)[0].toLowerCase();
        emptyMsg.textContent = renderEmpty(label, terms);
        emptyMsg.hidden = false;
      } else {
        emptyMsg.hidden = true;
        emptyMsg.textContent = '';
      }
    }
  }

  function activateChip(btn, { updateHash = true } = {}) {
    if (!btn || btn.hasAttribute('disabled')) return;
    nav.querySelectorAll('.search-chip').forEach((c) => {
      c.classList.remove('is-active');
      c.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    applyFilter(btn.dataset.chip);

    if (updateHash) {
      const chip = btn.dataset.chip;
      const newHash = chip === 'all' ? '' : `#chip=${chip}`;
      const url = window.location.pathname + window.location.search + newHash;
      history.replaceState(null, '', url);
    }
  }

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.search-chip');
    activateChip(btn);
  });

  // Restore chip from URL hash on load (shareable filter state).
  const hashMatch = window.location.hash.match(/^#chip=(song|shop|blog|all)$/);
  if (hashMatch) {
    const target = nav.querySelector(`[data-chip="${hashMatch[1]}"]`);
    if (target) activateChip(target, { updateHash: false });
  }

  // Re-apply active filter when the show-more handler appends rows.
  const observer = new MutationObserver(() => {
    const active = nav.querySelector('.search-chip.is-active');
    if (active) applyFilter(active.dataset.chip);
  });
  observer.observe(list, { childList: true });
})();
