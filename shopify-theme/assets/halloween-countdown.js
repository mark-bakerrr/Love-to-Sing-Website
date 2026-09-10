/*
 * Halloween Countdown — counts down to a target date (default Oct 31) in a
 * fixed reference timezone, shows a customisable message for a short post
 * window, then auto-rolls to next year. Standalone sibling of the Christmas
 * countdown, with a configurable post window so the message doesn't linger for
 * months after a non-December target.
 *
 * Config comes from an inline <script type="application/json" id="hc-config">
 * emitted by sections/halloween-countdown.liquid.
 *
 * QA params:
 *   ?overlay=1               — broadcast mode: hide the music player
 *   ?now=2026-10-31T00:00    — fake "now" to test the message + reset states
 */
(function () {
  'use strict';

  var stage = document.getElementById('hc-stage');
  if (!stage) return;

  var params = new URLSearchParams(location.search);

  // ---- Config from the section ---------------------------------------------
  var cfg = {};
  try {
    var raw = document.getElementById('hc-config');
    if (raw) cfg = JSON.parse(raw.textContent);
  } catch (e) { cfg = {}; }

  var REFERENCE_TZ = cfg.referenceTz || 'America/New_York';
  var TARGET_MONTH = parseInt(cfg.targetMonth, 10) || 10; // 1-12
  var TARGET_DAY = parseInt(cfg.targetDay, 10) || 31;
  var POST_DAYS = cfg.postDays == null ? 1 : parseFloat(cfg.postDays); // message window
  var PLAYLIST = Array.isArray(cfg.playlist)
    ? cfg.playlist.filter(function (t) { return t && t.src; })
    : [];

  if (params.get('overlay') === '1') stage.classList.add('is-overlay');

  // ---- Time helpers ---------------------------------------------------------

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

  // UTC ms for a wall-clock time in a given tz (DST-corrected)
  function zonedWallToUtc(y, mo, d, h, mi, s, tz) {
    var utc = Date.UTC(y, mo - 1, d, h, mi, s);
    return utc - tzOffset(new Date(utc), tz);
  }

  function yearIn(nowMs, tz) {
    return parseInt(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric'
    }).format(new Date(nowMs)), 10);
  }

  function occurrenceOf(y) {
    return zonedWallToUtc(y, TARGET_MONTH, TARGET_DAY, 0, 0, 0, REFERENCE_TZ);
  }

  function now() {
    var fake = params.get('now');
    if (fake) {
      var t = Date.parse(fake);
      if (!isNaN(t)) return t;
    }
    return Date.now();
  }

  // ---- Render loop ----------------------------------------------------------

  var lastValues = {};

  function render() {
    var n = now();
    var target = occurrenceOf(yearIn(n, REFERENCE_TZ));
    var postEnd = target + POST_DAYS * 86400000;

    if (n < target) {
      // Counting down to this year's target.
      stage.classList.remove('is-post');
      renderCountdown(Math.floor((target - n) / 1000));
    } else if (n < postEnd) {
      // Within the post window — show the message.
      stage.classList.add('is-post');
    } else {
      // Past this year's window — count down to next year's target.
      stage.classList.remove('is-post');
      var next = occurrenceOf(yearIn(n, REFERENCE_TZ) + 1);
      renderCountdown(Math.floor((next - n) / 1000));
    }
  }

  function renderCountdown(secondsLeft) {
    var units = {
      days: Math.floor(secondsLeft / 86400),
      hours: Math.floor((secondsLeft % 86400) / 3600),
      minutes: Math.floor((secondsLeft % 3600) / 60),
      seconds: Math.floor(secondsLeft % 60)
    };
    Object.keys(units).forEach(function (unit) {
      var el = stage.querySelector('[data-unit="' + unit + '"]');
      if (!el) return;
      var value = unit === 'days'
        ? String(units[unit])
        : String(units[unit]).padStart(2, '0');
      if (lastValues[unit] !== value) {
        lastValues[unit] = value;
        el.textContent = value;
        el.classList.remove('is-ticking');
        void el.offsetWidth; // restart animation
        el.classList.add('is-ticking');
      }
    });
  }

  render();
  setInterval(render, 250);

  // ---- Music player (native Audio, dependency-free) -------------------------

  var playerEl = document.getElementById('hc-player');
  if (!playerEl || PLAYLIST.length === 0) {
    if (playerEl) playerEl.style.display = 'none';
    return;
  }

  var audio = new Audio();
  audio.preload = 'none';
  var idx = 0;
  var iconPlay = playerEl.querySelector('.hc-icon-play');
  var iconPause = playerEl.querySelector('.hc-icon-pause');
  var ppBtn = playerEl.querySelector('.hc-btn-play');
  var artEl = playerEl.querySelector('.hc-art');
  var titleEl = playerEl.querySelector('.hc-title');
  var artistEl = playerEl.querySelector('.hc-artist');

  function load(i, autoplay) {
    idx = (i + PLAYLIST.length) % PLAYLIST.length;
    var t = PLAYLIST[idx];
    audio.src = t.src;
    if (t.art) artEl.src = t.art;
    titleEl.textContent = t.title || '';
    artistEl.textContent = t.artist || '';
    if (autoplay) audio.play().catch(function () {});
  }

  function setPlayingUI(playing) {
    iconPlay.style.display = playing ? 'none' : 'block';
    iconPause.style.display = playing ? 'block' : 'none';
    ppBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  ppBtn.addEventListener('click', function () {
    if (audio.paused) audio.play().catch(function () {}); else audio.pause();
  });
  playerEl.querySelector('.hc-prev').addEventListener('click', function () { load(idx - 1, true); });
  playerEl.querySelector('.hc-next').addEventListener('click', function () { load(idx + 1, true); });
  audio.addEventListener('play', function () { setPlayingUI(true); });
  audio.addEventListener('pause', function () { setPlayingUI(false); });
  audio.addEventListener('ended', function () { load(idx + 1, true); });

  load(0, false);
})();
