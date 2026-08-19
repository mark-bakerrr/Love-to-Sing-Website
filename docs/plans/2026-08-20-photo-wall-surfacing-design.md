# Photo Wall — surfacing it across the site

**Date:** 2026-08-20
**Status:** Exploration + interactive wireframes, for team review (not yet built)
**Wireframe (open in a browser):** `tmp/photo-wall/surface/options.html` — one file, all ideas, real photos, live GSAP interactions.

---

## Why

The Photo Wall (`/pages/photo-wall`) is a huge part of the *Heart of Love to Sing* — the family story in pictures. Today it lives on one page most visitors never reach. We want the wall (and the feeling behind it) to show up **across the site** so people actually see it.

**Chosen direction:** **interactive delight** — playful, memorable moments (drifting pinned polaroids, hover reveals, click-to-open story, a peeking corner widget), not just static galleries or hard CTAs.

**Chosen build shape:** a **reusable kit** — a small set of theme **sections + blocks** we can drop onto the homepage, About, song/product pages, bios, plus a global entry point. Author once, place anywhere.

---

## How photos get chosen (default: smart / contextual)

Each placement auto-pulls the right photos from the `photo_wall` metaobject tags, so there's minimal manual upkeep:

- **Bio page** → that person's photos (via the `people` tag)
- **Song / product page** → photos tagged to that product (`product` tag)
- **Category page** → that category (`category` tag)
- **Homepage / About** → a featured / mixed set

Curated-by-hand and random/rotating are also possible per placement. **To confirm with the team.**

---

## The reusable kit

### ★ Centrepiece — "Heart of Love to Sing" showcase (home / About)
Scattered pinned **polaroids** at playful angles that gently **drift**; **hover** lifts one to the front and shows its caption; **click** opens a **story popup**; heading (*"The **heart** of Love to Sing"*) + "Wander the whole wall" CTA. This is the hero moment and the piece Mark most wants to keep. Built as a **section**.

### The magical heart-burst (signature moment)
The most on-brand delight — perfect for *Heart* of Love to Sing:
- A **3D heart** (currently a Higgsfield render, `heart.png` — *Mark isn't sold on it; placeholder for now, easy to swap*) that **tilts toward the cursor** in 3D.
- **Hover** = a steady **shower of sparkles** (✦ ✧ ♥ ⋆). No heartbeat/pulse (removed — was too much).
- **Click** = the heart pops, photos **bloom into a heart shape**, and **hearts ♥ + music notes ♪♫ float up**. A **magical CTA button** ("Step into the memories") appears with the photos and vanishes when they collapse.

### Contextual mini-cluster (reusable **block** — song / product / bio pages)
2–3 overlapping polaroids tied to the page's content; click → story popup. Drops inside other sections.

### Global entry points
- **Corner-peek widget** (site-wide, optional): a pinned polaroid peeks in bottom-right, rotates through memories every few seconds, **links straight to the wall** (not a popup), ✕ to dismiss.
- **Footer marquee**: dual rows of thumbnails gliding opposite directions, hover to pause, click → wall.

### Shared story popup
One reusable card (image, year, title; "See it on the Photo Wall") used by the showcase, cluster, etc. Corner-peek is the exception — it links straight to the wall.

---

## The 11 interactive options explored (in the wireframe)

Signature GSAP interactions to choose from:

| # | Interaction | Best used as |
|---|---|---|
| 1 | Draggable corkboard (fling pins) | interactive wall teaser / the wall page itself |
| 2 | Scroll-driven parallax band | ambient in-page moment |
| 3 | **Heart-burst** (magical) | homepage signature moment |
| 4 | Draggable timeline scrubber | 30-year story |
| 5 | Magnetic 3D tilt | refined hover for clusters |
| 6 | Grid ⇄ scatter (GSAP Flip) | best-of-both section |
| 7 | Confetti drop on reveal | joyful entrance |
| 8 | Peel-away deck | compact, mobile-friendly |
| 9 | Floating balloon memories | dreamy ambient |
| 10 | Dual-row marquee | global footer strip |
| 11 | Flip-through photo book | nostalgic, tactile (bonus) |

**Recommended kit (for discussion):** Centrepiece showcase + **Heart-burst (#3)** + contextual cluster + footer marquee (#10) + corner-peek, with the **flip-book (#11)** as a lovely bonus on the wall page, and the **draggable corkboard (#1)** as an upgrade to the wall page itself.

---

## Data & technical notes

- **Source of truth:** the `photo_wall` metaobject — fields: `photo`, `year`, `title`, `description`, `location`, `people` (→ team refs), `category`, `product`, `link`. ~18 entries.
- **Referencing photos in theme code:** `image_picker` values and metaobject-reference GIDs **can't be set via the Asset API** on this theme, and dynamic key access (`metaobjects.type[handle]`) doesn't resolve. The working pattern (already used by the bios): store a **handle** in a text setting and **loop-match** `metaobjects.photo_wall.values` on `e.system.handle`. Contextual placements loop-and-filter by `people`/`product`/`category`.
- **Motion:** GSAP 3.12 (core + ScrollTrigger + Draggable + Flip, all free) via CDN. Everything must honour `prefers-reduced-motion` and never gate content visibility on scroll (SEO/crawler safe — see the bio reveal failsafe).
- **Theme quirks to respect:** root font-size is 62.5% (rem ×1.6 vs a 16px design); named colour schemes `main-color-{red|blue|green|black|yellow}`. See `memory/lts-theme-gotchas`.

---

## Content correction (done, live)

"The founding trio" was **factually wrong — Linda is the sole founder.** Corrected everywhere: the live `photo_wall` entry is now **"The family team"** (handle `the-family-team`, description fixed), Linda's bio reference updated, and the wireframe/scratch files cleaned.

---

## Assets

- `tmp/photo-wall/surface/heart.png` — Higgsfield 3D heart (transparent). Placeholder; Mark undecided. If kept, upload to Shopify **Files** before build. Easy to swap for a different heart treatment (illustrated, brand-styled, etc.).

---

## Open questions for the team

1. Which options to **lock in** as the final kit? (recommendation above)
2. Photo selection: confirm **smart/contextual** default vs curated/random per placement.
3. The **corner-peek widget** — yes site-wide, or too much?
4. The **3D heart** treatment — keep, restyle, or a different heart entirely?
5. Which **surfaces first** (home, About, bios, song pages, footer)?

---

## Next steps

1. **Team review** of `options.html` (this session's output).
2. Lock the final kit + selection rules.
3. Then: writing-plans → build the sections/blocks, wire to the `photo_wall` metaobject, upload assets, place on chosen pages, and QA (responsive + reduced-motion).
