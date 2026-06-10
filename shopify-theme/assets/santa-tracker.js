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

      var replayBtn = this.querySelector('[data-action="replay"]');
      if (replayBtn) replayBtn.addEventListener('click', this.startReplay.bind(this));

      var toggleBtn = this.querySelector('[data-action="toggle-panel"]');
      if (toggleBtn) {
        var self = this;
        toggleBtn.addEventListener('click', function () {
          var live = self.panels.live;
          var open = live.classList.toggle('is-panel-open');
          toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }

      this.initSnow();
      this.timer = setInterval(this.tick.bind(this), 250);
      this.tick();
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      if (this.rafId) cancelAnimationFrame(this.rafId);
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
      if (state === 'live' && this.route) this.updateStats(e);
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
      Promise.all([
        fetch(this.dataset.routeUrl).then(function (r) { return r.json(); }),
        window.THREE ? Promise.resolve() : loadScript(this.dataset.threeJs),
      ])
        .then(function (results) {
          self.route = results[0];
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
      var camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.01, 200);

      // Lights follow the camera so the visible hemisphere is always lit
      scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
      var sun = new THREE.DirectionalLight(0xfff3d6, 1.1);
      scene.add(sun);

      // Earth — slightly cool-tinted for a Christmas-night feel
      var earthTex = new THREE.TextureLoader().load(this.dataset.earthTexture);
      var earth = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_R, 64, 64),
        new THREE.MeshPhongMaterial({ map: earthTex, color: 0xd2ddff, shininess: 8 })
      );
      scene.add(earth);

      // Soft atmosphere halo
      var atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_R * 1.05, 64, 64),
        new THREE.MeshBasicMaterial({
          color: 0x5c8dff,
          transparent: true,
          opacity: 0.16,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      scene.add(atmosphere);

      // Star field
      var starCount = 1500;
      var starPos = new Float32Array(starCount * 3);
      for (var i = 0; i < starCount; i++) {
        var u = Math.random() * 2 - 1; // uniform point on a sphere shell
        var th = Math.random() * Math.PI * 2;
        var s = Math.sqrt(1 - u * u);
        var r = 30 + Math.random() * 50;
        starPos[i * 3] = r * s * Math.cos(th);
        starPos[i * 3 + 1] = r * u;
        starPos[i * 3 + 2] = r * s * Math.sin(th);
      }
      var starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85,
      })));

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
        host: host,
        trailGeo: trailGeo,
        trailPos: trailPos,
        trailCount: 0,
        dotGeo: dotGeo,
        dotPos: dotPos,
        dotCount: 0,
        sleigh: sleigh,
        lastForward: new THREE.Vector3(0, 0, 1),
        camLook: new THREE.Vector3(),
        camInit: false,
      };
      this.visitedCount = 0;

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

      this.debugNote('init ok — host ' + host.clientWidth + 'x' + host.clientHeight +
        ', dpr ' + (window.devicePixelRatio || 1) + ', three r' + THREE.REVISION);

      this.rafId = requestAnimationFrame(this.renderFrame.bind(this));
    }

    // Low-poly sleigh + reindeer built from primitives, facing +Z (direction of travel)
    buildSleigh() {
      var g = new THREE.Group();
      var red = new THREE.MeshPhongMaterial({ color: 0xc92a26, shininess: 30 });
      var darkRed = new THREE.MeshPhongMaterial({ color: 0x8f1714 });
      var gold = new THREE.MeshPhongMaterial({ color: 0xfacc55, emissive: 0x7a5c10 });
      var green = new THREE.MeshPhongMaterial({ color: 0x3f7a45 });
      var skin = new THREE.MeshPhongMaterial({ color: 0xffe3c4 });
      var white = new THREE.MeshPhongMaterial({ color: 0xfdefef });
      var brown = new THREE.MeshPhongMaterial({ color: 0x8a5a33 });

      // Sleigh body
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 1.15), red);
      body.position.y = 0.16;
      g.add(body);
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.12), darkRed);
      back.position.set(0, 0.4, -0.5);
      g.add(back);

      // Runners
      [-0.26, 0.26].forEach(function (x) {
        var runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.5), gold);
        runner.position.set(x, -0.04, 0.05);
        g.add(runner);
      });

      // Santa (body, head, hat)
      var santa = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), red);
      santa.position.set(0, 0.4, -0.22);
      g.add(santa);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), skin);
      head.position.set(0, 0.58, -0.22);
      g.add(head);
      var hat = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 12), red);
      hat.position.set(0, 0.7, -0.22);
      g.add(hat);
      var bobble = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), white);
      bobble.position.set(0, 0.79, -0.22);
      g.add(bobble);

      // Present sack
      var sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), green);
      sack.position.set(0, 0.36, 0.18);
      sack.scale.y = 1.15;
      g.add(sack);

      // Reindeer pairs out front
      [0.85, 1.35].forEach(function (z) {
        [-0.18, 0.18].forEach(function (x) {
          var deerBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.34), brown);
          deerBody.position.set(x, 0.12, z);
          g.add(deerBody);
          var deerHead = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), brown);
          deerHead.position.set(x, 0.24, z + 0.2);
          g.add(deerHead);
        });
      });
      // Rudolph's nose on the lead-left reindeer
      var nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xff3b30, emissive: 0xb00000 }));
      nose.position.set(-0.18, 0.24, 1.62);
      g.add(nose);

      g.scale.setScalar(0.05);
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

      // Chase camera: behind and above, looking past the sleigh
      var desired = p.clone().addScaledVector(forward, -0.45).addScaledVector(up, 0.22);
      if (desired.length() < GLOBE_R * 1.04) desired.setLength(GLOBE_R * 1.04);
      var look = p.clone().addScaledVector(forward, 0.35);

      if (!T.camInit) {
        T.camera.position.copy(desired);
        T.camLook.copy(look);
        T.camInit = true;
      } else {
        T.camera.position.lerp(desired, 0.06);
        T.camLook.lerp(look, 0.08);
      }
      T.camera.up.lerp(up, 0.06).normalize();
      T.camera.lookAt(T.camLook);

      // Keep the lit hemisphere facing the camera
      T.sun.position.copy(T.camera.position).multiplyScalar(2);

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

      // Reveal trail + dots for newly visited stops
      while (this.visitedCount <= pos.stopIndex) {
        this.extendTrail(this.visitedCount);
        this.visitedCount++;
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
      this.state = ''; // force a state refresh on next tick
      this.tick();
    }

    updateStats(elapsed) {
      var pos = routePosition(this.route, elapsed);
      this.setInfo('status', pos.status === 'delivering'
        ? 'Delivering presents in ' + pos.current.city + '!'
        : 'Flying to ' + (pos.next ? pos.next.city : 'the North Pole'));
      this.setInfo('current', pos.current.city + ', ' + pos.current.region);
      this.setInfo('next', pos.next ? pos.next.city + ', ' + pos.next.region : '—');
      this.setInfo('presents', NUMBER_FORMAT.format(pos.presents));
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
