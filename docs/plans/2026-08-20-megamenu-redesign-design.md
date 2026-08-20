# Mega menu redesign — design doc

**Date:** 2026-08-20
**Branch:** `feat/christmas-countdown` (wireframe stage)
**Status:** ✅ Design approved (floating header). Wireframe signed off. Ready for implementation planning — see `2026-08-20-megamenu-redesign-plan.md`.

---

## Problem

New content has been built (Christmas Countdown pages, team bios, photo wall, *Heart of Love to Sing* to come) but there is **nowhere in the current navigation to surface it**. Today's header supports two rich mega menus — a Songs finder and a Shop panel — plus flat links (About / Blog / Send it in) that can't expand.

The current menus are driven by a single `mega_menu_item` **metaobject** whose mechanics are fragile and confusing:
- numeric `button_2_menu` / `button_3_menu` **index routing** (breaks when collections are reordered),
- `color_scheme` **index lookups** into `settings.color_schemes`,
- collection **multi-references** queried indirectly,
- no error handling when a metaobject is missing.

Adding a new menu type means wrestling that schema. It must also be **beautiful on mobile and every device**.

## Decisions (agreed with Mark)

### Top-level navigation
**Songs · Shop · Discover · Countdown · About**

| Item | Menu type | Surfaces |
|------|-----------|----------|
| **Songs** | Music finder | Category rail (Christmas · Kids · Halloween · Celebration) with the active category's **logo above the list**; song cards with the **music icon left of the name** (matches live); search + "view all" |
| **Shop** | Ecommerce | Product/licence link columns + featured album |
| **Discover** | **Page listing** | Column of pages (Photo Wall, Blog, Send it in, Free Resources), an elaborated **"New this week"** column, and the ***Heart of Love to Sing* feature on the RIGHT**. No "meet the family" — team is a single **About** link. |
| **Countdown** | **Multiple live countdowns** | Grid of countdown cards (Christmas, Halloween, New Year, Easter) each with a live day-count widget + a **"New this week"** rail of widgets in build. *No advent calendar — we don't run one yet.* |
| **About** | Simple link | — |

### Header behaviour (added after wireframe review)
- **Transparent at the top** (over the hero), **fills with the header colour on scroll** (`.solid`). Also goes solid while a mega menu is open.
- **No divider line** under nav links or above the panel.
- **Click-to-open** as well as hover: on touch / `hover:none` devices hover-open is disabled and tap toggles the panel (click-away and Esc close).
- A **floating "pill" header variant** is the default (toggle to compare). Lower radius (`--radius-m`), and it **stays floating on mobile**. **Docks to a full-width square bar while a mega menu is open** (`.header--floating.menu-open`) so it merges flush with the panel — a rounded pill over a full-bleed panel otherwise reveals thin arcs of background at its corners.
- **Seasonal logo drives the header colour.** The logo swaps per season (Christmas/Halloween/…); the header's solid background comes from the theme colour scheme (`--color-header-background`), so changing the season's scheme recolours the floating header automatically. Logo has a subtle `drop-shadow` so it reads on any header colour.
- Colours use the theme **main-color schemes** (red/blue/green/yellow); Halloween uses a placeholder orange to be mapped to a real scheme.

### Search — full-screen overlay (reuses the existing engine)
The current site already uses Shopify **predictive search**: `routes.predictive_search_url?q=…&resources[type]=product,article,page&section_id=predictive-search`, rendered by `sections/predictive-search.liquid`; the `/search` results page (`sections/main-search.liquid`) has **all / song / shop / blog** chips; songs are `tag:song` products. **We keep that engine** and only replace the shell:

- Clicking the header **search icon** opens a **full-screen overlay** — Love to Sing logo top-left, a large single input with an animated red underline, the same **all / songs / shop / blog** chips, plus **popular searches** and **top songs** (song discs mirror the per-product main-color).
- **GSAP entrance**: backdrop fade + blur, logo/input rise, results **stagger** in (ui-polish motion). Graceful CSS fallback (`--i` staggered delays) if GSAP is unavailable. Esc / ✕ / backdrop close.
- Production: wrap the existing `predictive-search.liquid` markup in this overlay; `z-index` above the header; reuse the `PredictiveSearch` fetch/debounce/cache JS.

### Mobile — full-page overlay menu (replaces the side drawer)
- The **☰** opens a **full-page overlay** (brand deep-red gradient), big staggered nav items with inline accordions, a search trigger, and Cart/Account footer. GSAP stagger with CSS fallback; body scroll-locked.

### Architecture — **Option A: native menu + typed section blocks** ✅
Chosen over (B) redesigned metaobjects and (C) hardcoded snippets.

- **Structure** comes from Shopify's native navigation (Online Store → Navigation), drag-and-drop.
- The header section gets **one block per top-level item**, each with a **"Menu type" dropdown** — `Songs / Shop / Discover / Countdown / Simple` — that reveals only that type's fields.
- **No metaobjects, no numeric index routing, no colour-scheme index lookups.** Everything editable in the theme editor with live preview.
- The four wireframe panels map 1:1 to the four block types.

*Trade-off accepted:* a one-time rebuild of the header section, in exchange for removing the confusion and making new menus additive.

---

## How the menu is built TODAY (the clunky flow we're replacing)

The current header is `sections/header.liquid` → `snippets/navigation-desktop.liquid`, driven by a `mega_menu_item` **metaobject**. To configure **one** mega menu a merchant must:

1. **Navigation** → add the top-level link (e.g. "Songs") to `main-menu`.
2. **Content → Metaobjects → `mega_menu_item`** → create an entry, then fill a `menu_categories` list where **each** category needs: `title`, `url`, `collection` (multi-ref), `color_scheme` (**a number** that indexes `settings.color_schemes`), `logo_image`, `add_search` (bool), and `button_1/2/3_label` + `_link` + **`button_2_menu`/`button_3_menu` (a number** that says which submenu tab the button appears on).
3. **Header section** → add a **"Mega menu" block**, type the **"Main menu name"** so it **exactly matches** the nav link text, and point its metaobject picker at the entry from step 2.

**Why it's terrible** (all confirmed in code):
- **Two numbers with no labels** — `color_scheme` and `button_x_menu` are integer indices. Reorder or delete a colour scheme / collection and every menu silently points at the wrong thing (`navigation-desktop.liquid` loops `settings.color_schemes` matching `forloop.index`; `megamenu-products.liquid` shows a button only when `forloop.index == button_2_menu`).
- **String-match wiring** — the header block `title` must equal the nav link `title` character-for-character or the menu just doesn't appear, with no error.
- **No live preview** — it's all in the metaobject editor, blind; you only see breakage on the storefront.
- **Layout is inferred from product tags** — `megamenu-products.liquid` hard-codes "if first product tag is `song` → 18 items/3 cols, `ebook` → 4/4, else 6/6." You can't choose a layout.
- **Rigid vw columns** — `megamenu.css` fixes `--main-menu-width:22vw`, `--submenu-width:19.2vw`.
- **Desktop and mobile diverge** — mobile ignores the metaobject entirely and just walks the native linklist.

## How you'll build menus GOING FORWARD (Architecture A)

Everything moves into the **Header section** in the theme editor. Native Navigation still owns the link list; each top-level item gets a matching **header block** whose first setting is a **Menu type** dropdown. Selecting a type reveals only that type's fields (Shopify `visible_if`), so there are no orphan/irrelevant settings:

| Menu type | What you fill in (theme editor, live preview) |
|-----------|-----------------------------------------------|
| **Songs** | Pick category collections; per category: a colour scheme **by name** (not index) and a logo image. Song cards auto-pull from the collection. |
| **Shop** | Up to N link columns (heading + links via native menu or manual) + an optional featured product/album. |
| **Discover** | Left link columns (pick pages), a **New this week** blog/source, and the **Heart** feature (page + image). |
| **Countdown** | Repeatable countdown entries (title, target date, colour, link) + a New-this-week list. Day-counts computed in Liquid. |
| **Simple** | Just uses the native menu's child links (a plain dropdown). |

No metaobjects, no index maths, no exact-string wiring — the block *is* the menu, edited where you can see it.

*(Full current-state code map lives in the plan doc; file inventory below.)*

### Files the rebuild touches
`sections/header.liquid` (schema + typed blocks), `snippets/navigation-desktop.liquid` (rewrite to read block settings), new per-type snippets (`menu-type-songs/shop/discover/countdown.liquid`), `assets/header-megamenu.js` (simplify — hover/click/height), `assets/megamenu.css` + `section-header.css` (floating header, transparent-on-scroll, overlays), new `snippets/search-overlay.liquid` + `menu-overlay.liquid` wrapping the existing `predictive-search` engine, `config/settings_schema.json` (Halloween colour scheme). Retire the `mega_menu_item` metaobject once migrated.

## The 5 wireframes

Single interactive file: `docs/plans/megamenu-wireframes/index.html`, built on **the live theme's design tokens** (`assets/base.css` — colours, spacing, radius, 62.5% root, Nunito, ui-polish easing/shadows).

1. **Songs** — music finder: tinted left category rail with the **active category logo above "Categories"** + song cards (**music icon left of the name**, per-product `main-color` tint); equal-height "View all" + search at the base.
2. **Shop** — ecommerce: three link columns (products / licences / bundles) + a featured-album card with price and CTA.
3. **Discover** — page listing: link column (Photo Wall / Blog / Send it in / Free Resources), an elaborated **New this week** column, and the ***Heart of Love to Sing* feature on the right**. (No team list — team is the About link.)
4. **Countdown** — **multiple live countdown cards** (Christmas / Halloween / New Year / Easter) + a **New this week** widgets rail. (No advent.)
5. **Overlays** — full-page **menu overlay** (replaces the side drawer) + full-screen **search overlay**, both GSAP-staggered; scroll-lock uses `scrollbar-gutter:stable` so opening never shifts the page.

Header: floating pill (approved), transparent at top → solid on scroll, stays transparent while a menu opens; hover on hover-capable devices, click/tap everywhere.

## Resolved / to confirm during build

- **Header:** floating variant — ✅ approved.
- Countdown day-counts: computed in Liquid per countdown; widgets built separately.
- Halloween: add a **real theme colour scheme** (placeholder orange today).
- Confirm the exact **Discover page list** and real **category logo assets** (Christmas / Kids / Halloween / Celebration) during build.

## Next step

Implementation plan in `docs/plans/2026-08-20-megamenu-redesign-plan.md`. Build against the **unpublished dev theme** with `shopify theme push --only <file>`, matching `git push`, PR into `main` — per the safe-deploy workflow in CLAUDE.md.
