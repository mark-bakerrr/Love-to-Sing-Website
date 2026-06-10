# Santa Tracker — "Most Epic on the Internet" v2 Roadmap

> Research + plan for evolving the Love to Sing Santa tracker from the working
> v1 (full‑page three.js globe with chase cam + stats panel) into a
> best‑in‑class experience that out‑delights Google's and NORAD's trackers.
> Living document — pick and choose; everything is phased so we ship value early.

---

## 1. North star

A child opens the page on Christmas Eve and is **immediately transported**: a
gorgeous, music‑filled, photoreal night‑Earth with Santa's sleigh streaking
between cities, *their own town* called out by name with a live "Santa reaches
you in 3h 12m" countdown — and enough to explore (drag the globe, scrub the
journey, tap a city, watch presents tick up) that they stay, share, and come
back. Every pixel says **Love to Sing**, and every idle moment nudges gently
toward the Christmas songs.

Design principles:
- **Magic over realism** — accuracy serves wonder, not the other way round.
- **Works for a 6‑year‑old on a cheap Android** — performance and clarity first.
- **Personal** — "your city," your timezone, your arrival time.
- **On‑brand** — Love to Sing colours, logo, music, and a clear path to songs.

---

## 2. Where v1 stands (baseline)

Already shipped on the `christmas-countdown` section (`sections/christmas-countdown.liquid`,
`assets/santa-tracker.js`, `assets/santa-tracker.css`):

- Three states driven purely by UTC clock vs. a pre‑generated route
  (`assets/santa-route.json`, ~200 stops with `lat/lng/t/d/p`): **pre**
  (countdown), **live** (globe), **post** (Merry Christmas + replay).
- three.js r128 globe: textured earth, atmosphere halo, star field, low‑poly
  sleigh + reindeer + Rudolph, golden great‑circle trail, visited‑stop dots.
- **Chase camera** that flies behind the sleigh along the route.
- Stats panel (desktop left / mobile bottom‑sheet via floating banner): status,
  last stop, next stop, presents delivered, CTA.
- QA tooling: `?santa_time=`, `?santa_speed=`, `?santa_debug=1`; self‑healing
  canvas resize for the Shopify editor; reduced‑motion handling; snow.

**Known gaps v2 should close:** flat single earth texture (no day/night/clouds);
no audio; camera is fixed‑follow (not draggable/free); no "your city" / arrival
time / local stats; no timeline scrubber; sleigh is blocky; no shareability;
route is hand‑generated, not yet realistic to local midnight per timezone.

---

## 3. The seven pillars

### Pillar A — World‑class visuals

| Upgrade | What | How |
|---|---|---|
| **Day/night Earth shader** | Lit side shows Blue Marble; dark side glows with Black Marble **city lights** — and Santa flies along the moving terminator (midnight line), so the lights *just* ahead of him are the places still waiting. This is the single most magical visual win. | Custom `ShaderMaterial` mixing day/night textures by `dot(normal, sunDir)`; sun positioned from real date. NASA Blue Marble + Black Marble are public domain. ([NASA SVS day/night](https://svs.gsfc.nasa.gov/5477/), [Three.js Journey earth shaders](https://threejs-journey.com/lessons/earth-shaders)) |
| **Animated clouds layer** | Semi‑transparent cloud sphere rotating slowly, casting soft shadows. | Second sphere at r×1.005 with cloud alpha texture; or pack clouds into the green channel of a "specular‑clouds" map. |
| **Specular oceans + bump** | Oceans catch moonlight; mountains have relief. | Specular map (red channel) + normal/bump map on the day material. |
| **Aurora + Milky Way** | Aurora ribbons near the poles, a real Milky Way skybox instead of random dots. | Cubemap/equirect star background; aurora as an additive shader band. |
| **Sleigh glow‑up** | Replace the primitive sleigh with a proper glTF model — detailed sleigh, 8 reindeer in harness, glowing Rudolph nose, **particle sparkle trail** + light streak. | Load a CC/royalty‑free glTF via `GLTFLoader`; add a `Points` sparkle emitter behind it. Keep the primitive as a low‑end fallback. |
| **Cinematic polish** | Bloom on lights/Rudolph, subtle film grain, vignette, depth‑of‑field on the globe. | `EffectComposer` + `UnrealBloomPass` (guard for perf; disable on low‑end). |
| **City beacons** | Visited cities bloom with a gold **ring ripple**; the next city pulses. | Expanding ring shader (à la globe.gl rings layer). |

### Pillar B — Music & sound (huge, currently missing)

- **Looping score**: a gentle, loop‑friendly orchestral/sleigh‑bell bed — ideally
  an **original Love to Sing instrumental** so it doubles as brand + is fully
  licensed. Web Audio API with a soft fade‑in.
- **Must be tap‑to‑start & muted by default** (browsers block autoplay; also
  respectful). Big friendly 🔊/🔇 toggle; remember choice in `localStorage`.
- **Reactive SFX**: sleigh‑bell "whoosh" on each city arrival, a soft "ho ho ho"
  on milestone cities (your city, big cities), a chime when the presents counter
  rolls past round billions.
- **"Now playing" hook**: when idle, surface a Love to Sing Christmas track with a
  "Listen to the full song →" link to the collection. Directly ties the magic to
  the catalogue.
- **Accessibility**: never essential; full captions/visual equivalents; respect
  `prefers-reduced-motion` (no audio auto‑anything).

### Pillar C — The tracker & data (realistic + trustworthy)

- **Timezone‑accurate route generation**: regenerate `santa-route.json` so Santa
  reaches each city at *its* local midnight (or local evening), sweeping the date
  line westward — the way the real magic "works." Today's route is hand‑built;
  v2 should compute arrival times from each city's IANA timezone + the date.
  (`scripts/generate-santa-route.js` already exists — extend it with a timezone
  lookup so arrival = local‑midnight in UTC.)
- **Richer per‑stop data**: population‑weighted present counts, distance between
  stops, cumulative distance/speed ("Santa is travelling at 6,200 km/h!"),
  weather flavour text, a fun fact per city.
- **More cities, smarter density**: hundreds of stops, denser in populous regions;
  keep payload lean with a compact binary/typed‑array or gzipped JSON.
- **Live‑feel counters**: presents and distance interpolate smoothly every frame
  (not just per stop), with odometer‑style rolling digits.

### Pillar D — Interactivity (drag, scrub, explore)

- **Draggable / free‑orbit globe**: let users grab and spin the Earth, pinch‑zoom,
  and a **"Follow Santa" button** to snap back to the chase cam (the v1 follow
  pattern, upgraded). `OrbitControls` with damping; auto‑return to follow after
  a few idle seconds.
- **Timeline scrubber**: a draggable bar along the bottom to **scrub the whole
  journey** — drag to rewind/fast‑forward Santa anywhere on the route. (Internally
  this is just driving `elapsed` from the slider instead of the clock — v1's
  replay already proves the engine supports arbitrary `elapsed`.)
- **Click/tap a city**: fly the camera to it, show a card — local time, when Santa
  arrived/arrives, presents delivered there, the fun fact.
- **"Drag the Santa track"** (stretch): let advanced users reroute by dragging
  waypoints and watch the great‑circle path re‑solve — a playful sandbox mode.
- **Speed toggle** for impatient kids: 1× / 60× / "warp" so they can watch the
  whole night in a minute (promote the existing `santa_speed`).

### Pillar E — Personalisation ("your city," local stats, ETA)

This is what makes people feel it's *for them* — and what Google nails.

- **Detect location** (with permission): `navigator.geolocation` → reverse‑geocode
  to a city. Use an **offline reverse‑geocoder** (~217 kB, S2‑cell based, no API
  key, privacy‑friendly) with a graceful **IP fallback** if permission is denied.
  ([offline-geocode-city](https://github.com/kyr0/offline-geocode-city),
  [BigDataCloud free reverse geocode](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api))
- **"Santa reaches *Auckland* in 03:11:42"** — find the nearest route stop to the
  user and run a live local countdown to his arrival; afterwards show "Santa
  visited you at 12:04am 🎁".
- **Local timezone + clock**: show the user's local time and Santa's current local
  time side by side. Luxon for timezone‑aware math.
  ([Geoapify timezone from lat/long](https://www.geoapify.com/get-timezone-from-lat-long-geographical-coordinates/))
- **"Distance from you": "Santa is 8,400 km away, heading your way."**
- **No‑permission path**: a tasteful city picker ("Where are you?") so everyone
  gets the personalised experience.

### Pillar F — Engagement, content & shareability

- **Pre‑Christmas mode** (before lift‑off): the current countdown, plus light
  activities — a "letter to Santa," a Love to Sing carol of the day, a snow‑globe
  toy — so the page is worth visiting in early December (Google's village does
  exactly this and it drives repeat traffic).
- **Share card**: "Santa is over Tokyo 🎅 — 3.5 billion presents delivered!" with a
  one‑tap share + auto‑generated image (canvas snapshot) for socials.
- **Milestone moments**: confetti + bell when Santa hits the user's city, when he
  crosses into a new continent, and at the finale.
- **Finale**: a warm "Merry Christmas from Love to Sing" with the replay button,
  a featured song, and a gentle shop CTA.
- **SEO/seasonal landing**: this page is a annual traffic magnet — make it
  crawlable, fast, and linked from the nav in December.

### Pillar G — Performance, accessibility, robustness

- **Tiered quality**: detect device class (GPU, DPR, mobile) and scale —
  shaders/bloom/clouds on desktop, simpler material on low‑end, **2D fallback**
  (or static hero) if WebGL is unavailable. v1 already degrades to the stats
  panel on no‑WebGL; formalise the tiers.
- **Asset budget**: textures are the cost — use compressed **KTX2/Basis** GPU
  textures, lazy‑load the heavy earth maps only when entering live state (v1
  already defers three.js + route until live).
- **Battery/idle**: pause the render loop when the tab is hidden
  (`visibilitychange`) and throttle when idle.
- **A11y**: full keyboard control of the scrubber/buttons, ARIA live regions for
  status (v1 has these), captions for audio, reduced‑motion path that stops the
  globe spin and snow.
- **Shopify reality**: keep it a self‑contained section + assets (no app needed);
  watch the theme editor's canvas‑resize quirk (already handled); avoid blocking
  the storefront's main thread on load.

---

## 4. Tech recommendations

- **Globe**: consider migrating to **`three-globe` / `globe.gl`** (by vasturiano)
  — a mature ThreeJS globe with built‑in **arcs, points, rings, paths, labels,
  custom layers, day/night** out of the box. It would replace a lot of our
  hand‑rolled trail/dot/marker code and give ripple rings + arcs cheaply. Trade‑off:
  another dependency and less low‑level control of the chase cam. **Recommendation:**
  prototype the route as a `globe.gl` path layer; keep our custom chase‑cam logic
  on top. ([globe.gl](https://globe.gl/), [three-globe](https://github.com/vasturiano/three-globe))
- **Three.js version**: stay on a pinned local copy (we self‑host `three.min.js`
  for Shopify). If we adopt shaders/glTF/bloom, move to a current three.js + the
  examples modules we need (GLTFLoader, OrbitControls, EffectComposer).
- **Textures**: NASA **Blue Marble** (day) + **Black Marble** (night lights) +
  clouds + specular + normal — all public‑domain/royalty‑free. Downscale to
  4k/8k and KTX2‑compress.
- **Audio**: Web Audio API; **commission/produce an original Love to Sing loop**
  to avoid licensing issues and reinforce brand.
- **Time/timezone**: **Luxon** (tree‑shakeable, IANA tz aware).
- **Geocoding**: **offline-geocode-city** (client‑side, no key) + optional
  BigDataCloud IP fallback.
- **Route gen**: extend `scripts/generate-santa-route.js` with a city→timezone
  table so arrivals land at local midnight; output compact typed JSON.

---

## 5. Phased roadmap

**Phase 1 — "Looks/feels premium" (quick wins, low risk)**
1. Day/night Earth shader + city lights (biggest visual payoff).
2. Animated clouds + specular oceans + bloom on Rudolph/lights.
3. Original looping music + mute toggle + arrival bell SFX.
4. Smooth odometer counters for presents/distance.

**Phase 2 — "It's about me" (personalisation + interactivity)**
5. Geolocation → your city → live "Santa reaches you in…" + local clock.
6. Draggable/free‑orbit globe + "Follow Santa" snap‑back.
7. Timeline scrubber to scrub the whole journey.
8. Click‑a‑city cards (local time, arrival, fun fact).

**Phase 3 — "Most epic" (depth + reach)**
9. glTF sleigh + 8 reindeer + particle trail.
10. Timezone‑accurate regenerated route (local‑midnight arrivals) + more cities.
11. Share card + milestone confetti + finale.
12. Pre‑Christmas village/activities + carol of the day.

**Cross‑cutting (every phase):** performance tiers, accessibility, KTX2 assets,
tab‑hidden pause, graceful fallbacks.

---

## 6. Open decisions for Mark

1. **Music**: produce an original Love to Sing loop, or license a track? (Original
   is best for brand + licensing.)
2. **Globe library**: migrate to `globe.gl`, or keep extending our custom engine?
3. **Scope for this season**: which phase do we commit to before December? (Phase 1
   alone already makes it feel world‑class.)
4. **Geolocation**: OK to ask for location permission, with a city‑picker fallback?
5. **Page role**: keep as a hidden seasonal page, or promote in the nav + SEO it as
   an annual traffic driver?
6. **Header**: keep the site header hidden during the live globe (current), or show
   a slim branded bar?

---

## 7. Sources
- Google Santa Tracker — features & live dashboard: <https://santatracker.google.com/>, <https://en.wikipedia.org/wiki/Google_Santa_Tracker>
- globe.gl / three-globe (arcs, points, rings, day/night): <https://globe.gl/>, <https://github.com/vasturiano/three-globe>
- NASA day/night Blue/Black Marble: <https://svs.gsfc.nasa.gov/5477/>
- Three.js earth day/night shaders: <https://threejs-journey.com/lessons/earth-shaders>, <https://sangillee.com/2024-06-07-create-realistic-earth-with-shaders/>
- Offline reverse geocoding: <https://github.com/kyr0/offline-geocode-city>; IP fallback: <https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api>
- Timezone from coordinates: <https://www.geoapify.com/get-timezone-from-lat-long-geographical-coordinates/>
