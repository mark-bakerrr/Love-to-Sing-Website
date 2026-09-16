# Photo Wall — design (2026-08-19)

An interactive "photo wall" at `/pages/photo-wall` for lovetosing.com, in the
style of gamers.town: photos as white "polaroid" cards scattered across a dark,
pannable/zoomable canvas. Clicking a card opens a popup with that photo's data.
Wireframe-first: nail the feel in a standalone HTML file before theme code.

## Reference
gamers.town — product cards on white rounded frames, scattered with slight
rotations on a dark textured background (faint grid + ghost watermark); drag to
pan the oversized canvas; small pill label per card (price → we use **year**);
floating control bar; click → detail.

## Data — "Photo wall" metaobject
Only `photo` + `year` required; the popup renders only the fields that are set.

| Field | Type | Use |
|---|---|---|
| `photo` | image | card image (required) |
| `year` | integer | the card pill (required) |
| `title` | single line | popup headline |
| `description` | multi-line | popup story |
| `people_location` | single line | who / where |
| `category` | single line | grouping (future filtering) |
| `product` | product reference | if set → popup shows a mini product card (image, title, price, buy link) |
| `link` | url | optional popup button |

Loop pattern follows the existing theme convention:
`metaobjects.photo_wall.values` (cf. `sections/product-timeline.liquid`).

## Canvas
- Dark textured background (grid + faint watermark); a "world" larger than the
  viewport.
- Cards: white rounded frame, photo, **year pill** top-left, slight rotation,
  soft shadow; hover lifts + raises z-index.
- Auto-scatter: positions/rotations derived deterministically from each entry's
  index (stable across reloads; re-seed = shuffle). Loose jittered grid so cards
  don't heavily overlap. Optional per-entry x/y/rotation override fields later.
- Interactions: drag-to-pan (mouse + touch, with momentum), scroll/pinch
  **zoom** (clamped), **recentre** button.
- Performance: lazy-load images; card thumbnails via Shopify `image_url`
  (~500px), full-res only in the popup.

## Popup (click a card)
Modal: large photo + conditional fields (year, title, description, people &
location, category chip). If a product is tagged → mini product card with "View
product". Optional link button. Close on ✕ / Esc / backdrop.

## Music player
Reuse the countdown now-playing widget (artwork + title + play/pause/prev-next),
bottom-left, same component pattern.

## Wireframe scope
`photo-wall.html` + ~18 real resized photos from the Heart of Love to Sing
folder, placeholder metadata (varied years/categories, a couple with a tagged
product + link, one minimal to prove conditional rendering). All interactions
working (pan, zoom, recentre, click-popup, music) before any theme code.

## Theme port (after wireframe sign-off)
- Create the `photo_wall` metaobject definition + entries.
- `sections/photo-wall.liquid` (+ `assets/photo-wall.css`, `photo-wall.js`)
  looping `metaobjects.photo_wall.values`; scatter computed in JS from index.
- `templates/page.photo-wall.liquid` (JSON or Liquid template). Chrome: TBD —
  likely a normal page (header/footer) unless we want full-bleed like the
  countdowns.
