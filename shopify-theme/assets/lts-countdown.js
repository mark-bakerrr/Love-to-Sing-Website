/*
 * Love to Sing — shared countdown engine + GSAP delight layer.
 * Ported from countdown-preview.html and production-hardened for Shopify.
 *
 * Engine scans [data-countdown] nodes and reads:
 *   data-target-month   1-12
 *   data-target-day     1-31
 *   data-tz             IANA timezone (e.g. America/New_York) — target is
 *                       00:00 on month/day IN THIS TZ, so every visitor sees
 *                       identical numbers regardless of their own timezone.
 *   data-end            hide | message | message-then-hide   (default hide)
 *   data-grace-days     integer — how long "message" shows before hiding
 *                       (message-then-hide only)
 *   data-recurring      true | false — roll to next year at zero
 *   data-widget         "1" on the floating widget (simply hides at zero)
 *
 * QA override: ?now=<ISO>  fakes the clock (matches christmas-countdown.js).
 *
 * Units written to [data-unit="days|hours|minutes|seconds"]; hh/mm/ss padded
 * to 2 digits, days not padded.
 *
 * GSAP is optional: if window.gsap is absent the numbers still tick and the
 * end states still fire — animations simply no-op. All motion is guarded by
 * gsap.matchMedia('(prefers-reduced-motion: no-preference)').
 */
(function () {
  'use strict';

  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = null; }

  // ---- Clock (with ?now= QA override) --------------------------------------
  function nowMs() {
    if (params) {
      var fake = params.get('now');
      if (fake) {
        var t = Date.parse(fake);
        if (!isNaN(t)) return t;
      }
    }
    return Date.now();
  }

  // ---- Timezone-correct target helpers -------------------------------------
  // Offset (ms) between the given tz's wall clock and UTC for a moment.
  function tzOffset(date, tz) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var p = {};
    dtf.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUTC - date.getTime();
  }

  // UTC ms for a wall-clock time in a given tz (DST-corrected).
  function zonedWallToUtc(y, mo, d, h, mi, s, tz) {
    var utc = Date.UTC(y, mo - 1, d, h, mi, s);
    return utc - tzOffset(new Date(utc), tz);
  }

  // The calendar year "now" falls in, as seen in tz.
  function yearIn(ms, tz) {
    return parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric'
    }).format(new Date(ms)), 10);
  }

  // Next occurrence of month/day at 00:00 in tz, at/after `ms`.
  // If not recurring, always returns THIS year's occurrence (may be in past).
  function targetFor(cfg, ms) {
    var tz = cfg.tz;
    var y = yearIn(ms, tz);
    var t = zonedWallToUtc(y, cfg.month, cfg.day, 0, 0, 0, tz);
    if (cfg.recurring && (t - ms) <= 0) {
      t = zonedWallToUtc(y + 1, cfg.month, cfg.day, 0, 0, 0, tz);
    }
    return t;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- Per-node config -----------------------------------------------------
  function readCfg(node) {
    var mo = parseInt(node.getAttribute('data-target-month'), 10);
    var d = parseInt(node.getAttribute('data-target-day'), 10);
    return {
      node: node,
      month: (mo >= 1 && mo <= 12) ? mo : 12,
      day: (d >= 1 && d <= 31) ? d : 25,
      tz: node.getAttribute('data-tz') || 'America/New_York',
      end: node.getAttribute('data-end') || 'hide',
      graceDays: parseInt(node.getAttribute('data-grace-days'), 10) || 0,
      recurring: node.getAttribute('data-recurring') === 'true',
      widget: !!node.getAttribute('data-widget'),
      last: {}
    };
  }

  var nodes = [];
  function collect() {
    nodes = [].slice.call(document.querySelectorAll('[data-countdown]')).map(readCfg);
  }

  function setUnit(cfg, unit, value) {
    var el = cfg.node.querySelector('[data-unit="' + unit + '"]');
    if (!el) return;
    var s = String(value);
    if (cfg.last[unit] !== s) {
      cfg.last[unit] = s;
      el.textContent = s;
      if (window.__ltsCdPop) window.__ltsCdPop(el);
    }
  }

  // Hide the whole widget/section root at zero.
  function hideRoot(cfg) {
    var root = cfg.node.closest('.lts-cdw') || cfg.node.closest('.lts-cd') || cfg.node;
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
  }

  function tickOne(cfg, ms) {
    var target = targetFor(cfg, ms);
    var diff = target - ms;
    var msg = cfg.node.querySelector('[data-countdown-message]');
    var row = cfg.node.querySelector('.row');

    if (diff > 0) {
      // Live countdown.
      if (row) { row.style.display = ''; row.style.visibility = ''; }
      if (msg) msg.hidden = true;
      var s = Math.floor(diff / 1000);
      var days = Math.floor(s / 86400); s -= days * 86400;
      var hrs = Math.floor(s / 3600); s -= hrs * 3600;
      var min = Math.floor(s / 60); s -= min * 60;
      setUnit(cfg, 'days', days);
      setUnit(cfg, 'hours', pad(hrs));
      setUnit(cfg, 'minutes', pad(min));
      setUnit(cfg, 'seconds', pad(s));
      return;
    }

    // At/after zero.
    // Widget always just hides.
    if (cfg.widget) { hideRoot(cfg); return; }

    // Recurring non-widget rolls forward automatically (targetFor already
    // returned next year), so diff>0 above will normally handle it. We only
    // reach here for recurring nodes in the exact instant the target has just
    // passed but not yet rolled — treat as live-continues, so re-resolve.
    if (cfg.recurring) {
      // Force next-year resolution.
      var y = yearIn(ms, cfg.tz);
      var next = zonedWallToUtc(y + 1, cfg.month, cfg.day, 0, 0, 0, cfg.tz);
      var d2 = next - ms;
      if (d2 > 0) {
        if (row) { row.style.display = ''; row.style.visibility = ''; }
        if (msg) msg.hidden = true;
        var s2 = Math.floor(d2 / 1000);
        var dd = Math.floor(s2 / 86400); s2 -= dd * 86400;
        var hh = Math.floor(s2 / 3600); s2 -= hh * 3600;
        var mm = Math.floor(s2 / 60); s2 -= mm * 60;
        setUnit(cfg, 'days', dd);
        setUnit(cfg, 'hours', pad(hh));
        setUnit(cfg, 'minutes', pad(mm));
        setUnit(cfg, 'seconds', pad(s2));
        return;
      }
    }

    // Non-recurring end behaviour.
    if (cfg.end === 'hide') {
      hideRoot(cfg);
      return;
    }

    // message / message-then-hide
    if (cfg.end === 'message-then-hide') {
      // How long since the target passed? target is THIS year's occurrence.
      var elapsedDays = (ms - target) / 86400000;
      if (elapsedDays >= cfg.graceDays) {
        hideRoot(cfg);
        return;
      }
    }
    // Show the message.
    if (row) row.style.display = 'none';
    if (msg) msg.hidden = false;
  }

  function tick() {
    var ms = nowMs();
    for (var i = 0; i < nodes.length; i++) tickOne(nodes[i], ms);
  }

  collect();
  if (nodes.length) {
    tick();
    setInterval(tick, 1000);
  }

  // ========================================================================
  // GSAP delight layer — optional, reduced-motion aware.
  // ========================================================================
  function initMotion() {
    if (!window.gsap) return;
    var gsap = window.gsap;
    gsap.defaults({ ease: 'power2.out' });
    var mm = gsap.matchMedia();

    // Reduced motion: no pop, no ambience.
    mm.add('(prefers-reduced-motion: reduce)', function () {
      window.__ltsCdPop = function () {};
    });

    mm.add('(prefers-reduced-motion: no-preference)', function () {
      // number pop on change
      window.__ltsCdPop = function (el) {
        gsap.fromTo(el, { scale: 1.28 }, { scale: 1, duration: .4, ease: 'back.out(2)' });
      };

      // entrance
      gsap.from('.lts-cd', { autoAlpha: 0, y: 26, duration: .6, ease: 'power3.out', stagger: { each: .06 } });
      gsap.from('.lts-cdw', { autoAlpha: 0, y: 40, duration: .7, delay: .5, ease: 'back.out(1.6)' });

      // ---- particle helpers ----
      function snow(box) {
        if (!box) return;
        for (var i = 0; i < 9; i++) {
          var s = document.createElement('span'); s.className = 'flake'; box.appendChild(s);
          gsap.set(s, { left: (Math.random() * 88 + 6) + '%', top: '8%' });
          gsap.fromTo(s, { y: 0, autoAlpha: 0 }, { y: box.offsetHeight * 0.55, autoAlpha: 1, duration: 2.2 + Math.random() * 2, ease: 'sine.in', repeat: -1, delay: Math.random() * 3 });
          gsap.to(s, { x: Math.random() * 18 - 9, duration: 1.6 + Math.random(), ease: 'sine.inOut', repeat: -1, yoyo: true });
        }
      }
      function bubbles(box) {
        if (!box) return;
        for (var i = 0; i < 6; i++) {
          var b = document.createElement('span'); b.className = 'bub'; box.appendChild(b);
          gsap.set(b, { left: (28 + Math.random() * 44) + '%', bottom: '40%', scale: .5 + Math.random() * .6 });
          gsap.to(b, { keyframes: { autoAlpha: [0, .9, 0], bottom: ['40%', '78%'] }, duration: 1.5 + Math.random() * .8, ease: 'sine.out', repeat: -1, delay: Math.random() * 2 });
        }
      }
      function snowField(box) {
        if (!box) return;
        var h = box.offsetHeight || 230;
        for (var i = 0; i < 16; i++) {
          var s = document.createElement('span'); s.className = 'flake'; box.appendChild(s);
          gsap.set(s, { left: (Math.random() * 100) + '%', top: 0, scale: .6 + Math.random() * .8 });
          gsap.to(s, { keyframes: { y: [0, h + 12], autoAlpha: [0, 1, 1, 0] }, duration: 3 + Math.random() * 3, ease: 'none', repeat: -1, delay: Math.random() * 4 });
          gsap.to(s, { x: Math.random() * 26 - 13, duration: 2 + Math.random() * 2, ease: 'sine.inOut', repeat: -1, yoyo: true });
        }
      }

      // ---- idle ambience: animate the IMG (hover animates the box) ----
      gsap.utils.toArray('.lts-cd[data-fx]').forEach(function (card) {
        var fx = card.getAttribute('data-fx');
        var art = card.querySelector('.art');
        var box = card.querySelector('.artbox');
        if (fx === 'globe') { if (art) gsap.to(art, { y: -6, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true }); snow(box); }
        else if (fx === 'sleigh') { if (art) gsap.to(art, { y: -4, duration: 2, ease: 'sine.inOut', repeat: -1, yoyo: true }); }
        else if (fx === 'pumpkin') { if (box) gsap.to(box, { filter: 'drop-shadow(0 0 20px rgba(255,150,40,.85))', duration: 1.7, ease: 'sine.inOut', repeat: -1, yoyo: true }); }
        else if (fx === 'cauldron') { if (art) { gsap.set(art, { transformOrigin: '50% 100%' }); gsap.to(art, { rotation: 1.6, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true }); } bubbles(box); }
        else if (fx === 'advent') { snowField(card.querySelector('.snowfield')); }
        // neon: calm/steady — no idle ambience
      });

      // ---- hover flourishes ----
      gsap.utils.toArray('.lts-cd[data-fx]').forEach(function (card) {
        var fx = card.getAttribute('data-fx');
        var box = card.querySelector('.artbox');
        var arw = card.querySelector('.cta .arw');
        card.addEventListener('mouseenter', function () {
          if (arw) gsap.to(arw, { x: 5, duration: .3 });
          if (fx === 'globe') gsap.to(box, { rotation: 6, scale: 1.05, duration: .6, ease: 'elastic.out(1,.45)', transformOrigin: '50% 85%' });
          else if (fx === 'sleigh') gsap.fromTo(box, { x: 0 }, { x: 16, duration: .6, ease: 'power1.inOut', yoyo: true, repeat: 1 });
          else if (fx === 'pumpkin') {
            gsap.timeline()
              .to(box, { scale: 1.4, duration: .26, ease: 'back.out(2.4)', transformOrigin: '50% 62%' })
              .to(box, { keyframes: { rotation: [-5, 5, -4, 4, -2, 0] }, duration: .55, ease: 'sine.inOut' });
            gsap.to(card.querySelector('.art'), { filter: 'brightness(1.4) drop-shadow(0 0 38px rgba(255,110,10,.95))', duration: .22 });
          }
          else if (fx === 'cauldron') gsap.to(box, { scale: 1.07, duration: .4, ease: 'back.out(2)', transformOrigin: '50% 100%' });
          else if (fx === 'advent') gsap.to(card.querySelectorAll('.tile'), { y: -8, rotationX: 10, duration: .4, stagger: .05, transformOrigin: '50% 100%' });
          else if (fx === 'neon') gsap.to(card.querySelector('.cd'), { filter: 'brightness(1.3)', duration: .35 });
        });
        card.addEventListener('mouseleave', function () {
          if (arw) gsap.to(arw, { x: 0, duration: .3 });
          if (fx === 'globe') gsap.to(box, { rotation: 0, scale: 1, duration: .6 });
          else if (fx === 'pumpkin') {
            gsap.to(box, { scale: 1, rotation: 0, duration: .45, ease: 'power2.out' });
            gsap.to(card.querySelector('.art'), { filter: 'brightness(1)', duration: .45 });
          }
          else if (fx === 'cauldron') gsap.to(box, { scale: 1, duration: .4 });
          else if (fx === 'advent') gsap.to(card.querySelectorAll('.tile'), { y: 0, rotationX: 0, duration: .4, stagger: .04 });
          else if (fx === 'neon') gsap.to(card.querySelector('.cd'), { filter: 'brightness(1)', duration: .4 });
        });
      });

      // ---- widget: idle art bob + hover lift ----
      gsap.utils.toArray('.lts-cdw').forEach(function (fw) {
        var fart = fw.querySelector('.art');
        if (fart) gsap.to(fart, { y: -3, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
        fw.addEventListener('mouseenter', function () { gsap.to(fw, { y: -4, scale: 1.03, duration: .3 }); });
        fw.addEventListener('mouseleave', function () { gsap.to(fw, { y: 0, scale: 1, duration: .3 }); });
      });
    });
  }

  if (document.readyState === 'complete') {
    initMotion();
  } else {
    window.addEventListener('load', initMotion);
  }

  // ========================================================================
  // Widget dismiss — per-season localStorage flag.
  // The widget root (.lts-cdw) carries data-widget-key; a matching close
  // button [data-cdw-close] hides + remembers it for that season.
  // ========================================================================
  function initWidgetDismiss() {
    var widgets = document.querySelectorAll('.lts-cdw[data-widget-key]');
    [].forEach.call(widgets, function (w) {
      var key = 'ltsCdwDismiss:' + w.getAttribute('data-widget-key');
      try {
        if (localStorage.getItem(key) === '1') {
          w.setAttribute('hidden', 'hidden');
          w.style.display = 'none';
          return;
        }
      } catch (e) {}
      var btn = w.querySelector('[data-cdw-close]');
      if (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          w.setAttribute('hidden', 'hidden');
          w.style.display = 'none';
          try { localStorage.setItem(key, '1'); } catch (e) {}
        });
      }
    });
  }
  initWidgetDismiss();

})();
