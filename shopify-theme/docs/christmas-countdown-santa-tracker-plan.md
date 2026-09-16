# Christmas Countdown + Santa Tracker — Implementation Plan

A festive page on lovetosing.com that shows a **live countdown to Christmas**, then
automatically transforms into a **Santa tracker** (à la
[Google Santa Tracker](https://santatracker.google.com/) and
[NORAD Tracks Santa](https://www.noradsanta.org/en)) while Santa "flies" around the
world on Christmas Eve, and finishes with a "Merry Christmas" state on Christmas Day.

---

## 1. How Google / NORAD actually do it (and why we can too)

Neither tracker uses live data. Both run off a **pre-generated route file**: a list of
~400–500 destinations, each with coordinates, an arrival/departure timestamp on a fixed
UTC schedule, and a running "presents delivered" count. The client simply compares the
current time against the route and interpolates Santa's position between stops. Google's
implementation is open source ([google/santa-tracker-web](https://github.com/google/santa-tracker-web),
Apache 2.0) and confirms this — Santa departs the North Pole at **10:00 UTC on 24 Dec**
and finishes roughly 25 hours later, having "followed midnight" westward around the globe.

This means **no backend, no API, no server clock** — just a static JSON asset and
client-side JavaScript. Perfect fit for a Shopify theme.

**Brand bonus:** Love to Sing is a New Zealand brand, and because NZ sits just west of the
International Date Line, Santa visits **New Zealand among the very first places on Earth**.
The tracker can open on NZ and make a moment of it ("Santa always visits Aotearoa first!").

---

## 2. Page states (one page, time-driven)

| State | Window (configurable) | What the visitor sees |
|---|---|---|
| **A. Countdown** | Now → 24 Dec 10:00 UTC | Big animated countdown (days/hrs/min/sec), falling snow, festive hero, CTA to the Christmas songs collection |
| **B. Tracker live** | 24 Dec 10:00 UTC → 25 Dec ~11:00 UTC | World map with Santa's sleigh flying the route: current location, last/next stop, presents-delivered odometer, trail of visited stops |
| **C. Christmas** | After route ends | "Santa has delivered all the presents — Merry Christmas!" + optional route replay + CTA |

The state machine lives entirely in JS and re-evaluates every second, so the page flips
from countdown → tracker → finished without a deploy or any admin action on the night.

All timestamps are **fixed UTC** (like NORAD/Google) so every visitor worldwide sees Santa
in the same place at the same moment; the countdown itself renders in the visitor's local
time automatically since it's just a delta to a UTC instant.

---

## 3. Architecture (fits existing theme conventions)

This is an Online Store 2.0 theme: JSON page templates compose Liquid sections, JS lives
in `assets/*.js` loaded with `defer`, CSS in `assets/*.css`. The feature follows the same
pattern.

### New files

| File | Purpose |
|---|---|
| `sections/christmas-countdown.liquid` | The whole experience: markup for all three states, `{% schema %}` settings, loads its own JS/CSS |
| `templates/page.christmas-countdown.json` | Page template wiring the section in (like `page.styleguide.json`) |
| `assets/santa-tracker.js` | State machine, countdown ticker, route playback, marker animation (vanilla JS custom element, matching `youtube-player.js` / `cart-drawer.js` style) |
| `assets/santa-tracker.css` | Page styles, snow animation, flip-clock digits |
| `assets/santa-route.json` | The pre-baked route: ordered stops `{ city, region, lat, lng, arrival, departure, presentsDelivered }` |
| `assets/santa-sleigh.svg`, `assets/santa-marker.svg` | Sleigh + visited-stop markers |
| `snippets/snowfall.liquid` | Reusable CSS-only snow effect (could later be added site-wide in December) |

### Map: recommended approach — Leaflet + free dark basemap

- **Leaflet (~42 KB gz) + CARTO "dark matter" raster tiles** — free, no API key, no
  billing account, MIT licensed. Dark night-time map looks exactly like NORAD's.
- Custom sleigh icon as a rotated `L.Marker`, dotted polyline trail of visited stops,
  smooth pan that follows Santa (with a "follow Santa" toggle so users can explore).
- Position between stops = great-circle interpolation by timestamp.
- Leaflet is **lazy-loaded only during the live window** — countdown visitors never pay
  for it. Vendor the two files into `assets/` (theme already vendors `swiper-bundle.min.js`
  etc.) rather than relying on a CDN.

*Considered alternative:* a stylized flat SVG world map (zero dependencies, full art
control, no panning/zoom). Cheaper but less "exactly like NORAD"; Leaflet recommended.

### Route data generation

A small one-off Node script (kept in `apps/` or run locally, not shipped) generates
`santa-route.json` from a city list: ~450 cities sorted so Santa follows midnight westward
(starting Kiritimati → **Auckland/Wellington/Christchurch** → Australia → Asia → Europe →
Africa → Americas → ends North Pole), arrival times spread across the 25-hour window,
presents counter accumulating to ~7 billion. Google's open-source route is the structural
reference. File lands around 60–80 KB (~15 KB gzipped) — fine as a theme asset.

### Section settings (`{% schema %}`)

So marketing can tweak without code:

- Launch instant (departure date/time, UTC) and year — **reusable every year** by bumping
  one setting and regenerating timestamps
- Hero heading/subheading for each of the three states
- CTA link + label (default: `/collections/song-christmas`)
- Toggle: snow effect, "follow Santa" default, ambient music
- Optional featured Christmas song/video (theme already has `youtube-player.js`) — a
  Love to Sing Christmas song playing softly is strong brand tie-in (muted by default,
  user-initiated, per autoplay policies)

### Testing / QA in June 🎄

`?santa_time=2026-12-24T11:30:00Z` query-param override in `santa-tracker.js` lets us
simulate any moment — countdown, mid-flight over NZ, finished — without waiting for
December. (Ignored in production unless a debug flag is on, or just left in: harmless.)

---

## 4. Shopify admin steps (no code)

1. Create page **"Santa Tracker"** (suggest URL `/pages/santa-tracker`), assign the
   `page.christmas-countdown` template.
2. Add to main navigation (or only surface it via the announcement bar / homepage banner
   from late November — the page works year-round, it just shows a long countdown).
3. Optional: homepage hero banner + newsletter campaign pointing at it in December.

---

## 5. Build phases

**Phase 1 — Page + countdown (≈1 day)**
Section, template, CSS, snow, flip-style countdown, CTA, state machine skeleton with the
three states stubbed. Shippable on its own.

**Phase 2 — Tracker (≈2–3 days)**
Route generator + `santa-route.json`, Leaflet integration (vendored, lazy-loaded), sleigh
animation + trail, info cards (current/next stop, presents odometer), finished state +
replay button.

**Phase 3 — Polish (≈1–2 days)**
Mobile layout QA, reduced-motion support (`prefers-reduced-motion` disables snow/marker
easing), performance pass (Lighthouse), social share meta, optional music/video block,
copy review.

---

## 6. Decisions taken (overridable)

- **Leaflet + CARTO dark tiles** over Google Maps (needs billing/key) or SVG map.
- **Fixed UTC schedule** identical for all visitors (matches NORAD/Google) rather than
  per-timezone countdown targets.
- **Departure 24 Dec 10:00 UTC / finish 25 Dec ~11:00 UTC** — same window Google uses;
  configurable in the section settings.
- **No backend** — everything static in the theme; zero ongoing cost, survives traffic
  spikes trivially.
