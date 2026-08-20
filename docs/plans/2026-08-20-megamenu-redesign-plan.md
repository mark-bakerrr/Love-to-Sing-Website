# Mega Menu Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the metaobject-driven header with a native-menu + typed-section-block header (Architecture A) that renders four menu types (Songs, Shop, Discover, Countdown) plus Simple, a floating transparent-on-scroll header, a full-screen search overlay, and a full-page mobile menu overlay — all editable in the theme editor with no metaobjects.

**Architecture:** Native Shopify Navigation owns the link list. `sections/header.liquid` gains one **block per top-level item** whose first setting is a **Menu type** dropdown (`songs / shop / discover / countdown / simple`); `visible_if` reveals only that type's fields. `navigation-desktop.liquid` is rewritten to read block settings (no `metaobjects.mega_menu_item`, no index maths, no string-match wiring) and delegates to one snippet per type. Search reuses the existing Shopify **predictive-search** engine inside a new overlay shell. The `mega_menu_item` metaobject is retired at the end.

**Tech Stack:** Shopify Online Store 2.0 theme (Liquid, section schema `visible_if`), vanilla-JS custom elements, CSS custom properties from `assets/base.css`, GSAP (already used elsewhere / CDN acceptable), Shopify CLI (`shopify theme`), theme-check.

**Source of truth for markup/CSS/motion:** the approved wireframe `docs/plans/megamenu-wireframes/index.html`. Port its markup, tokens, and JS behaviour — do not reinvent. Design rationale: `docs/plans/2026-08-20-megamenu-redesign-design.md`.

---

## ⚠️ Safe-deploy workflow — applies to EVERY task (from CLAUDE.md)

The git `shopify-theme/` tree can drift from the live/dev theme, and a bare `shopify theme push` DELETES remote-only files. So, every task:

1. **Confirm theme roles first, every session:** `shopify theme list` → note the **`[unpublished]`** dev theme id (currently *Love to Sing Website v3.1.3* `185049940241`, but **never assume** — roles change). **Never push to `[live]`.**
2. **Pull fresh before editing** a file you haven't already pulled this session (avoid overwriting remote-only work).
3. Edit locally.
4. Lint: `shopify theme check` (or MCP `validate_theme`).
5. Push **only** the touched files: `shopify theme push --only <path> --theme <DEV_ID> --path shopify-theme`.
6. Verify on the dev theme preview URL.
7. `git add` + `git commit` + **`git push`** in the SAME session (remote must match what's deployed). Never `theme push` without a matching `git push`.
8. **Never** run a bare / full-directory `shopify theme push`. Treat every push as potentially destructive; verify local ≈ remote first.

All work happens on a feature branch → PR into `main`. Never commit to `main`.

**Set once at the top of the session:**
```bash
export DEV_ID=<the unpublished theme id from `shopify theme list`>   # PowerShell: $env:DEV_ID="..."
```

---

## Task 0: Branch, confirm theme, snapshot current header

**Files:** none (setup)

**Step 1** — Create the working branch off `main` (do not build on `feat/christmas-countdown`):
```bash
git checkout main && git pull
git checkout -b feat/mega-menu-rebuild
```

**Step 2** — Confirm roles and capture the dev id:
```bash
shopify theme list
```
Expected: exactly one `[live]` and one `[unpublished]`. Record the **unpublished** id as `DEV_ID`. If unsure which is which, STOP and ask.

**Step 3** — Pull a fresh copy of the current header/menu/search files so local matches remote before we change anything:
```bash
shopify theme pull --theme $DEV_ID --path shopify-theme --only \
  sections/header.liquid \
  snippets/navigation-desktop.liquid \
  snippets/navigation-mobile.liquid \
  snippets/megamenu-products.liquid \
  assets/header-megamenu.js \
  assets/megamenu.css \
  assets/section-header.css
```

**Step 4** — Confirm clean baseline lint:
```bash
shopify theme check
```
Expected: no NEW errors we introduce later. Note any pre-existing warnings.

**Step 5 — Commit the snapshot** (so we can diff/rollback):
```bash
git add shopify-theme
git commit -m "chore(header): snapshot dev-theme header/menu/search before rebuild"
git push -u origin feat/mega-menu-rebuild
```

---

## Phase 1 — Header shell (floating, transparent-on-scroll)

Do the chrome BEFORE the menu content so we can verify the header independently of menu wiring.

### Task 1: Floating transparent-on-scroll header CSS

**Files:**
- Modify: `shopify-theme/assets/section-header.css`
- Reference: `docs/plans/megamenu-wireframes/index.html` (`.site-header`, `.site-header.solid`, `body.floating .site-header`, `body.floating .site-header.solid`, mobile floating overrides)

**Step 1** — Port the wireframe header rules into `section-header.css`, mapping wireframe tokens to the theme's real ones (`--header-bg` → the theme's `--color-header-background` / scheme var; `--radius-m`, easing/durations already exist in `base.css`). Add:
- `.header-wrapper` (or existing header root): `position: fixed; background: transparent` base + top scrim gradient.
- `.header-wrapper.is-solid`: scheme background + shadow.
- Floating modifier class on `<body>`: lowered radius, centred pill, `calc(100% - 2.4rem)`, and **transparent at top, coloured only via `.is-solid`**.
- Mobile floating override (`max-width:990px`).

**Step 2** — Lint: `shopify theme check` → expect no new errors.

**Step 3** — Push only this file:
```bash
shopify theme push --only assets/section-header.css --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify on preview: header floats, transparent over a hero at scrollY 0, fills on scroll. (Behaviour toggle wired in Task 2.)

**Step 5 — Commit + push:**
```bash
git add shopify-theme/assets/section-header.css
git commit -m "feat(header): floating pill, transparent at top -> solid on scroll (CSS)"
git push
```

### Task 2: Header scroll/solid controller + floating setting

**Files:**
- Modify: `shopify-theme/assets/header-megamenu.js` (or a small new `assets/header-chrome.js` loaded by the section)
- Modify: `shopify-theme/sections/header.liquid` (add a `floating_header` checkbox setting + body/header class hook + include the script)

**Step 1** — Add a section setting:
```json
{ "type": "checkbox", "id": "floating_header", "label": "Floating header", "default": true }
```
Render a class hook, e.g. on `<body>` via `{% if section.settings.floating_header %}` add a `header--floating` class (or set a `data-floating` attr the script reads).

**Step 2** — Add the scroll controller (port from wireframe `syncHeader`): toggle `.is-solid` when `window.scrollY > 10`; **stay transparent when a menu opens at the top** (do NOT force solid on menu open). Respect `prefers-reduced-motion`.

**Step 3** — Lint, then push both files:
```bash
shopify theme check
shopify theme push --only sections/header.liquid,assets/header-megamenu.js --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify: toggling **Floating header** in the theme editor switches docked/floating; scrolling toggles colour; opening a (still-old) menu at top keeps header transparent.

**Step 5 — Commit + push:**
```bash
git add shopify-theme/sections/header.liquid shopify-theme/assets/header-megamenu.js
git commit -m "feat(header): floating toggle + transparent-on-scroll controller"
git push
```

---

## Phase 2 — Typed block schema (the new editing model)

### Task 3: Add the "Menu type" block schema to header.liquid

**Files:**
- Modify: `shopify-theme/sections/header.liquid` (`{% schema %}` blocks)

**Step 1** — Replace the `mega_menu` block with a single **`menu_item`** block whose first setting is a type dropdown, using `visible_if` so only the relevant fields show. Concrete schema:

```json
{
  "type": "menu_item",
  "name": "Menu item",
  "settings": [
    { "type": "text", "id": "title", "label": "Menu link text (must match a Navigation item)" },
    { "type": "select", "id": "menu_type", "label": "Menu type", "default": "simple",
      "options": [
        { "value": "simple",    "label": "Simple dropdown" },
        { "value": "songs",     "label": "Songs (music finder)" },
        { "value": "shop",      "label": "Shop (ecommerce)" },
        { "value": "discover",  "label": "Discover (page listing)" },
        { "value": "countdown", "label": "Countdown (multiple countdowns)" }
      ]
    },

    { "type": "header", "content": "Songs", "visible_if": "{{ block.settings.menu_type == 'songs' }}" },
    { "type": "collection_list", "id": "songs_categories", "label": "Category collections",
      "visible_if": "{{ block.settings.menu_type == 'songs' }}" },
    { "type": "color_scheme", "id": "songs_scheme", "label": "Accent scheme",
      "visible_if": "{{ block.settings.menu_type == 'songs' }}" },

    { "type": "header", "content": "Shop", "visible_if": "{{ block.settings.menu_type == 'shop' }}" },
    { "type": "link_list", "id": "shop_menu", "label": "Shop menu (columns from nested links)",
      "visible_if": "{{ block.settings.menu_type == 'shop' }}" },
    { "type": "product", "id": "shop_feature_product", "label": "Featured album/product",
      "visible_if": "{{ block.settings.menu_type == 'shop' }}" },

    { "type": "header", "content": "Discover", "visible_if": "{{ block.settings.menu_type == 'discover' }}" },
    { "type": "link_list", "id": "discover_links", "label": "Explore links",
      "visible_if": "{{ block.settings.menu_type == 'discover' }}" },
    { "type": "blog", "id": "discover_blog", "label": "New this week (blog)",
      "visible_if": "{{ block.settings.menu_type == 'discover' }}" },
    { "type": "page", "id": "discover_feature_page", "label": "Feature page (Heart of LTS)",
      "visible_if": "{{ block.settings.menu_type == 'discover' }}" },
    { "type": "image_picker", "id": "discover_feature_image", "label": "Feature image",
      "visible_if": "{{ block.settings.menu_type == 'discover' }}" }
  ]
}
```

Countdown needs a repeatable set of countdowns. Section blocks can't nest, so use a small **`countdown_item`** metaobject **or** (simpler, no metaobjects) up to 4 flat field-sets on the block:
```json
    { "type": "header", "content": "Countdown", "visible_if": "{{ block.settings.menu_type == 'countdown' }}" },
    { "type": "text", "id": "cd1_title", "label": "Countdown 1 title", "visible_if": "{{ block.settings.menu_type == 'countdown' }}" },
    { "type": "text", "id": "cd1_date",  "label": "Countdown 1 date (YYYY-MM-DD)", "visible_if": "{{ block.settings.menu_type == 'countdown' }}" },
    { "type": "url",  "id": "cd1_link",  "label": "Countdown 1 link", "visible_if": "{{ block.settings.menu_type == 'countdown' }}" },
    { "type": "color_scheme", "id": "cd1_scheme", "label": "Countdown 1 accent", "visible_if": "{{ block.settings.menu_type == 'countdown' }}" }
    /* repeat cd2_*, cd3_*, cd4_* */
```
> Decision to confirm at build: flat cd1–cd4 fields (no metaobjects, matches Architecture A) vs a `countdown_item` metaobject list (unbounded but reintroduces a metaobject). **Default: flat fields.**

**Step 2** — Keep the old `mega_menu` block type in the schema **for now** (don't delete yet) so the live config still validates while we build. Lint:
```bash
shopify theme check
```

**Step 3** — Push:
```bash
shopify theme push --only sections/header.liquid --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify in theme editor: add a **Menu item** block; changing **Menu type** shows/hides the right field groups (no orphan settings).

**Step 5 — Commit + push:**
```bash
git add shopify-theme/sections/header.liquid
git commit -m "feat(header): typed 'Menu item' block schema with visible_if per menu type"
git push
```

---

## Phase 3 — Render the menus from block settings

### Task 4: Rewrite navigation-desktop.liquid to read blocks (Simple type first)

**Files:**
- Modify: `shopify-theme/snippets/navigation-desktop.liquid`
- Reference: wireframe nav markup + single-open controller

**Step 1** — New resolution: loop `linklists[section.settings.menu].links`; for each link, find the block whose `settings.title == link.title` (helper: downcase/strip both). Render the trigger; then `case block.settings.menu_type` → `render 'menu-type-<type>'`. Implement **`simple`** first: a plain dropdown from `link.links` (native children). No metaobject reads anywhere.

**Step 2** — Lint + push:
```bash
shopify theme check
shopify theme push --only snippets/navigation-desktop.liquid --theme $DEV_ID --path shopify-theme
```

**Step 3** — Verify: a nav item set to **Simple** shows its native child links on hover/click; items with no block fall back to a plain link.

**Step 4 — Commit + push:**
```bash
git add shopify-theme/snippets/navigation-desktop.liquid
git commit -m "feat(nav): render header from typed blocks; Simple dropdown type"
git push
```

### Task 5: `menu-type-songs` snippet

**Files:**
- Create: `shopify-theme/snippets/menu-type-songs.liquid`
- Reference: wireframe `.songs`, `.song-rail`, `.song-logo`, `.song-cat`, `.song` (icon-left rows), category-logo swap JS

**Step 1** — Build the panel: left rail lists `block.settings.songs_categories` (each collection = a category); show the active category's **logo above "Categories"**; right side renders that collection's products as **icon-left** song cards; equal-height "View all" + search at the base. Tint each card from the product's `main-color` metafield (reuse existing `card-product-song` logic/classes). Colour scheme by **name** from `block.settings.songs_scheme` (no index maths).

**Step 2** — Port the category-logo-swap interaction into `header-megamenu.js` (hover/click a category updates the logo + active state).

**Step 3** — Lint + push:
```bash
shopify theme check
shopify theme push --only snippets/menu-type-songs.liquid,snippets/navigation-desktop.liquid,assets/header-megamenu.js,assets/megamenu.css --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify: Songs menu shows categories, swapping logo, real products, working search + view-all.

**Step 5 — Commit + push:**
```bash
git add shopify-theme/snippets/menu-type-songs.liquid shopify-theme/assets/header-megamenu.js shopify-theme/assets/megamenu.css shopify-theme/snippets/navigation-desktop.liquid
git commit -m "feat(nav): Songs menu type (category rail + logo swap + icon-left cards)"
git push
```

### Task 6: `menu-type-shop` snippet

**Files:**
- Create: `shopify-theme/snippets/menu-type-shop.liquid`
- Reference: wireframe `.shop-grid`, `.shop-col`, `.album`

**Step 1** — Render columns from `block.settings.shop_menu` (each top-level child link = a column heading; its nested links = the column items) + a featured `block.settings.shop_feature_product` card (image, price via `product.price | money`, CTA).

**Step 2** — Lint + push (`--only snippets/menu-type-shop.liquid,assets/megamenu.css`), verify, then:

**Step 3 — Commit + push:**
```bash
git commit -m "feat(nav): Shop menu type (link columns + featured product)"
git push
```

### Task 7: `menu-type-discover` snippet

**Files:**
- Create: `shopify-theme/snippets/menu-type-discover.liquid`
- Reference: wireframe `.discover-grid` (feature on the RIGHT), `.list-link`, `.news`, `.feature`

**Step 1** — Left column: `block.settings.discover_links` (icon + page). Middle: **New this week** from `block.settings.discover_blog.articles limit: 3` (thumb, tag, `article.published_at | date`). Right: **Heart** feature card from `discover_feature_page` + `discover_feature_image`.

**Step 2** — Lint + push, verify, commit + push:
```bash
git commit -m "feat(nav): Discover menu type (page listing + New this week + Heart feature right)"
git push
```

### Task 8: `menu-type-countdown` snippet

**Files:**
- Create: `shopify-theme/snippets/menu-type-countdown.liquid`
- Reference: wireframe `.cd-cards`, `.cd-card`, `.week`

**Step 1** — For each `cdN_*` set, compute days remaining in Liquid:
```liquid
{%- assign target = block.settings.cd1_date | date: '%s' | plus: 0 -%}
{%- assign now = 'now' | date: '%s' | plus: 0 -%}
{%- assign days = target | minus: now | divided_by: 86400 -%}
```
Render each as a coloured card (`cdN_scheme`) with the day number + link. Add the **New this week** rail (from the blog or the discover source — confirm at build).

**Step 2** — Lint + push, verify (day-counts correct), commit + push:
```bash
git commit -m "feat(nav): Countdown menu type (multiple live countdowns + New this week)"
git push
```

---

## Phase 4 — Search overlay (reuse predictive-search engine)

### Task 9: Full-screen search overlay shell

**Files:**
- Create: `shopify-theme/snippets/search-overlay.liquid`
- Modify: `shopify-theme/sections/header.liquid` (render the overlay; make the search icon open it)
- Modify: `shopify-theme/assets/header-megamenu.js` (or a small `assets/overlays.js`)
- Reference: wireframe `.search-overlay`, `.so-*`, GSAP open/close, scroll-lock via `scrollbar-gutter:stable`

**Step 1** — Build the overlay shell (logo top-left, big input, chips **All/Songs/Shop/Blog & pages**, popular searches, top-songs grid). Inside it, keep the existing `<predictive-search>` element + `form-search` + `<predictive-search-results>` so the live predictive engine (`routes.predictive_search_url`, `sections/predictive-search.liquid`, `assets/predictive-search.js`) drives real results — we only change the shell. Chips map to the existing `type` / `filter.p.tag` params.

**Step 2** — Add `html { scrollbar-gutter: stable; }` (base.css) and the open/close (lock `html`+`body`, GSAP entrance + stagger, CSS fallback, Esc/✕/backdrop close). Search icon opens it on ALL breakpoints.

**Step 3** — Lint + push:
```bash
shopify theme push --only snippets/search-overlay.liquid,sections/header.liquid,assets/header-megamenu.js,assets/base.css,assets/section-header.css --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify: icon opens overlay with NO page shift; typing returns live predictive results; chips filter; Esc closes; submit → `/search`.

**Step 5 — Commit + push:**
```bash
git commit -m "feat(search): full-screen overlay wrapping predictive-search; no scroll shift"
git push
```

---

## Phase 5 — Full-page mobile menu overlay

### Task 10: Replace the side drawer with a full-page overlay

**Files:**
- Create: `shopify-theme/snippets/menu-overlay.liquid`
- Modify: `shopify-theme/snippets/navigation-mobile.liquid` (or header.liquid include) to render the overlay from `linklists[section.settings.menu_mobile]`
- Modify: overlay JS (burger opens it; menu→search hand-off keeps scroll locked)
- Reference: wireframe `.menu-overlay`, `.mo-*`, staggered entrance

**Step 1** — Build the full-page overlay from the native mobile linklist: big items with `<details>` accordions for children, a search trigger row, Cart/Account footer. GSAP stagger + CSS fallback; hide the overlay's own scrollbar; body scroll-locked.

**Step 2** — Burger opens overlay; the in-overlay search trigger fades the menu out (keeping scroll locked) then opens the search overlay.

**Step 3** — Lint + push:
```bash
shopify theme push --only snippets/menu-overlay.liquid,snippets/navigation-mobile.liquid,assets/header-megamenu.js,assets/section-header.css --theme $DEV_ID --path shopify-theme
```

**Step 4** — Verify at ≤990px on the preview (and a real device / devtools): full-page overlay, accordions, no scroll shift, smooth menu→search hand-off.

**Step 5 — Commit + push:**
```bash
git commit -m "feat(nav): full-page mobile menu overlay replaces side drawer"
git push
```

---

## Phase 6 — Halloween colour scheme

### Task 11: Add a real Halloween scheme

**Files:**
- Modify: `shopify-theme/config/settings_schema.json` (scheme definitions if needed) / `config/settings_data.json` (add a scheme instance)

**Step 1** — Add a Halloween colour scheme (orange/near-black) as a real theme colour scheme so Songs/Countdown can reference it **by name** — replacing the wireframe's placeholder `--c-orange-*`.

**Step 2** — Push `--only config/settings_data.json`, verify the scheme appears in the scheme picker and the Halloween category/countdown uses it.

**Step 3 — Commit + push:**
```bash
git commit -m "feat(theme): add Halloween colour scheme"
git push
```

---

## Phase 7 — Migrate content, retire the metaobject, delete dead code

### Task 12: Re-create the live menus with the new blocks

**Files:** theme editor (config/settings_data.json will change) — pull after.

**Step 1** — In the theme editor on the dev theme, for each nav item (Songs/Shop/Discover/Countdown/About) add a **Menu item** block, set its type, and fill the settings to match the wireframe content. Confirm the final **Discover page list** and real **category logo assets** with Mark here.

**Step 2** — Pull the resulting config so git matches:
```bash
shopify theme pull --only config/settings_data.json --theme $DEV_ID --path shopify-theme
git add shopify-theme/config/settings_data.json
git commit -m "chore(header): configure new typed menu blocks on dev theme"
git push
```

### Task 13: Remove the old metaobject-driven code

**Files:**
- Modify: `shopify-theme/sections/header.liquid` (delete the old `mega_menu` block type)
- Delete: `shopify-theme/snippets/megamenu-products.liquid` (only if no longer referenced — grep first)
- Modify: `assets/header-megamenu.js`, `assets/megamenu.css` (strip index-based colour/logo/button logic no longer used)

**Step 1** — `grep -r "mega_menu_item\|megamenu-products\|button_2_menu\|menu_categories" shopify-theme` → confirm zero remaining references before deleting anything. **Before deleting, confirm it isn't the only copy** (check it's committed and pushed).

**Step 2** — Remove dead code, lint, push the changed/removed files, verify nothing broke.

**Step 3 — Commit + push:**
```bash
git commit -m "chore(header): retire mega_menu_item metaobject + dead megamenu code"
git push
```

**Step 4** — (Later, after live cutover) delete the `mega_menu_item` metaobject **definition** in Shopify admin — NOT during this branch.

---

## Phase 8 — QA, accessibility, cutover

### Task 14: Cross-device + a11y pass

**Step 1** — Verify on the preview at 360 / 768 / 1024 / 1440 / 1920: all four menu types, floating + docked, transparent→solid, search overlay, mobile overlay. Use chrome-devtools screenshots for the record.

**Step 2** — Accessibility: keyboard open/close (Enter/Space/Esc), focus trap in overlays, `aria-expanded` on triggers, `aria-modal` on overlays, focus returns to the trigger on close, `prefers-reduced-motion` disables GSAP/transitions. Run `shopify theme check` clean.

**Step 3 — Commit + push** any fixes:
```bash
git commit -m "fix(header): a11y + responsive polish for menu/search overlays"
git push
```

### Task 15: PR + cutover

**Step 1** — Open the PR into `main`; link the design doc, this plan, and preview screenshots.
```bash
gh pr create --base main --head feat/mega-menu-rebuild --title "Mega menu rebuild (typed blocks, overlays, floating header)" --body "..."
```

**Step 2** — After review/merge, when ready to go live, **publish the dev theme** (it becomes live) per CLAUDE.md — theme-editor settings live in `settings_data.json` on the theme being published, so configure on the dev theme **then publish**. Keep `main` in sync with the live theme afterwards.

**Step 3** — After live cutover is confirmed stable, delete the `mega_menu_item` metaobject definition in admin.

---

## Definition of done

- No `metaobjects.mega_menu_item` / index-based colour or button routing anywhere.
- Adding/editing a menu is done entirely in the theme editor (native Navigation + one typed block per item) with live preview.
- Songs / Shop / Discover / Countdown / Simple all render from block settings and match the approved wireframe.
- Floating header, transparent→solid on scroll, full-screen search overlay (live predictive results, no page shift), full-page mobile menu overlay — all working and accessible.
- Every deployed change has a matching `git push`; nothing pushed to `[live]` until the planned cutover; PR merged into `main`.
