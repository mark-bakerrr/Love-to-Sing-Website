# Mega menu redesign — design doc

**Date:** 2026-08-20
**Branch:** `feat/christmas-countdown` (wireframe stage)
**Status:** Wireframes built — awaiting Mark's review/adjustments before implementation planning.

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
- A **floating "pill" header variant** is included behind a toggle (detached, rounded, always-solid; mega drops as a rounded card).
- Colours use the theme **main-color schemes** (red/blue/green/yellow); Halloween uses a placeholder orange to be mapped to a real scheme.

### Architecture — **Option A: native menu + typed section blocks**
Chosen over (B) redesigned metaobjects and (C) hardcoded snippets.

- **Structure** comes from Shopify's native navigation (Online Store → Navigation), drag-and-drop.
- The header section gets **one block per top-level item**, each with a **"Menu type" dropdown** — `Songs / Shop / Discover / Countdown / Simple` — that reveals only that type's fields.
- **No metaobjects, no numeric index routing, no colour-scheme index lookups.** Everything editable in the theme editor with live preview.
- The four wireframe panels map 1:1 to the four block types.

*Trade-off accepted:* a one-time rebuild of the header section, in exchange for removing the confusion and making new menus additive.

## The 5 wireframes

Single interactive file: `docs/plans/megamenu-wireframes/index.html`, built on **the live theme's design tokens** (`assets/base.css` — colours, spacing, radius, 62.5% root, Nunito, ui-polish easing/shadows).

1. **Songs** — music finder: tinted left category rail + 6-col song-card grid (colour tints mirror the per-product `main-color` metafield); search + "View all" pinned at the base.
2. **Shop** — ecommerce: three link columns (products / licences / bundles) + a featured-album card with price and CTA.
3. **Discover** — editorial hub: a large gradient **feature card for *Heart of Love to Sing***, a **team-bios** people list with avatars, and image **tiles** (Photo Wall / Blog / Send it in).
4. **Countdown** — seasonal: **"127 sleeps to Christmas"** hero + a **24-door advent calendar** (opened / today / locked states) + a **This week** highlights list.
5. **Mobile drawer** — full-screen slide-in accordion covering all four (mirrors `navigation-mobile.liquid`, switches at 990px); includes a countdown bar and avatar sublinks.

Desktop: single-open hover controller (Esc closes, keyboard focus opens). Mobile: `<details>` drill-down, overlay, body-scroll lock.

## Open questions for Mark (post-wireframe, round 2)

- Countdown day-counts should be **dynamically computed** in Liquid per countdown; the widgets are being built separately.
- Halloween needs a **real theme colour scheme** (placeholder orange for now).
- Confirm the exact **Discover page list** (Photo Wall, Blog, Send it in, Free Resources… anything else?).
- Standard header vs **floating** variant — which direction do we productionise?
- Real **logo assets** per song category (Christmas / Kids / Halloween / Celebration).

## Next step

After Mark reviews and adjusts the wireframes, proceed to **writing-plans** for the Liquid implementation of Architecture A (header section rebuild + four typed blocks + mobile drawer), following the theme's safe-deploy workflow (push `--only` to the unpublished dev theme, matching `git push`, PR into `main`).
