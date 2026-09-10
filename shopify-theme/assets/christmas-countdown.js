/*
 * Christmas Countdown — counts down to Christmas in a fixed reference timezone,
 * swaps to a customisable message Dec 25 -> Dec 31, and auto-rolls to next
 * Christmas on Jan 1. Ported from the christmas-countdown.html prototype.
 *
 * Config comes from an inline <script type="application/json" id="cc-config">
 * emitted by sections/christmas-countdown.liquid.
 *
 * QA params:
 *   ?overlay=1               — broadcast mode: hide the music player
 *   ?now=2026-12-25T00:00    — fake "now" to test Christmas + reset states
 */
(function () {
  'use strict';

  var stage = document.getElementById('cc-stage');
  if (!stage) return;

  var params = new URLSearchParams(location.search);

  // ---- Config from the section ---------------------------------------------
  var cfg = {};
  try {
    var raw = document.getElementById('cc-config');
    if (raw) cfg = JSON.parse(raw.textContent);
  } catch (e) { cfg = {}; }

  var REFERENCE_TZ = cfg.referenceTz || 'America/New_York';
  var TARGET_MONTH = parseInt(cfg.targetMonth, 10) || 12; // 1-12
  var TARGET_DAY = parseInt(cfg.targetDay, 10) || 25;
  var PLAYLIST = Array.isArray(cfg.playlist)
    ? cfg.playlist.filter(function (t) { return t && t.src; })
    : [];

  // Broadcast mode hides the player
  if (params.get('overlay') === '1') stage.classList.add('is-overlay');

  // ---- Time helpers: target = TARGET_MONTH/DAY 00:00 in REFERENCE_TZ --------

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

  function christmasOf(y) {
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
    var target = christmasOf(yearIn(n, REFERENCE_TZ));
    // Jan 1 -> target: count down. Target -> Dec 31: show message. Jan 1 rolls.
    if (n < target) {
      stage.classList.remove('is-post');
      renderCountdown(Math.floor((target - n) / 1000));
    } else {
      stage.classList.add('is-post');
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

  var playerEl = document.getElementById('cc-player');
  if (!playerEl || PLAYLIST.length === 0) {
    if (playerEl) playerEl.style.display = 'none';
    return;
  }

  var audio = new Audio();
  audio.preload = 'none';
  var idx = 0;
  var iconPlay = playerEl.querySelector('.cc-icon-play');
  var iconPause = playerEl.querySelector('.cc-icon-pause');
  var ppBtn = playerEl.querySelector('.cc-btn-play');
  var artEl = playerEl.querySelector('.cc-art');
  var titleEl = playerEl.querySelector('.cc-title');
  var artistEl = playerEl.querySelector('.cc-artist');

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
  playerEl.querySelector('.cc-prev').addEventListener('click', function () { load(idx - 1, true); });
  playerEl.querySelector('.cc-next').addEventListener('click', function () { load(idx + 1, true); });
  audio.addEventListener('play', function () { setPlayingUI(true); });
  audio.addEventListener('pause', function () { setPlayingUI(false); });
  audio.addEventListener('ended', function () { load(idx + 1, true); });

  load(0, false);
})();
