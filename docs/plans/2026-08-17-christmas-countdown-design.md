# Christmas Countdown overlay — design (2026-08-17)

A full-viewport 16:9 Christmas countdown page for livestreaming (webpage-embed
overlay on upstream.so) and for lovetosing.com. Prototype-first: nail look and
behaviour in a standalone HTML file before porting to a Shopify section.

## Contexts (one page, two modes)

- `?overlay=1` — clean broadcast mode: countdown + Christmas message only, music
  widget hidden, no scrollbars/chrome. This is what upstream.so embeds.
- Normal load (lovetosing.com) — same countdown **plus** the bottom-left music
  widget for visitors.

## Layout & scaling

- A fixed **16:9 stage** sized to fit the viewport and centred; the dark-red
  background bleeds into any letterbox gap so it always looks intentional.
  Guarantees a pixel-perfect overlay at 16:9 and a clean centred band on
  portrait mobile.
- Stage uses `container-type: size`; all overlay typography is sized in
  container-query units (`cqh`/`cqw`) so it scales *with the frame*, not the
  raw viewport ("variable font size").
- Background: `assets/Red Countdown Background.jpg` (Merry Christmas banner top,
  open red space below). Digits sit in the lower-centre open area.

## Countdown

- Row: **DAYS · HOURS · MINUTES · SECONDS**. Numbers in **Nunito 800**, fluid
  size, uppercase label under each. `padStart(2,'0')` on H/M/S, days un-padded.
- Target: **Dec 25 00:00 in a fixed reference timezone**, default
  **America/New_York** (a theme-editor setting in the real build). Because the
  overlay is rendered on the broadcaster's machine and burned into the video, a
  fixed reference TZ (not machine-local) is what keeps every viewer's numbers
  consistent.
- Auto-roll: target = Christmas of the *current NY year*. Jan 1 → Dec 24 counts
  down to this year's Christmas; Dec 25 → 31 shows the Christmas message; Jan 1
  rolls the target to next Christmas automatically. No yearly edit. (Mirrors the
  `computeDeparture` roll-forward in `santa-tracker.js`.)

## Christmas message state (Dec 25 → Dec 31)

When the target passes, the digits swap for a **customisable message** (default
"It's Christmas! 🎄"). Prototype: an editable JS variable. Real build: a
theme-editor text/richtext setting.

## Music widget (website only)

- Bottom-left "now playing" card: **artwork + title + artist + play/pause +
  prev/next**. Hidden in `?overlay=1`.
- Source: **full-length** Love to Sing audio. NOT the Single app, NOT 30s
  previews, NOT public Shopify file URLs (rights). Production must serve full
  audio from gated/authenticated hosting — deferred to the theme build.
- Prototype: playlist is a `{title, artist, art, src}[]` array wired to
  full-length placeholder tracks + placeholder art, so play/stop/next is fully
  functional and real assets swap in later.

## QA params

- `?overlay=1` — broadcast mode.
- `?now=2026-12-25T00:00` — fake "now" to test the Christmas + reset states.

## Deliverable

`christmas-countdown.html` at repo root, referencing the background asset by
relative path. Theme section port happens after sign-off on the prototype.
