(function () {
  'use strict';

  const PLAY_LABEL = '\u25b6';
  const PAUSE_LABEL = '\u23f8';
  const CART_LABEL = '\ud83d\uded2 Add';
  const ADDED_LABEL = 'Added \u2713';

  const previewCache = new Map();
  const audio = new Audio();
  let currentButton = null;
  let currentRow = null;
  let currentTrackId = null;
  let albumVariantId = null;
  let reducedMotion = false;

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readContext() {
    const script = document.getElementById('lts-album-ctx');
    if (!script) return null;

    try {
      return JSON.parse(script.textContent || '{}');
    } catch (error) {
      console.warn('Love to Sing album context is invalid.', error);
      return null;
    }
  }

  function normalizeHex(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^#?([0-9a-f]{6})$/i);
    return match ? `#${match[1].toLowerCase()}` : null;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;

    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16)
    };
  }

  function rgbToHex(rgb) {
    return `#${[rgb.r, rgb.g, rgb.b].map((channel) => {
      return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
    }).join('')}`;
  }

  function blend(hex, targetHex, amount) {
    const color = hexToRgb(hex);
    const target = hexToRgb(targetHex);
    if (!color || !target) return hex;

    return rgbToHex({
      r: color.r + (target.r - color.r) * amount,
      g: color.g + (target.g - color.g) * amount,
      b: color.b + (target.b - color.b) * amount
    });
  }

  function luminance(hex) {
    const color = hexToRgb(hex);
    if (!color) return 0;

    const channels = [color.r, color.g, color.b].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(a, b) {
    const first = luminance(a);
    const second = luminance(b);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function contrastSafe(hex) {
    const normalized = normalizeHex(hex) || '#b91f1c';
    if (contrastRatio(normalized, '#ffffff') >= 3.8) return normalized;

    const warmed = blend(normalized, '#8b1d18', 0.55);
    if (contrastRatio(warmed, '#ffffff') >= 3.8) return warmed;

    return blend(normalized, '#000000', 0.42);
  }

  function applyAccent(root, accent) {
    if (!root) return;

    // Very pale payload accents are warmed/darkened before they become button
    // backgrounds, while the text color is picked from real contrast.
    const safeAccent = contrastSafe(accent);
    const contrast = contrastRatio(safeAccent, '#ffffff') >= 4.5 ? '#ffffff' : '#2d1b12';
    root.style.setProperty('--lts-album-accent', safeAccent);
    root.style.setProperty('--lts-album-accent-contrast', contrast);
  }

  function formatPrice(value, currency) {
    if (value == null || value === '') return '';

    const text = String(value).trim();
    if (/^[^\d-]/.test(text)) return text;

    return `${currency || '$'}${text}`;
  }

  function setStatus(element, message, isError) {
    if (!element) return;

    element.textContent = message || '';
    element.classList.toggle('is-error', Boolean(isError));
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, options));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  async function getPreviewUrl(apiBase, trackId) {
    if (previewCache.has(trackId)) return previewCache.get(trackId);

    // Signed preview URLs are short-lived, so cache only for this page session.
    const data = await fetchJson(`${apiBase}/preview/${encodeURIComponent(trackId)}`);
    if (!data || !data.url) throw new Error('Preview URL missing');

    previewCache.set(trackId, data.url);
    return data.url;
  }

  // Warm a track ahead of the click so playback starts instantly: fetch the
  // signed URL (cached) and pull the small 30s clip into the browser cache.
  // Each track is warmed at most once per session.
  const warmedTracks = new Set();
  const warmAudio = new Audio();
  warmAudio.preload = 'auto';

  function prefetchPreview(apiBase, trackId) {
    if (!trackId || warmedTracks.has(trackId)) return;
    warmedTracks.add(trackId);
    getPreviewUrl(apiBase, trackId)
      .then((url) => {
        // The click reuses this same signed URL and plays from cache.
        try { warmAudio.src = url; warmAudio.load(); } catch (_) {}
      })
      .catch(() => { warmedTracks.delete(trackId); }); // allow a retry later
  }

  function resetPlayback() {
    if (currentButton) {
      currentButton.textContent = PLAY_LABEL;
      currentButton.setAttribute('aria-label', currentButton.dataset.playLabel || 'Play preview');
    }

    if (currentRow) currentRow.classList.remove('is-playing');

    currentButton = null;
    currentRow = null;
    currentTrackId = null;
  }

  async function togglePreview(button, row, apiBase, status) {
    const trackId = button.dataset.trackId;
    if (!trackId) return;

    if (currentTrackId === trackId && !audio.paused) {
      audio.pause();
      resetPlayback();
      return;
    }

    audio.pause();
    resetPlayback();

    currentButton = button;
    currentRow = row;
    currentTrackId = trackId;
    button.disabled = true;
    button.textContent = '...';
    setStatus(status, 'Loading preview...', false);

    try {
      audio.src = await getPreviewUrl(apiBase, trackId);
      audio.currentTime = 0;
      await audio.play();

      button.disabled = false;
      button.textContent = PAUSE_LABEL;
      button.setAttribute('aria-label', button.dataset.pauseLabel || 'Pause preview');
      row.classList.add('is-playing');
      setStatus(status, '', false);
    } catch (error) {
      console.warn('Preview failed.', error);
      button.disabled = false;
      button.textContent = PLAY_LABEL;
      resetPlayback();
      setStatus(status, 'Preview unavailable.', true);
    }
  }

  async function addToCart(variantId) {
    if (!variantId) throw new Error('Missing variant ID');

    // Use Shopify's native cart endpoint without dispatching theme cart events.
    return await fetchJson('/cart/add.js', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ id: Number(variantId), quantity: 1 }]
      })
    });
  }

  function buttonAdded(button, originalLabel) {
    button.textContent = ADDED_LABEL;

    window.setTimeout(() => {
      button.textContent = originalLabel;
      button.disabled = false;
    }, reducedMotion ? 900 : 1400);
  }

  async function handleTrackAdd(button, status) {
    const variantId = button.dataset.variantId;
    const originalLabel = button.dataset.originalLabel || CART_LABEL;

    button.disabled = true;
    button.textContent = 'Adding...';
    setStatus(status, '', false);

    try {
      await addToCart(variantId);
      buttonAdded(button, originalLabel);
    } catch (error) {
      console.warn('Add track failed.', error);
      button.textContent = originalLabel;
      button.disabled = false;
      setStatus(status, 'Could not add track. Please try again.', true);
    }
  }

  async function handleAlbumAdd(button, status) {
    const originalHtml = button.innerHTML;

    button.disabled = true;
    button.innerHTML = '<span>Adding...</span>';
    setStatus(status, '', false);

    try {
      await addToCart(albumVariantId || button.dataset.variantId);
      button.innerHTML = '<span>Added \u2713</span>';

      window.setTimeout(() => {
        button.innerHTML = originalHtml;
        button.disabled = false;
      }, reducedMotion ? 900 : 1400);
    } catch (error) {
      console.warn('Add album failed.', error);
      button.innerHTML = originalHtml;
      button.disabled = false;
      setStatus(status, 'Could not add album. Please try again.', true);
    }
  }

  function trackTitle(version, index) {
    return version.label || version.title || `Track ${index + 1}`;
  }

  function renderRows(tracklist, versions, ctx, status) {
    const rows = versions.map((version, index) => {
      const available = version.available !== false;
      const title = trackTitle(version, index);
      const price = formatPrice(version.price, ctx.currency);
      const hasPreview = Boolean(version.trackId);
      const previewLabel = hasPreview ? `Play preview for ${title}` : `Preview unavailable for ${title}`;
      const addLabel = available ? `Add ${title} to cart` : `${title} unavailable`;
      const disabledClass = available ? '' : ' is-unavailable';
      const previewDisabled = hasPreview && available ? '' : ' disabled';
      const addDisabled = available && version.variantId ? '' : ' disabled';
      const meta = hasPreview ? '30s preview' : 'Preview coming soon';

      return `
        <li class="lts-album-track${disabledClass}" data-track-row>
          <span class="lts-album-track__number">${index + 1}</span>
          <button
            type="button"
            class="lts-album-track__play"
            data-track-preview
            data-track-id="${escapeHtml(version.trackId || '')}"
            data-play-label="${escapeHtml(previewLabel)}"
            data-pause-label="${escapeHtml(`Pause preview for ${title}`)}"
            aria-label="${escapeHtml(previewLabel)}"
            ${previewDisabled}
          >${PLAY_LABEL}</button>
          <span class="lts-album-track__title">
            ${escapeHtml(title)}
            <span class="lts-album-track__meta">${escapeHtml(meta)}</span>
          </span>
          <span class="lts-album-track__price">${escapeHtml(price)}</span>
          <button
            type="button"
            class="lts-album-track__add"
            data-track-add
            data-variant-id="${escapeHtml(version.variantId || '')}"
            data-original-label="${escapeHtml(CART_LABEL)}"
            aria-label="${escapeHtml(addLabel)}"
            ${addDisabled}
          >${CART_LABEL}</button>
        </li>
      `;
    }).join('');

    tracklist.innerHTML = rows;
    setStatus(status, `${versions.length} ${versions.length === 1 ? 'track' : 'tracks'}`, false);
  }

  function renderEmpty(tracklist, status) {
    tracklist.innerHTML = '<li class="lts-album-tracklist__empty">Tracklist coming soon.</li>';
    setStatus(status, '', false);
  }

  async function loadAlbum(ctx, root, tracklist, status, albumButton) {
    try {
      const data = await fetchJson(`${ctx.apiBase}/shop/${encodeURIComponent(ctx.handle)}`);
      const shop = data && data.shop;
      applyAccent(root, shop && shop.accent);

      if (shop && shop.album && shop.album.variantId) {
        albumVariantId = shop.album.variantId;
        if (albumButton) {
          albumButton.dataset.variantId = shop.album.variantId;
          albumButton.disabled = false;
        }
      }

      if (!shop || !Array.isArray(shop.versions) || shop.versions.length === 0) {
        renderEmpty(tracklist, status);
        return;
      }

      renderRows(tracklist, shop.versions, ctx, status);

      // Preload the first few tracks so the top of the list plays instantly,
      // including on touch/keyboard where there's no hover to trigger warming.
      shop.versions
        .slice(0, 4)
        .forEach((version) => prefetchPreview(ctx.apiBase, version.trackId));
    } catch (error) {
      console.warn('Album tracklist failed.', error);
      renderEmpty(tracklist, status);
      setStatus(status, 'Tracklist coming soon.', true);
    }
  }

  onReady(() => {
    const ctx = readContext();
    if (!ctx) return;

    const root = document.getElementById(`lts-album-${ctx.sectionId}`) || document.querySelector('.lts-album');
    const tracklist = document.getElementById('lts-album-tracklist');
    const trackStatus = document.getElementById('lts-album-tracklist-status');
    const albumButton = document.getElementById('lts-album-add');
    const albumStatus = document.getElementById('lts-album-add-status');

    if (!tracklist) return;

    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    albumVariantId = ctx.albumVariantId;
    applyAccent(root, null);

    audio.preload = 'auto';
    audio.addEventListener('ended', resetPlayback);
    audio.addEventListener('pause', () => {
      if (audio.ended) resetPlayback();
    });

    if (albumButton) {
      albumButton.dataset.variantId = ctx.albumVariantId || '';
      albumButton.addEventListener('click', () => handleAlbumAdd(albumButton, albumStatus));
    }

    tracklist.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;

      const previewButton = event.target.closest('[data-track-preview]');
      if (previewButton && tracklist.contains(previewButton)) {
        const row = previewButton.closest('[data-track-row]');
        togglePreview(previewButton, row, ctx.apiBase, trackStatus);
        return;
      }

      const addButton = event.target.closest('[data-track-add]');
      if (addButton && tracklist.contains(addButton)) {
        handleTrackAdd(addButton, trackStatus);
      }
    });

    // Warm a track's preview the moment the user hovers/focuses its play
    // button, so the click itself has nothing to wait for.
    const prefetchFromEvent = (event) => {
      const btn =
        event.target instanceof Element
          ? event.target.closest('[data-track-preview]')
          : null;
      if (btn && tracklist.contains(btn)) prefetchPreview(ctx.apiBase, btn.dataset.trackId);
    };
    tracklist.addEventListener('pointerover', prefetchFromEvent);
    tracklist.addEventListener('focusin', prefetchFromEvent);

    // If the tracklist was server-rendered (lts.album_tracklist metafield), the
    // rows are already in the DOM and instant — the delegated click/hover
    // handlers above already enhance them, so skip the client fetch and just
    // warm the first few previews. Fall back to fetching when there are no rows.
    const ssrRows = tracklist.querySelectorAll('[data-track-row]');
    if (ssrRows.length > 0) {
      let warmed = 0;
      for (const row of ssrRows) {
        if (warmed >= 4) break;
        const btn = row.querySelector('[data-track-preview]');
        const tid = btn && btn.dataset.trackId;
        if (tid) {
          prefetchPreview(ctx.apiBase, tid);
          warmed += 1;
        }
      }
    } else {
      loadAlbum(ctx, root, tracklist, trackStatus, albumButton);
    }
  });
})();
