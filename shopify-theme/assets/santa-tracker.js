/**
 * Santa Tracker — countdown + live 3D globe playback.
 *
 * Like the NORAD / Google trackers, there is no live data: Santa follows a
 * pre-generated route (santa-route.json) on a fixed UTC schedule, and the
 * client interpolates his position from the current time. Times in the route
 * are offsets (seconds) from the departure instant set on the section.
 *
 * The live view is a three.js globe with a chase camera flying behind the
 * sleigh. Stats live in a side panel (desktop) or a tap-to-open sheet
 * (tablet/mobile).
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

  // Unwrap longitudes so a 2D trail polyline never jumps across the date line
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

  var NUMBER_FORMAT = new Intl.NumberFormat();

  var GLOBE_R = 1;          // earth radius (scene units)
  var FLY_ALT = 1.03;       // sleigh altitude
  var TRAIL_ALT = 1.012;    // trail / stop dots altitude
  var ARC_STEPS = 10;       // line segments per route leg

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

  var HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return HTML_ESCAPES[c]; });
  }

  // Soft round sprite so stars/sparkles render as glowing dots, not squares
  var _discTex = null;
  function discTexture() {
    if (_discTex) return _discTex;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    _discTex = new THREE.CanvasTexture(c);
    return _discTex;
  }

  // Standard three.js equirectangular mapping (lng 0 faces -X)
  function latLngToV3(lat, lng, r) {
    var phi = toRad(90 - lat);
    var theta = toRad(lng + 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // Great-circle distance between two lat/lng points, in km
  function haversineKm(a, b) {
    var R = 6371;
    var dLat = toRad(b[0] - a[0]);
    var dLng = toRad(b[1] - a[1]);
    var la1 = toRad(a[0]);
    var la2 = toRad(b[0]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Sub-solar point (lat/lng where the sun is overhead) for a given instant.
  // Simplified astronomy — accurate to ~1°, which is plenty for lighting.
  function subSolarPoint(date) {
    var d = new Date(date);
    var start = Date.UTC(d.getUTCFullYear(), 0, 0);
    var dayOfYear = Math.floor((d.getTime() - start) / 86400000);
    // Solar declination (deg): peaks ±23.44 at the solstices
    var decl = -23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
    // Sub-solar longitude: 12:00 UTC ≈ 0°E, moving westward as UTC advances
    var utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var lng = -15 * (utcHours - 12);
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return { lat: decl, lng: lng };
  }

  // Day/night earth: blend Blue Marble (lit) with Black Marble city lights
  // (dark side), plus a subtle ocean specular from the sun.
  var EARTH_VERT = [
    'varying vec2 vUv;',
    'varying vec3 vNormal;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vUv = uv;',
    '  vNormal = normalize(normal);',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n');

  var EARTH_FRAG = [
    'uniform sampler2D dayTex;',
    'uniform sampler2D nightTex;',
    'uniform sampler2D specTex;',
    'uniform vec3 sunDir;',
    'varying vec2 vUv;',
    'varying vec3 vNormal;',
    'varying vec3 vWorldPos;',
    'void main() {',
    '  vec3 n = normalize(vNormal);',
    '  float sun = dot(n, sunDir);',
    '  vec3 day = texture2D(dayTex, vUv).rgb;',
    '  vec3 lights = texture2D(nightTex, vUv).rgb;',
    // crisp, bright daylight (lifted like the NORAD globe)
    '  day = pow(day, vec3(0.88)) * 1.18;',
    // night side stays a VISIBLE cool-blue moonlit world (never black) + warm city lights
    '  vec3 nightBase = day * vec3(0.40, 0.55, 1.0) * 0.55;',
    '  vec3 cityGlow = lights * vec3(1.35, 1.15, 0.78) * 1.7;',
    '  vec3 nightCol = nightBase + cityGlow;',
    // soft, wide terminator so most of the disc reads bright and easy on the eyes
    '  float dayMix = smoothstep(-0.25, 0.35, sun);',
    '  vec3 col = mix(nightCol, day, dayMix);',
    // ocean sun-glint on the lit side
    '  float ocean = texture2D(specTex, vUv).r;',
    '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
    '  vec3 refl = reflect(-sunDir, n);',
    '  float spec = pow(max(dot(viewDir, refl), 0.0), 20.0) * ocean * dayMix;',
    '  col += vec3(0.85, 0.92, 1.0) * spec * 0.45;',
    // gentle fresnel atmosphere brightening at the limb
    '  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);',
    '  col += vec3(0.35, 0.55, 0.95) * fres * 0.5;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  class SantaTracker extends HTMLElement {
    connectedCallback() {
      this.departure = Date.parse(this.dataset.departure);
      this.route = null;
      this.three = null;
      this.loading = false; // re-init cleanly if the editor reattaches the element
      this.replayOffset = null;
      this.state = '';
      this.visitedCount = 0;

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

      var self = this;
      var replayBtn = this.querySelector('[data-action="replay"]');
      if (replayBtn) replayBtn.addEventListener('click', this.startReplay.bind(this));

      var toggleBtn = this.querySelector('[data-action="toggle-panel"]');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          var live = self.panels.live;
          var open = live.classList.toggle('is-panel-open');
          toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }

      this.soundOn = false;
      var soundBtn = this.querySelector('[data-action="toggle-sound"]');
      if (soundBtn) {
        this.soundBtn = soundBtn;
        soundBtn.addEventListener('click', this.toggleSound.bind(this));
      }

      // Personalisation: location + city picker
      this.baseTimeBase = this.timeBase; // for "Go Live" to restore QA time too
      this.yourStop = null;
      var locateBtn = this.querySelector('[data-action="locate"]');
      if (locateBtn) locateBtn.addEventListener('click', this.locateMe.bind(this));
      var picker = this.querySelector('[data-city-picker]');
      if (picker) {
        this.cityPicker = picker;
        picker.addEventListener('change', function () {
          var idx = parseInt(picker.value, 10);
          if (!isNaN(idx)) self.setYourStop(idx);
        });
      }

      this.initSnow();
      this.timer = setInterval(this.tick.bind(this), 250);
      this.tick();
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      clearInterval(this.musicFade);
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.music) this.music.pause();
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      clearTimeout(this.idleReturn);
      if (this.three && this.three.controls) this.three.controls.dispose();
      if (this.three && this.three.renderer) this.three.renderer.dispose();
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
        // The full-page globe hides the page scrollbar while live
        document.documentElement.classList.toggle('santa-live-active', state === 'live');
        if (state === 'live') this.setupLive();
      }

      if (state === 'pre') this.renderCountdown(-e);
      if (state === 'live' && this.route) {
        this.updateStats(e);
        this.updateRail(e);
        this.updateYouCard();
        this.updateLocalClock();
      }
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

    /* ---------- Live tracker (three.js globe) ---------- */

    setupLive() {
      if (this.loading) return;
      this.loading = true;
      var self = this;
      var loadThree = window.THREE ? Promise.resolve() : loadScript(this.dataset.threeJs);
      loadThree
        .then(function () {
          // OrbitControls depends on THREE being present, so load it after three
          if (self.dataset.orbitJs && !(window.THREE && THREE.OrbitControls)) {
            return loadScript(self.dataset.orbitJs).catch(function () { /* optional */ });
          }
        })
        .then(function () {
          return fetch(self.dataset.routeUrl).then(function (r) { return r.json(); });
        })
        .then(function (route) {
          self.route = route;
          self.populateCityPicker();
          self.buildRail();
          self.initGlobe();
        })
        .catch(function (err) {
          console.error('Santa tracker failed to load', err);
          self.showError(err && (err.message || String(err)));
        });
    }

    showError(detail) {
      var fallback = this.querySelector('[data-tracker-error]');
      if (fallback) fallback.hidden = false;
      // ?santa_debug=1 — surface the failure reason on the page for QA
      if (detail && param('santa_debug')) {
        if (fallback) {
          fallback.textContent = 'DEBUG: ' + detail;
        }
      }
    }

    debugNote(msg) {
      if (!param('santa_debug')) return;
      var fallback = this.querySelector('[data-tracker-error]');
      if (fallback) {
        fallback.hidden = false;
        fallback.textContent = 'DEBUG: ' + msg;
      }
    }

    initGlobe() {
      var host = this.querySelector('[data-globe]');
      if (!host || !window.THREE) return this.showError();

      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch (e) {
        return this.showError(); // no WebGL — keep the stats panel, lose the globe
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.01, 200);

      // Real sun direction so there's a genuine day/night terminator — Santa
      // delivers at local midnight, so he flies the dark side over city lights.
      var sun = new THREE.DirectionalLight(0xfff3d6, 1.2);
      sun.intensity = 1.4;
      sun.color.setHex(0xfff4e0);
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0x4a5f9e, 0.95)); // bright, cool fill so models read clearly
      scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a2748, 0.55));

      var loader = new THREE.TextureLoader();
      var ds = this.dataset;
      function tex(url) {
        var t = loader.load(url);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy
          ? renderer.capabilities.getMaxAnisotropy() : 1;
        return t;
      }

      // Earth — custom day/night shader (Blue Marble + Black Marble city lights)
      var earthMat = new THREE.ShaderMaterial({
        uniforms: {
          dayTex: { value: tex(ds.earthDay) },
          nightTex: { value: tex(ds.earthNight) },
          specTex: { value: tex(ds.earthSpec || ds.earthDay) },
          sunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
      });
      var earth = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 96, 96), earthMat);
      scene.add(earth);

      // Slowly drifting cloud shell, lit by the real sun (dark on the night side)
      var clouds = null;
      if (ds.earthClouds) {
        clouds = new THREE.Mesh(
          new THREE.SphereGeometry(GLOBE_R * 1.006, 96, 96),
          new THREE.MeshPhongMaterial({
            alphaMap: tex(ds.earthClouds),
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          })
        );
        scene.add(clouds);
      }

      // Soft atmosphere halo (brighter blue rim)
      var atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_R * 1.06, 64, 64),
        new THREE.MeshBasicMaterial({
          color: 0x6ba6ff,
          transparent: true,
          opacity: 0.28,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      scene.add(atmosphere);

      // Star field — bright white pinpoints + twinkling gold sparkle stars
      function sphereStars(count, rMin, rMax) {
        var pos = new Float32Array(count * 3);
        for (var i = 0; i < count; i++) {
          var u = Math.random() * 2 - 1;
          var th = Math.random() * Math.PI * 2;
          var s = Math.sqrt(1 - u * u);
          var r = rMin + Math.random() * (rMax - rMin);
          pos[i * 3] = r * s * Math.cos(th);
          pos[i * 3 + 1] = r * u;
          pos[i * 3 + 2] = r * s * Math.sin(th);
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return geo;
      }
      var disc = discTexture();
      scene.add(new THREE.Points(sphereStars(1500, 30, 80), new THREE.PointsMaterial({
        color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true,
        opacity: 0.95, map: disc, depthWrite: false,
      })));
      var goldStarMat = new THREE.PointsMaterial({
        color: 0xffe08a, size: 1.1, sizeAttenuation: true, transparent: true,
        opacity: 0.9, map: disc, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      scene.add(new THREE.Points(sphereStars(120, 28, 70), goldStarMat));

      // Trailing gold "magic dust" behind the sleigh
      var SP = 70;
      var sparklePos = new Float32Array(SP * 3);
      var sparkleCol = new Float32Array(SP * 3);
      var sparkleGeo = new THREE.BufferGeometry();
      sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
      sparkleGeo.setAttribute('color', new THREE.BufferAttribute(sparkleCol, 3));
      var sparkle = new THREE.Points(sparkleGeo, new THREE.PointsMaterial({
        size: 0.04, vertexColors: true, transparent: true, map: disc,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      }));
      sparkle.frustumCulled = false;
      scene.add(sparkle);

      // Golden trail of visited legs (preallocated, revealed via draw range)
      var maxTrail = (this.route.stops.length - 1) * ARC_STEPS + 1;
      var trailPos = new Float32Array(maxTrail * 3);
      var trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeo.setDrawRange(0, 0);
      var trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
        color: 0xfacc55, transparent: true, opacity: 0.85,
      }));
      scene.add(trail);

      // Visited stop dots
      var dotPos = new Float32Array(this.route.stops.length * 3);
      var dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
      dotGeo.setDrawRange(0, 0);
      scene.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({
        color: 0xfacc55, size: 0.02, sizeAttenuation: true,
      })));

      var sleigh = this.buildSleigh();
      scene.add(sleigh);

      this.three = {
        renderer: renderer,
        scene: scene,
        camera: camera,
        sun: sun,
        earthMat: earthMat,
        clouds: clouds,
        host: host,
        trailGeo: trailGeo,
        trailPos: trailPos,
        trailCount: 0,
        dotGeo: dotGeo,
        dotPos: dotPos,
        dotCount: 0,
        sleigh: sleigh,
        goldStarMat: goldStarMat,
        sparkleGeo: sparkleGeo,
        sparklePos: sparklePos,
        sparkleCol: sparkleCol,
        sparkleHead: 0,
        sparkleCount: SP,
        lastForward: new THREE.Vector3(0, 0, 1),
        camLook: new THREE.Vector3(),
        camInit: false,
      };
      this.visitedCount = 0;
      this.revealReady = false;
      this.dispP = null;
      this.dispD = null;
      this.buildCumulativeDistance();

      // Reveal the sound button now the globe is up (if sound is enabled)
      if (this.dataset.sound === 'true' && this.soundBtn) this.soundBtn.hidden = false;

      var self = this;
      this.onResize = function () {
        var w = self.three.host.clientWidth;
        var h = self.three.host.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', this.onResize);

      this.setupControls();

      this.debugNote('init ok — host ' + host.clientWidth + 'x' + host.clientHeight +
        ', dpr ' + (window.devicePixelRatio || 1) + ', three r' + THREE.REVISION +
        ', orbit ' + (!!(window.THREE && THREE.OrbitControls)));

      this.rafId = requestAnimationFrame(this.renderFrame.bind(this));
    }

    /* ---------- Drag-to-orbit + Follow Santa ---------- */

    setupControls() {
      var T = this.three;
      this.freeMode = false;
      if (!(window.THREE && THREE.OrbitControls)) return;

      var controls = new THREE.OrbitControls(T.camera, T.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.5;
      controls.enablePan = false;
      controls.minDistance = GLOBE_R * 1.05;
      controls.maxDistance = GLOBE_R * 6;
      controls.target.set(0, 0, 0);
      // Stays enabled so it can detect the drag that flips us into free mode;
      // the chase branch simply ignores it (never calls update()) until then.
      T.controls = controls;

      var self = this;
      var followBtn = this.querySelector('[data-action="follow"]');
      if (followBtn) {
        this.followBtn = followBtn;
        followBtn.addEventListener('click', function () { self.exitFreeMode(); });
      }

      // Any drag on the globe switches to free-orbit; idle returns to follow
      controls.addEventListener('start', function () {
        clearTimeout(self.idleReturn);
        self.enterFreeMode();
      });
      controls.addEventListener('end', function () {
        clearTimeout(self.idleReturn);
        self.idleReturn = setTimeout(function () { self.exitFreeMode(); }, 9000);
      });
    }

    enterFreeMode() {
      var T = this.three;
      if (!T || !T.controls || this.freeMode) return;
      this.freeMode = true;
      T.camera.up.set(0, 1, 0);
      T.controls.update();
      if (this.followBtn) this.followBtn.hidden = false;
    }

    exitFreeMode() {
      var T = this.three;
      if (!T) return;
      clearTimeout(this.idleReturn);
      this.freeMode = false;
      T.camInit = true; // lerp smoothly back to the chase position
      if (this.followBtn) this.followBtn.hidden = true;
    }

    // Santa's sleigh + an 8-reindeer team in harness, built from primitives.
    // Faces +Z (direction of travel); the team strings out ahead of the sleigh.
    buildSleigh() {
      var g = new THREE.Group();
      var legs = [];

      var M = {
        red: new THREE.MeshPhongMaterial({ color: 0xd12f2a, shininess: 60, specular: 0x552020 }),
        darkRed: new THREE.MeshPhongMaterial({ color: 0x8f1714 }),
        gold: new THREE.MeshPhongMaterial({ color: 0xffce4d, emissive: 0x6e5210, shininess: 90, specular: 0xffffff }),
        green: new THREE.MeshPhongMaterial({ color: 0x3f8a4d }),
        skin: new THREE.MeshPhongMaterial({ color: 0xffd9b3 }),
        white: new THREE.MeshPhongMaterial({ color: 0xfdfdfd }),
        belt: new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 40 }),
        fur: new THREE.MeshPhongMaterial({ color: 0x9c6b3f }),
        furLight: new THREE.MeshPhongMaterial({ color: 0xc89a6a }),
        antler: new THREE.MeshPhongMaterial({ color: 0xe6d4ad }),
        hoof: new THREE.MeshPhongMaterial({ color: 0x3a2a1c }),
        nose: new THREE.MeshPhongMaterial({ color: 0xff3b30, emissive: 0xd11b10, shininess: 100 }),
      };
      function mesh(geo, mat, x, y, z) {
        var m = new THREE.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        return m;
      }

      /* ---- Sleigh ---- */
      var sleigh = new THREE.Group();
      // hull
      var hull = mesh(new THREE.BoxGeometry(0.52, 0.34, 0.82), M.red, 0, 0.2, -0.1);
      sleigh.add(hull);
      // swept-up front
      var front = mesh(new THREE.BoxGeometry(0.52, 0.5, 0.26), M.red, 0, 0.34, 0.34);
      front.rotation.x = -0.6;
      sleigh.add(front);
      var curl = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.54, 16, 1, false, 0, Math.PI), M.red, 0, 0.5, 0.48);
      curl.rotation.z = Math.PI / 2;
      sleigh.add(curl);
      // high back
      sleigh.add(mesh(new THREE.BoxGeometry(0.52, 0.42, 0.1), M.red, 0, 0.42, -0.48));
      // gold trim along the top rails
      [-0.26, 0.26].forEach(function (x) {
        sleigh.add(mesh(new THREE.BoxGeometry(0.04, 0.05, 0.95), M.gold, x, 0.37, -0.05));
      });
      // runners (curved up at the front)
      [-0.24, 0.24].forEach(function (x) {
        sleigh.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 1.15), M.gold, x, -0.02, 0));
        var tip = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), M.gold, x, 0.06, 0.6);
        tip.rotation.x = -0.7;
        sleigh.add(tip);
        sleigh.add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), M.gold, x, 0.08, 0.32));
      });
      // present sack with a gold star
      var sack = mesh(new THREE.SphereGeometry(0.2, 14, 12), M.green, 0, 0.4, -0.18);
      sack.scale.set(1, 1.15, 1);
      sleigh.add(sack);
      sleigh.add(mesh(new THREE.IcosahedronGeometry(0.05, 0), M.gold, 0.1, 0.56, -0.1));

      /* ---- Santa ---- */
      var santa = new THREE.Group();
      santa.add(mesh(new THREE.SphereGeometry(0.18, 16, 14), M.red, 0, 0.46, -0.12));
      santa.add(mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), M.belt, 0, 0.42, -0.12)); // belt
      santa.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), M.gold, 0, 0.42, 0.06)); // buckle
      santa.add(mesh(new THREE.SphereGeometry(0.11, 16, 14), M.skin, 0, 0.66, -0.1)); // head
      var beard = mesh(new THREE.SphereGeometry(0.1, 14, 12), M.white, 0, 0.62, -0.02);
      beard.scale.set(1, 1.1, 0.7);
      santa.add(beard);
      santa.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), M.white, 0, 0.73, -0.1)); // hat brim
      santa.add(mesh(new THREE.ConeGeometry(0.11, 0.22, 16), M.red, 0, 0.86, -0.12)); // hat
      var bobble = mesh(new THREE.SphereGeometry(0.045, 10, 10), M.white, 0, 0.97, -0.12);
      santa.add(bobble);
      sleigh.add(santa);
      g.add(sleigh);

      /* ---- Reindeer ---- */
      function makeReindeer(rudolph) {
        var r = new THREE.Group();
        var body = mesh(new THREE.BoxGeometry(0.16, 0.17, 0.4), M.fur, 0, 0, 0);
        body.geometry.translate(0, 0, 0);
        r.add(body);
        r.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), M.fur, 0, 0.01, 0.2)); // chest
        r.add(mesh(new THREE.BoxGeometry(0.13, 0.1, 0.34), M.furLight, 0, -0.06, 0)); // belly
        // neck + head
        var neck = mesh(new THREE.BoxGeometry(0.09, 0.18, 0.09), M.fur, 0, 0.12, 0.24);
        neck.rotation.x = -0.5;
        r.add(neck);
        var head = mesh(new THREE.BoxGeometry(0.11, 0.12, 0.15), M.fur, 0, 0.24, 0.32);
        r.add(head);
        r.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.08), M.furLight, 0, 0.21, 0.42)); // muzzle
        r.add(mesh(new THREE.SphereGeometry(rudolph ? 0.04 : 0.025, 10, 10), rudolph ? M.nose : M.hoof, 0, 0.21, 0.47));
        // ears
        [-0.06, 0.06].forEach(function (x) {
          r.add(mesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), M.furLight, x, 0.3, 0.3));
        });
        // antlers (a main prong + one branch each side)
        [-0.05, 0.05].forEach(function (x) {
          var a = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.18, 6), M.antler, x, 0.36, 0.3);
          a.rotation.x = -0.3; a.rotation.z = x > 0 ? -0.3 : 0.3;
          r.add(a);
          var b = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.09, 6), M.antler, x * 1.8, 0.43, 0.31);
          b.rotation.z = x > 0 ? -0.8 : 0.8;
          r.add(b);
        });
        // tail
        r.add(mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), M.furLight, 0, 0.04, -0.21));
        // 4 legs (pivot at hip so they can gallop)
        [[-0.07, 0.16], [0.07, 0.16], [-0.07, -0.14], [0.07, -0.14]].forEach(function (c) {
          var hip = new THREE.Group();
          hip.position.set(c[0], -0.08, c[1]);
          var leg = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), M.fur, 0, -0.1, 0);
          hip.add(leg);
          hip.add(mesh(new THREE.BoxGeometry(0.045, 0.04, 0.06), M.hoof, 0, -0.2, 0.01));
          r.add(hip);
          legs.push(hip);
        });
        return r;
      }

      // 4 pairs strung out ahead; Rudolph leads front-left
      var rows = [1.0, 1.7, 2.4, 3.1];
      for (var ri = 0; ri < rows.length; ri++) {
        [-0.22, 0.22].forEach(function (x) {
          var isRudolph = (ri === rows.length - 1 && x < 0);
          var deer = makeReindeer(isRudolph);
          deer.position.set(x, 0.06, rows[ri]);
          g.add(deer);
        });
      }

      // reins: two lines from the sleigh up to the lead pair
      var reinMat = new THREE.LineBasicMaterial({ color: 0x6b4a2a, transparent: true, opacity: 0.85 });
      [-0.2, 0.2].forEach(function (x) {
        var pts = [
          new THREE.Vector3(x * 0.9, 0.34, 0.45),
          new THREE.Vector3(x, 0.16, 1.0),
          new THREE.Vector3(x, 0.16, 1.7),
          new THREE.Vector3(x, 0.16, 2.4),
          new THREE.Vector3(x, 0.18, 3.1),
        ];
        var lg = new THREE.BufferGeometry().setFromPoints(pts);
        g.add(new THREE.Line(lg, reinMat));
      });

      g.userData.legs = legs;
      g.scale.setScalar(0.055);
      return g;
    }

    renderFrame(t) {
      this.rafId = requestAnimationFrame(this.renderFrame.bind(this));
      if (this.state !== 'live' || !this.three || !this.route) return;
      try {
        this.renderFrameInner(t);
      } catch (err) {
        cancelAnimationFrame(this.rafId);
        console.error('Santa globe render failed', err);
        this.showError(err && (err.message || String(err)));
      }
    }

    renderFrameInner(t) {
      var T = this.three;

      // Self-healing canvas size: the Shopify theme editor (and some theme
      // scripts) can blow away the canvas buffer size after init, leaving a
      // 0x0 canvas. Re-sync against the host every frame; skip frames while
      // the host has no layout box.
      var hw = T.host.clientWidth;
      var hh = T.host.clientHeight;
      if (!hw || !hh) return;
      if (T.lastW !== hw || T.lastH !== hh || T.renderer.domElement.width === 0) {
        T.lastW = hw;
        T.lastH = hh;
        T.camera.aspect = hw / hh;
        T.camera.updateProjectionMatrix();
        T.renderer.setSize(hw, hh);
      }

      var e = this.elapsed();
      var pos = routePosition(this.route, e);

      var p = latLngToV3(pos.lat, pos.lng, GLOBE_R * FLY_ALT);
      var up = p.clone().normalize();

      // Direction of travel: where will Santa be shortly?
      var lookAheadSec = this.replayOffset !== null ? 5 : 60;
      var aheadPos = routePosition(this.route, Math.min(e + lookAheadSec, this.routeDuration() - 0.01));
      var aheadP = latLngToV3(aheadPos.lat, aheadPos.lng, GLOBE_R * FLY_ALT);
      var forward = aheadP.clone().sub(p);
      forward.sub(up.clone().multiplyScalar(forward.dot(up))); // keep tangent to globe
      if (forward.lengthSq() < 1e-8) forward.copy(T.lastForward);
      forward.normalize();
      T.lastForward.copy(forward);

      // Sleigh: sit on the path with a gentle bob
      var bob = Math.sin(t / 500) * 0.004;
      T.sleigh.position.copy(p).addScaledVector(up, bob);
      T.sleigh.up.copy(up);
      var facing = p.clone().add(forward);
      T.sleigh.lookAt(facing);

      // Galloping reindeer legs
      var legs = T.sleigh.userData.legs;
      if (legs) {
        for (var li = 0; li < legs.length; li++) {
          // diagonal pairs swing together; legs 0,3 vs 1,2
          var phase = (li === 0 || li === 3) ? 0 : Math.PI;
          legs[li].rotation.x = Math.sin(t / 90 + phase) * 0.5;
        }
      }

      if (this.freeMode && T.controls) {
        // User is steering — let OrbitControls own the camera
        T.controls.update();
      } else {
        // Chase camera locked BEHIND Santa's heading. The up vector is the
        // local vertical (set every frame, so the horizon never tilts), and
        // the camera sits along the *smoothed* travel direction — so when
        // Santa banks north the whole globe rolls north with him, instead of
        // appearing to spin on a fixed axis.
        if (!T.smoothFwd) T.smoothFwd = forward.clone();
        else T.smoothFwd.lerp(forward, 0.08).normalize();
        var sf = T.smoothFwd;

        // Hero chase: close behind, a little above, and slightly over the
        // shoulder so Santa + the full reindeer team read in profile, with the
        // bright globe curving below. The side offset is in Santa's local frame
        // so it rotates with his heading (stays a consistent over-the-shoulder).
        var right = T.rightVec || (T.rightVec = new THREE.Vector3());
        right.crossVectors(sf, up).normalize();
        var desired = p.clone()
          .addScaledVector(sf, -0.42)
          .addScaledVector(up, 0.2)
          .addScaledVector(right, 0.16);
        if (desired.length() < GLOBE_R * 1.05) desired.setLength(GLOBE_R * 1.05);

        if (!T.camInit) {
          T.camera.position.copy(desired);
          T.camInit = true;
        } else {
          T.camera.position.lerp(desired, 0.1);
        }
        T.camera.up.copy(up); // local vertical → level horizon, no roll lag
        T.camera.lookAt(p.clone().addScaledVector(sf, 0.3).addScaledVector(up, -0.01));
      }

      // Trailing gold magic dust behind the sleigh
      if (T.sparklePos) {
        var hp = (Math.sin(t * 12.9898) * 43758.5453) % 1; // cheap deterministic jitter
        var h = T.sparkleHead;
        var jitterUp = (hp - 0.5) * 0.03;
        var sp = p.clone().addScaledVector(up, 0.004 + jitterUp).addScaledVector(forward, -0.02);
        T.sparklePos[h * 3] = sp.x + ((t * 0.7 % 1) - 0.5) * 0.02;
        T.sparklePos[h * 3 + 1] = sp.y;
        T.sparklePos[h * 3 + 2] = sp.z;
        T.sparkleCol[h * 3] = 1.0; T.sparkleCol[h * 3 + 1] = 0.82; T.sparkleCol[h * 3 + 2] = 0.35;
        for (var si = 0; si < T.sparkleCount; si++) {
          T.sparkleCol[si * 3] *= 0.95; T.sparkleCol[si * 3 + 1] *= 0.95; T.sparkleCol[si * 3 + 2] *= 0.95;
        }
        T.sparkleHead = (h + 1) % T.sparkleCount;
        T.sparkleGeo.attributes.position.needsUpdate = true;
        T.sparkleGeo.attributes.color.needsUpdate = true;
      }

      // Gentle twinkle on the gold sparkle stars
      if (T.goldStarMat) T.goldStarMat.opacity = 0.7 + Math.sin(t / 600) * 0.25;

      // Real sun direction for this instant → genuine day/night terminator.
      var ss = subSolarPoint(this.now());
      var sunDir = latLngToV3(ss.lat, ss.lng, 1).normalize();
      T.earthMat.uniforms.sunDir.value.copy(sunDir);
      T.sun.position.copy(sunDir).multiplyScalar(5); // lights the cloud shell

      // Clouds drift slowly westward
      if (T.clouds) T.clouds.rotation.y = t * 0.000012;

      // Reveal trail + dots for newly visited stops (and chime on arrival).
      // The first frame may catch up many stops at once (page loaded mid-route)
      // — stay silent until that initial reveal is done.
      while (this.visitedCount <= pos.stopIndex) {
        this.extendTrail(this.visitedCount);
        if (this.visitedCount > 0 && this.revealReady) this.onCityArrival(this.visitedCount);
        this.visitedCount++;
      }
      this.revealReady = true;

      this.renderOdometer(pos);

      this.frameCount = (this.frameCount || 0) + 1;
      if (param('santa_debug') && this.frameCount % 90 === 1) {
        var c = T.renderer.domElement;
        var r = c.getBoundingClientRect();
        this.debugNote('frame ' + this.frameCount +
          ' | draws ' + T.renderer.info.render.calls + ' tris ' + T.renderer.info.render.triangles +
          ' | canvas ' + c.width + 'x' + c.height + ' rect ' + Math.round(r.width) + 'x' + Math.round(r.height) +
          ' @' + Math.round(r.left) + ',' + Math.round(r.top) +
          ' inDOM ' + document.contains(c) +
          ' | cam ' + T.camera.position.x.toFixed(2) + ',' + T.camera.position.y.toFixed(2) + ',' + T.camera.position.z.toFixed(2));
      }

      T.renderer.render(T.scene, T.camera);
    }

    extendTrail(stopIndex) {
      var T = this.three;
      var stops = this.route.stops;
      var s = stops[stopIndex];

      if (stopIndex === 0) {
        var v0 = latLngToV3(s.lat, s.lng, GLOBE_R * TRAIL_ALT);
        T.trailPos[0] = v0.x; T.trailPos[1] = v0.y; T.trailPos[2] = v0.z;
        T.trailCount = 1;
      } else {
        var prev = stops[stopIndex - 1];
        for (var i = 1; i <= ARC_STEPS; i++) {
          var ll = slerp([prev.lat, prev.lng], [s.lat, s.lng], i / ARC_STEPS);
          var v = latLngToV3(ll[0], ll[1], GLOBE_R * TRAIL_ALT);
          var o = T.trailCount * 3;
          T.trailPos[o] = v.x; T.trailPos[o + 1] = v.y; T.trailPos[o + 2] = v.z;
          T.trailCount++;
        }
      }
      T.trailGeo.attributes.position.needsUpdate = true;
      T.trailGeo.setDrawRange(0, T.trailCount);

      if (stopIndex > 0 && stopIndex < stops.length - 1) {
        var dv = latLngToV3(s.lat, s.lng, GLOBE_R * TRAIL_ALT);
        var d = T.dotCount * 3;
        T.dotPos[d] = dv.x; T.dotPos[d + 1] = dv.y; T.dotPos[d + 2] = dv.z;
        T.dotCount++;
        T.dotGeo.attributes.position.needsUpdate = true;
        T.dotGeo.setDrawRange(0, T.dotCount);
      }
    }

    startReplay() {
      this.replayOffset = Date.now();
      this.visitedCount = 0;
      if (this.three) {
        this.three.trailCount = 0;
        this.three.trailGeo.setDrawRange(0, 0);
        this.three.dotCount = 0;
        this.three.dotGeo.setDrawRange(0, 0);
        this.three.camInit = false;
      }
      this.revealReady = false; // suppress the catch-up chime burst
      this.railCurrent = -1; // force the rail to repaint
      this.state = ''; // force a state refresh on next tick
      this.tick();
    }

    updateStats(elapsed) {
      var pos = routePosition(this.route, elapsed);
      this.setInfo('status', pos.status === 'delivering'
        ? 'Delivering in ' + pos.current.city + ' 🎁'
        : 'Flying to ' + (pos.next ? pos.next.city : 'the North Pole'));
    }

    /* ---------- Live itinerary rail ---------- */

    buildRail() {
      var rail = this.querySelector('[data-rail]');
      if (!rail || !this.route) return;
      this.rail = rail;
      var stops = this.route.stops;
      var frag = document.createDocumentFragment();
      this.railRows = [];
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        var li = document.createElement('li');
        li.className = 'santa-rail__row';
        li.innerHTML =
          '<span class="santa-rail__node" aria-hidden="true"></span>' +
          '<span class="santa-rail__city">' + escapeHtml(s.city) + '</span>' +
          '<span class="santa-rail__region">' + escapeHtml(s.region) + '</span>';
        frag.appendChild(li);
        this.railRows.push(li);
      }
      rail.appendChild(frag);
      this.railCurrent = -1;

      // Manual scroll pauses auto-follow for a few seconds
      var self = this;
      rail.addEventListener('scroll', function () {
        if (self.railAutoScrolling) return;
        self.railManualUntil = Date.now() + 6000;
      }, { passive: true });
    }

    updateRail(elapsed) {
      if (!this.railRows) return;
      var pos = routePosition(this.route, elapsed);
      var cur = pos.stopIndex;
      if (cur === this.railCurrent) return; // only re-paint when Santa moves on
      this.railCurrent = cur;

      var nextIdx = pos.next ? Math.min(cur + 1, this.railRows.length - 1) : cur;
      for (var i = 0; i < this.railRows.length; i++) {
        var row = this.railRows[i];
        var cls = 'santa-rail__row';
        if (i < cur) cls += ' is-visited';
        else if (i === cur) cls += pos.status === 'delivering' ? ' is-current is-delivering' : ' is-current';
        else if (i === nextIdx) cls += ' is-next';
        else cls += ' is-upcoming';
        if (row.className !== cls) row.className = cls;
      }

      // Auto-scroll the current city to the middle, unless the user just scrolled
      if (Date.now() < (this.railManualUntil || 0)) return;
      var target = this.railRows[cur];
      if (target && this.rail) {
        var top = target.offsetTop - this.rail.clientHeight / 2 + target.offsetHeight / 2;
        this.railAutoScrolling = true;
        this.rail.scrollTo({ top: top, behavior: 'smooth' });
        var self = this;
        clearTimeout(this.railScrollClear);
        this.railScrollClear = setTimeout(function () { self.railAutoScrolling = false; }, 700);
      }
    }

    /* ---------- Personalisation: your city + local clock ---------- */

    populateCityPicker() {
      if (!this.cityPicker || !this.route) return;
      var stops = this.route.stops;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        if (s.city === 'North Pole') continue; // not a delivery stop
        var opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = s.city + ', ' + s.region;
        frag.appendChild(opt);
      }
      this.cityPicker.appendChild(frag);
    }

    locateMe() {
      var self = this;
      if (!navigator.geolocation) return;
      var btn = this.querySelector('[data-action="locate"]');
      if (btn) btn.textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        function (p) { self.setNearestStop(p.coords.latitude, p.coords.longitude); if (btn) btn.textContent = '📍 Use my location'; },
        function () { if (btn) btn.textContent = '📍 Location unavailable — pick below'; },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
      );
    }

    setNearestStop(lat, lng) {
      var stops = this.route.stops;
      var best = -1, bestD = Infinity;
      for (var i = 0; i < stops.length; i++) {
        if (stops[i].city === 'North Pole') continue;
        var d = haversineKm([lat, lng], [stops[i].lat, stops[i].lng]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        this.setYourStop(best);
        if (this.cityPicker) this.cityPicker.value = String(best);
      }
    }

    setYourStop(idx) {
      this.yourStop = this.route.stops[idx];
      var cityEl = this.querySelector('[data-info="you-city"]');
      if (cityEl) cityEl.hidden = false;
      this.updateYouCard();
    }

    updateYouCard() {
      if (!this.yourStop) return;
      var arrival = this.departure + this.yourStop.t * 1000; // route times are real seconds
      var delta = (arrival - this.now()) / 1000;
      this.setInfo('you-city', this.yourStop.city + ', ' + this.yourStop.region);
      if (delta > 0) {
        this.setInfo('you-eta', 'Santa reaches you in ' + this.formatHMS(delta));
      } else {
        var when = new Date(arrival).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        this.setInfo('you-eta', '🎁 Santa visited you at ' + when + '!');
      }
    }

    updateLocalClock() {
      var el = this.querySelector('[data-info="local-clock"]');
      if (!el) return;
      el.textContent = new Date(this.now()).toLocaleTimeString([], {
        hour: 'numeric', minute: '2-digit', second: '2-digit',
      });
    }

    formatHMS(seconds) {
      var s = Math.floor(seconds);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      function pad(n) { return String(n).padStart(2, '0'); }
      return (h > 0 ? h + 'h ' : '') + pad(m) + 'm ' + pad(sec) + 's';
    }

    /* ---------- Smooth odometer counters ---------- */

    buildCumulativeDistance() {
      var stops = this.route.stops;
      this.cumKm = [0];
      for (var i = 1; i < stops.length; i++) {
        this.cumKm[i] = this.cumKm[i - 1] +
          haversineKm([stops[i - 1].lat, stops[i - 1].lng], [stops[i].lat, stops[i].lng]);
      }
    }

    renderOdometer(pos) {
      // Presents — ease the displayed value up to the route's running total
      if (this.dispP == null) this.dispP = pos.presents;
      this.dispP += (pos.presents - this.dispP) * 0.12;
      if (Math.abs(pos.presents - this.dispP) < 1) this.dispP = pos.presents;
      this.setInfo('presents', NUMBER_FORMAT.format(Math.round(this.dispP)));

      // Distance — cumulative to the last stop + the leg flown so far
      var stop = pos.current;
      var legKm = haversineKm([stop.lat, stop.lng], [pos.lat, pos.lng]);
      var tgtD = (this.cumKm ? this.cumKm[pos.stopIndex] || 0 : 0) + legKm;
      if (this.dispD == null) this.dispD = tgtD;
      this.dispD += (tgtD - this.dispD) * 0.12;
      this.setInfo('distance', NUMBER_FORMAT.format(Math.round(this.dispD)) + ' km');
    }

    /* ---------- Audio (synth chimes + optional music loop) ---------- */

    ensureAudio() {
      if (this.audioCtx) return this.audioCtx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.audioCtx = new AC();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.audioCtx.destination);
      return this.audioCtx;
    }

    toggleSound() {
      var ctx = this.ensureAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      this.soundOn = !this.soundOn;

      var btn = this.soundBtn;
      if (btn) {
        btn.setAttribute('aria-pressed', this.soundOn ? 'true' : 'false');
        btn.setAttribute('aria-label', this.soundOn ? 'Turn sound off' : 'Turn sound on');
        btn.classList.toggle('is-on', this.soundOn);
      }

      var now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.soundOn ? 0.7 : 0, now + 0.4);

      if (this.soundOn) {
        this.startMusic();
        this.playBell(true); // friendly confirmation chime
      } else if (this.music) {
        this.music.pause();
      }
    }

    startMusic() {
      var src = this.dataset.music;
      if (!src) return;
      if (!this.music) {
        this.music = new Audio(src);
        this.music.loop = true;
        this.music.volume = 0;
      }
      var self = this;
      this.music.play().then(function () {
        // gentle fade-in
        var step = 0;
        clearInterval(self.musicFade);
        self.musicFade = setInterval(function () {
          step++;
          self.music.volume = Math.min(0.35, step * 0.02);
          if (self.music.volume >= 0.35) clearInterval(self.musicFade);
        }, 80);
      }).catch(function () { /* autoplay/file issues — ignore */ });
    }

    onCityArrival(idx) {
      this.playBell(idx % 12 === 0);
    }

    // Quick sleigh-bell-ish chime synthesised on the fly — no audio asset needed
    playBell(strong) {
      if (!this.soundOn || !this.audioCtx) return;
      var ctx = this.audioCtx;
      var now = ctx.currentTime;
      var freqs = strong ? [1318.5, 1760, 2637] : [1567.98, 2093];
      for (var i = 0; i < freqs.length; i++) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freqs[i];
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.22 / (i + 1), now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    }

    setInfo(key, value) {
      var els = this.querySelectorAll('[data-info="' + key + '"]');
      for (var i = 0; i < els.length; i++) {
        if (els[i].textContent !== value) els[i].textContent = value;
      }
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
