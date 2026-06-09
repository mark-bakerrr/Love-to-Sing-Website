/**
 * Santa Tracker — countdown + live route playback.
 *
 * Like the NORAD / Google trackers, there is no live data: Santa follows a
 * pre-generated route (santa-route.json) on a fixed UTC schedule, and the
 * client interpolates his position from the current time. Times in the route
 * are offsets (seconds) from the departure instant set on the section.
 *
 * QA helpers (query params):
 *   ?santa_time=2026-12-24T11:30:00Z  — pretend it is that moment (time still flows)
 *   ?santa_speed=600                  — accelerate time, e.g. fly the route in minutes
 */
(function () {
  'use strict';

  var toRad = function (deg) { return (deg * Math.PI) / 180; };
  var toDeg = function (rad) { return (rad * 180) / Math.PI; };

  function latLngToVec(lat, lng) {
    var la = toRad(lat);
    var lo = toRad(lng);
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  }

  function vecToLatLng(v) {
    return [toDeg(Math.asin(v[2])), toDeg(Math.atan2(v[1], v[0]))];
  }

  // Spherical interpolation between two points — follows the great circle, so
  // Santa flies realistic arcs (and crosses the date line without glitches).
  function slerp(a, b, f) {
    var va = latLngToVec(a[0], a[1]);
    var vb = latLngToVec(b[0], b[1]);
    var dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    var omega = Math.acos(dot);
    if (omega < 1e-9) return a;
    var sinO = Math.sin(omega);
    var ka = Math.sin((1 - f) * omega) / sinO;
    var kb = Math.sin(f * omega) / sinO;
    return vecToLatLng([
      ka * va[0] + kb * vb[0],
      ka * va[1] + kb * vb[1],
      ka * va[2] + kb * vb[2],
    ]);
  }

  // Eased travel so Santa visibly accelerates out of a stop and brakes into the next
  function easeInOut(f) {
    return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  }

  /**
   * Where is Santa `elapsed` seconds after departure?
   * Returns { status, lat, lng, presents, headingEast, current, next, stopIndex }
   *   status: 'pre' | 'delivering' | 'flying' | 'done'
   */
  function routePosition(route, elapsed) {
    var stops = route.stops;
    var first = stops[0];
    var last = stops[stops.length - 1];

    if (elapsed < 0) {
      return { status: 'pre', lat: first.lat, lng: first.lng, presents: 0, headingEast: false, current: first, next: stops[1], stopIndex: 0 };
    }
    if (elapsed >= route.duration) {
      return { status: 'done', lat: last.lat, lng: last.lng, presents: route.presentsTotal, headingEast: false, current: last, next: null, stopIndex: stops.length - 1 };
    }

    // Binary search: last stop whose arrival time is <= elapsed
    var lo = 0;
    var hi = stops.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (stops[mid].t <= elapsed) lo = mid;
      else hi = mid - 1;
    }
    var stop = stops[lo];
    var next = stops[lo + 1] || last;
    var prevPresents = lo > 0 ? stops[lo - 1].p : 0;

    if (elapsed < stop.t + stop.d || lo === stops.length - 1) {
      // On a rooftop, delivering
      var dwellF = stop.d > 0 ? (elapsed - stop.t) / stop.d : 1;
      return {
        status: 'delivering',
        lat: stop.lat,
        lng: stop.lng,
        presents: Math.round(prevPresents + (stop.p - prevPresents) * Math.min(1, dwellF)),
        headingEast: next.lng > stop.lng,
        current: stop,
        next: next,
        stopIndex: lo,
      };
    }

    // In flight between stop and next
    var depart = stop.t + stop.d;
    var f = easeInOut((elapsed - depart) / (next.t - depart));
    var pos = slerp([stop.lat, stop.lng], [next.lat, next.lng], f);
    // Compare along the shortest east/west direction so the sleigh faces sensibly
    var dLng = next.lng - stop.lng;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    return {
      status: 'flying',
      lat: pos[0],
      lng: pos[1],
      presents: stop.p,
      headingEast: dLng > 0,
      current: stop,
      next: next,
      stopIndex: lo,
    };
  }

  // Unwrap longitudes so the trail polyline never jumps across the date line
  function unwrapLngs(stops) {
    var out = [stops[0].lng];
    for (var i = 1; i < stops.length; i++) {
      var prev = out[i - 1];
      var d = stops[i].lng - (((prev % 360) + 540) % 360 - 180);
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      out.push(prev + d);
    }
    return out;
  }

  // Expose pure helpers for tests (and reuse below)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { routePosition: routePosition, slerp: slerp, unwrapLngs: unwrapLngs };
    return;
  }
  if (typeof window === 'undefined' || customElements.get('santa-tracker')) return;

  var SLEIGH_SVG =
    '<svg viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<g fill="none">' +
    '<path d="M4 26 q4 8 14 8 h28 q10 0 14 -10 l-4 0 q-3 7 -10 7 h-28 q-7 0 -10 -5 z" fill="#B91F1C"/>' +
    '<path d="M10 26 h34 l4 -8 h-30 q-6 0 -8 8 z" fill="#EC5450"/>' +
    '<rect x="20" y="10" width="9" height="9" rx="2" fill="#3F7A45"/>' +
    '<rect x="23.5" y="10" width="2" height="9" fill="#FACC55"/>' +
    '<circle cx="40" cy="13" r="5" fill="#FDEFEF"/>' +
    '<path d="M35 13 a5 5 0 0 1 10 0 z" fill="#B91F1C"/>' +
    '<circle cx="46" cy="9" r="1.6" fill="#FACC55"/>' +
    '</g></svg>';

  var NUMBER_FORMAT = new Intl.NumberFormat();

  function param(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadStylesheet(href) {
    return new Promise(function (resolve, reject) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = resolve;
      l.onerror = reject;
      document.head.appendChild(l);
    });
  }

  class SantaTracker extends HTMLElement {
    connectedCallback() {
      this.departure = Date.parse(this.dataset.departure);
      this.route = null;
      this.map = null;
      this.marker = null;
      this.trail = null;
      this.follow = true;
      this.replayOffset = null;
      this.state = '';
      this.visitedCount = 0;
      this.stopDots = [];

      // QA time controls
      var fakeTime = param('santa_time');
      this.timeBase = fakeTime ? Date.parse(fakeTime) : null;
      this.timeBaseAt = Date.now();
      this.speed = Math.max(1, parseFloat(param('santa_speed')) || 1);

      this.panels = {
        pre: this.querySelector('[data-state="pre"]'),
        live: this.querySelector('[data-state="live"]'),
        post: this.querySelector('[data-state="post"]'),
      };

      var replayBtn = this.querySelector('[data-action="replay"]');
      if (replayBtn) replayBtn.addEventListener('click', this.startReplay.bind(this));
      var followBtn = this.querySelector('[data-action="follow"]');
      if (followBtn) {
        this.followBtn = followBtn;
        followBtn.addEventListener('click', this.enableFollow.bind(this));
      }

      this.initSnow();
      this.timer = setInterval(this.tick.bind(this), 250);
      this.tick();
    }

    disconnectedCallback() {
      clearInterval(this.timer);
    }

    now() {
      var real = Date.now();
      if (this.timeBase !== null) return this.timeBase + (real - this.timeBaseAt) * this.speed;
      if (this.speed > 1) return this.departure + (real - this.timeBaseAt) * this.speed;
      return real;
    }

    elapsed() {
      var e = (this.now() - this.departure) / 1000;
      if (this.replayOffset !== null) {
        // Replay: fly the whole 25h route in ~90 seconds
        e = ((Date.now() - this.replayOffset) / 1000) * (this.routeDuration() / 90);
        if (e >= this.routeDuration()) {
          this.replayOffset = null;
          e = this.routeDuration();
        }
      }
      return e;
    }

    routeDuration() {
      return this.route ? this.route.duration : 25 * 3600;
    }

    tick() {
      var e = this.elapsed();
      var state = e < 0 ? 'pre' : e < this.routeDuration() ? 'live' : 'post';
      if (this.replayOffset !== null) state = 'live';

      if (state !== this.state) {
        this.state = state;
        for (var key in this.panels) {
          if (this.panels[key]) this.panels[key].hidden = key !== state;
        }
        if (state === 'live') this.setupLive();
      }

      if (state === 'pre') this.renderCountdown(-e);
      if (state === 'live' && this.route && this.map) this.renderLive(e);
    }

    /* ---------- Countdown ---------- */

    renderCountdown(secondsLeft) {
      var units = {
        days: Math.floor(secondsLeft / 86400),
        hours: Math.floor((secondsLeft % 86400) / 3600),
        minutes: Math.floor((secondsLeft % 3600) / 60),
        seconds: Math.floor(secondsLeft % 60),
      };
      for (var unit in units) {
        var el = this.querySelector('[data-unit="' + unit + '"]');
        if (!el) continue;
        var value = String(units[unit]).padStart(2, '0');
        if (unit === 'days') value = String(units[unit]);
        if (el.textContent !== value) {
          el.textContent = value;
          el.classList.remove('is-ticking');
          void el.offsetWidth; // restart the pop animation
          el.classList.add('is-ticking');
        }
      }
    }

    /* ---------- Live tracker ---------- */

    setupLive() {
      if (this.loading) return;
      this.loading = true;
      var self = this;
      Promise.all([
        fetch(this.dataset.routeUrl).then(function (r) { return r.json(); }),
        loadStylesheet(this.dataset.leafletCss),
        loadScript(this.dataset.leafletJs),
      ])
        .then(function (results) {
          self.route = results[0];
          self.unwrapped = unwrapLngs(self.route.stops);
          self.initMap();
        })
        .catch(function (err) {
          console.error('Santa tracker failed to load', err);
          var fallback = self.querySelector('[data-tracker-error]');
          if (fallback) fallback.hidden = false;
        });
    }

    initMap() {
      var mapEl = this.querySelector('[data-map]');
      if (!mapEl || !window.L) return;
      var first = this.route.stops[0];

      this.map = L.map(mapEl, {
        center: [first.lat, this.unwrapped[0]],
        zoom: 4,
        minZoom: 2,
        maxZoom: 8,
        worldCopyJump: false,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
      }).addTo(this.map);

      this.trail = L.polyline([], {
        color: '#FACC55',
        weight: 2,
        opacity: 0.8,
        dashArray: '1 7',
      }).addTo(this.map);

      this.marker = L.marker([first.lat, this.unwrapped[0]], {
        icon: L.divIcon({
          className: 'santa-sleigh-icon',
          html: '<div class="santa-sleigh-icon__inner">' + SLEIGH_SVG + '</div>',
          iconSize: [64, 40],
          iconAnchor: [32, 20],
        }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(this.map);

      // Dragging the map pauses "follow Santa" mode
      var self = this;
      this.map.on('dragstart', function () {
        self.follow = false;
        if (self.followBtn) self.followBtn.hidden = false;
      });
    }

    enableFollow() {
      this.follow = true;
      if (this.followBtn) this.followBtn.hidden = true;
    }

    startReplay() {
      this.replayOffset = Date.now();
      this.visitedCount = 0;
      if (this.trail) this.trail.setLatLngs([]);
      this.stopDots.forEach(function (dot) { dot.remove(); });
      this.stopDots = [];
      this.state = ''; // force a state refresh on next tick
      this.tick();
    }

    renderLive(elapsed) {
      var pos = routePosition(this.route, elapsed);
      var lng = this.markerLng(pos);

      this.marker.setLatLng([pos.lat, lng]);
      var inner = this.marker.getElement() && this.marker.getElement().querySelector('.santa-sleigh-icon__inner');
      if (inner) inner.classList.toggle('is-eastbound', pos.headingEast);

      if (this.follow) this.map.panTo([pos.lat, lng], { animate: true, duration: 0.25 });

      // Extend the trail with newly visited stops
      while (this.visitedCount <= pos.stopIndex) {
        var s = this.route.stops[this.visitedCount];
        this.trail.addLatLng([s.lat, this.unwrapped[this.visitedCount]]);
        if (this.visitedCount > 0 && this.visitedCount < this.route.stops.length - 1) {
          this.stopDots.push(L.circleMarker([s.lat, this.unwrapped[this.visitedCount]], {
            radius: 3, color: '#FACC55', fillColor: '#FACC55', fillOpacity: 0.9, weight: 1,
          }).addTo(this.map));
        }
        this.visitedCount++;
      }

      this.setInfo('status', pos.status === 'delivering'
        ? 'Delivering presents in ' + pos.current.city + '!'
        : 'Flying to ' + pos.next.city);
      this.setInfo('current', pos.current.city + ', ' + pos.current.region);
      this.setInfo('next', pos.next ? pos.next.city + ', ' + pos.next.region : '—');
      this.setInfo('presents', NUMBER_FORMAT.format(pos.presents));
    }

    markerLng(pos) {
      // Use the unwrapped longitude of the surrounding leg so marker and trail agree
      var fromLng = this.unwrapped[pos.stopIndex];
      if (pos.status !== 'flying') return fromLng;
      var toLng = this.unwrapped[Math.min(pos.stopIndex + 1, this.unwrapped.length - 1)];
      // Re-derive flight fraction from the wrapped lng relative to the leg
      var span = toLng - fromLng;
      if (Math.abs(span) < 1e-9) return fromLng;
      var wrappedFrom = pos.current.lng;
      var d = pos.lng - wrappedFrom;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      var wrappedSpan = pos.next.lng - wrappedFrom;
      if (wrappedSpan > 180) wrappedSpan -= 360;
      if (wrappedSpan < -180) wrappedSpan += 360;
      if (Math.abs(wrappedSpan) < 1e-9) return fromLng;
      return fromLng + (d / wrappedSpan) * span;
    }

    setInfo(key, value) {
      var el = this.querySelector('[data-info="' + key + '"]');
      if (el && el.textContent !== value) el.textContent = value;
    }

    /* ---------- Snow ---------- */

    initSnow() {
      var layer = this.querySelector('[data-snow-layer]');
      if (!layer || this.dataset.snow !== 'true') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var flakes = window.innerWidth < 750 ? 30 : 60;
      var html = '';
      for (var i = 0; i < flakes; i++) {
        var size = (Math.random() * 0.5 + 0.3).toFixed(2);
        html += '<span class="santa-snowflake" style="' +
          'left:' + (Math.random() * 100).toFixed(1) + '%;' +
          'animation-duration:' + (Math.random() * 8 + 7).toFixed(1) + 's;' +
          'animation-delay:-' + (Math.random() * 15).toFixed(1) + 's;' +
          'font-size:' + size + 'em;' +
          'opacity:' + (Math.random() * 0.5 + 0.3).toFixed(2) + ';' +
          '"></span>';
      }
      layer.innerHTML = html;
    }
  }

  customElements.define('santa-tracker', SantaTracker);
})();
