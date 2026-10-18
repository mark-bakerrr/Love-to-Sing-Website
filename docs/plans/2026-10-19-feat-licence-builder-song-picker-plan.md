---
title: "feat: Add songs & videos picker step to the licence builder"
type: feat
date: 2026-10-19
deepened: 2026-10-19
brainstorm: docs/brainstorms/2026-10-19-licence-builder-song-picker-brainstorm.md
---

# ✨ feat: Add songs & videos picker step to the licence builder

## Enhancement Summary

**Deepened on:** 2026-10-19 · **Sections enhanced:** 7 · **Reviewers:** Shopify API verification (shopify.dev plus live GETs), accessibility and theme standards (`liquid-theme-a11y`, `liquid-theme-standards` skills), correctness and simplicity review.

### Key improvements
1. **One money unit everywhere: integer cents.** The licence JSON now emits `v.price` (cents) instead of `money_without_currency | remove: ','`, which broke on comma-decimal currencies and invited float errors.
2. **One `syncRows()` driven by the `picks` Map.** Search rows inserted later show the right picked state, so clicking an already-picked item no longer removes it. Variant IDs are always `String()` keys.
3. **Race guards.** A `busy` flag stops double-adds, because `render()` used to re-enable the button mid-add. `AbortError` and stale responses are ignored, and `r.ok` is checked for both search and cart.
4. **Exact kind rule.** `sfx == 'album'`, not `contains 'album'`, which matched legacy `single.album`. Songs use an explicit suffix list. `featured_image` is checked for nil.
5. **Dedupe at add time only.** One `/cart.js` read inside `addToCart()` drops picks already in the cart. A `_lts_source` property would otherwise create a **second paid line**, and the webhook skips duplicate purchases with no refund.
6. **Accessible toggles and status.** The toggle's accessible name stays the same, with only `aria-pressed` flipping. One `role="status"` node, `role="alert"` for cart errors, focus management on remove, ≥44px targets, and a search border at ≥3:1 contrast.
7. **Markets-safe routes.** `routes.search_url` and `routes.cart_add_url` are passed through data attributes. The membership note and popular heading become schema settings (no locale-file push).

### Corrections to the first draft
- `enabled_on` does **not** block Section Rendering. It only limits the theme editor. Leaving it off the results section is still fine (verified live: `section_id=lts-licence-builder` rendered on `/search`).
- The `paginate` page-size cap is **250**, not 50. `options[prefix]=last` is already the default (harmless). Junk `options[unavailable_products]` values are silently ignored, so keep the Liquid `available` check.
- `/cart/add.js` partial adds are **possible**: the docs describe 422 responses after a partial add, and all-or-nothing behaviour isn't documented. Treat any failure as "cart may have changed" and re-render the drawer.

### Cut for v1 (YAGNI; every brainstorm decision survives)
The per-term search cache, live "In cart" row states with `cart:refresh` re-sync, the 5-titles "+N more" summary, per-filter empty-state copy, the `licence_picker_add_item` GA4 event, and the mobile sticky bar (follow-up if mobile conversion lags).

### Revision (2026-10-19, after Mark's review): two-screen flow
Mark asked for the picker to become its own screen. He didn't want a lone search bar, wanted Your picks at the top, and wanted the summary card to persist. These supersede the step-5 layout described below:
- **Screen 1 "Your licence"** holds steps 1–4. "Continue: add songs & videos" is enabled only when the licence is valid. A progress bar shows both screens.
- **Screen 2 "Songs & videos"** (optional) contains, in order:
  - "← Back to your licence"
  - **Your picks**, at the top, with remove ×
  - search
  - **category tabs**, from theme-editor collection settings; defaults are Christmas `christmas-song-lyrics`, Kids `kids-song-lyrics`, Videos `christmas-video-songs`, Halloween `halloween-songs`, Celebration `celebration-song-lyrics`, Albums `digital-albums`. A "Popular" tab appears only when the org has curated picks.
  - the All/Songs/Videos filter
  - list rows with **Load more** (24 per page). A thin filtered page auto-fetches up to 3 more pages.
- Screen 2 pushes `#songs`, so browser Back returns to screen 1. A reload on `#songs` starts on screen 1.
- **The summary card persists on both screens.** It itemises the licence (band and price/yr) and every pick (with ×), then shows "Total today".
- **Mobile:** a sticky bottom bar shows the order name, item count, total and Add to cart. It hides while the card is in view, and lifts the site-wide `.lts-cdw` countdown pill above itself.
- `lts-licence-picker-results.liquid` now renders either `search.results` or `collection.products`, and emits `[data-has-next]`.

### Build notes (local build, 2026-10-19)
- **Branch:** `feat/licence-builder-song-picker`, cut from `feat/mega-menu-rebuild`. That branch matches v3.2.0 (#185067962641), apart from editor settings in `templates/index.json`. `origin/main` is from June, 128 files behind.
- **E-books use the `video_download` template**, so the suffix alone labelled them "Video". The snippet now also excludes `product.type == 'E-books'` and the `ebook` tag.
- **`/cart/add.js` with `items[]` is all-or-nothing** for an invalid variant. In testing, the licence plus a bogus ID gave a 422 "Cannot find variant", and nothing was added.
- **`shopify theme dev`'s local proxy (127.0.0.1:9292) returns 404** for `section_id=lts-licence-picker-results` on `/search`, because the section isn't in the search template. The same request renders fine on Shopify (dev theme preview and live). Test search through the preview URL `…/pages/licence-builder?preview_theme_id=<dev theme id>`, not 127.0.0.1.
- Verified on a private development theme:
  - search, filter chips and show-more
  - pick sync across lists
  - the total, e.g. $119.99 + $1.99 + $6.99 = $128.97
  - a combined add (3 lines with the correct properties)
  - the in-cart dedupe
  - the error path
  - popular picks per org, hidden when the list is empty
  - membership note
  - deep-link regression
  - 375px layout
- **Gating observed:** `pohutukawa-tree` and `happy-birthday-lyrics` have `lts.downloads_ready=false`, so they're hidden. Videos of cover songs (e.g. "All I Want for Christmas" video) still appear, because videos aren't gated store-wide.
- **Pre-existing behaviour (not changed):** adding the same licence twice merges into one line with quantity 2.

---

## Overview

Add an optional **step 5, "Add songs & videos"**, to `/pages/licence-builder` (`shopify-theme/sections/lts-licence-builder.liquid`). The customer searches the catalogue (or taps a popular pick for their org type), toggles songs, videos and albums into "Your picks", and sees a combined total. A single **Add to cart** adds the licence and all picks in one `/cart/add.js` call.

It's a **convenience cross-sell**: picks are ordinary product lines, with no licence linkage, no bundle price and no certificate changes.

## Problem Statement / Motivation

Churches, schools and community groups who buy a licence almost always need the songs too. Today they finish the builder, then have to go and hunt for each song in the shop. Picking them in the same flow should raise basket size and cut drop-off between "licensed" and "has the music".

## Research Findings

### Current builder (`shopify-theme/sections/lts-licence-builder.liquid`)
- 4 steps in `.lts-lb-panel` (`:49-81`) and a sticky `.lts-lb-sumcard` (`:83-90`). It stacks under the panel below 860px (`:155-158`).
- Licence prices and variant IDs are SSR'd into `#lts-licence-data` (`:22-34`). This currently uses `money_without_currency | remove: ','`, which this plan **changes to integer cents**.
- `render()` (`:261-302`) has early returns: the missing-variant branch at `:279-287`, and the no-size branch. `addToCart()` (`:306-352`) posts 1 item with 5 properties (`_lts_org_name`, `_lts_org_type`, `_lts_size_band`, `_lts_declared_size`, `Size`).
- **Existing bug, fixed here:** `addToCart()` has no `r.ok` check (`:339-346`), so a 422 opens the drawer as if it succeeded. Also, `render()` resets `addBtn.disabled = !nameOk` on every `input` event, so typing during "Adding…" re-enables the button.

### Search
- The theme's predictive search uses the Section Rendering API (`assets/predictive-search.js:111-128`). It isn't reusable here: `snippets/predictive-search-item.liquid` has no variant ID or price.
- `/search/suggest.json` returns `variants: []` (verified live), and `resources[limit]` is clamped to 10.
- **Full search plus section rendering works** (verified live): `/search?q=pohu&type=product&section_id=…` gives 8 results, and "christmas" gives 337. Prefix matching is the default, `item.object_type` exists, and `type=product` returns only products.

### Product kinds and gating
- There's no product-kind metafield, and `product_type` is mostly blank. The canonical signal is **`template_suffix`**: `song_christmas|song_kids|song_celebration|song_halloween|song_lyrics`, `album`, `video_download`, `licence|licenses`, legacy `single.album|single.membership`.
- Cover-song gating writes only **`lts.downloads_ready`** (boolean, storefront-readable). Gated songs stay active, published and `available` in search. Source: `love-to-sing-content-studio/studio/lib/services/song-sellable.ts:13-18`.
- The rule to mirror is in `love-to-sing-content-studio/shopify/extensions/lts-blog-blocks/blocks/shop-drawer-embed.liquid:32-37`. Albums: `available`. Songs: `available and lts.downloads_ready.value`. A missing metafield counts as false, so the song is hidden, which matches the embed. Videos have no metafield.

### Cart and order side
- `assets/cart-drawer.js:35,135` handles `cart:reload` (fetch and open) and `cart:refresh` (re-render). `assets/cart-sync.js:22` already fires `cart:refresh` after any successful `/cart/add`, so **don't dispatch it again on success.**
- `snippets/line-item.liquid:162-164` hides `_`-prefixed properties. A multi-item `items[]` add already exists in `snippets/lts-shop-drawer.liquid:492-505`.
- **The webhook needs no change.** `studio/lib/services/purchase.ts:75` loops over every line item. Licences are issued per line using the `custom.license_type` metafield (`:175-225`). A duplicate purchase is skipped (`:89-94`), but the customer still pays, hence the add-time dedupe.

## Proposed Solution

### Architecture

```
lts-licence-builder.liquid  (page section)
 ├─ Steps 1–4 (unchanged UI)
 ├─ Step 5  "Add songs & videos (optional)"   .lts-lb-picker[data-filter]
 │    ├─ Filter chips: All · Songs · Videos   (client-side CSS on data-kind)
 │    ├─ <search> input ──debounce 300ms + abort──▶ {routes.search_url}?q=…&type=product
 │    │                                              &options[unavailable_products]=hide
 │    │                                              &section_id=lts-licence-picker-results
 │    ├─ Popular picks (SSR, product_list per org; hidden while searching)
 │    ├─ Results (first 8 shown + "Show more (N)")
 │    ├─ "Your picks" list with × remove
 │    └─ <p class="visually-hidden" role="status">
 └─ Summary card: Licence $X/year · Songs & videos (N) $Y · Total today $Z · one Add to cart
```

**New files**
- `shopify-theme/snippets/lts-picker-row.liquid` holds the single source of the kind and pickability rule, and is used by both popular picks and search results.
- `shopify-theme/sections/lts-licence-picker-results.liquid` renders `search.results` through the snippet. It has no presets, so it never shows in "Add section". No CSS goes here.

**Modified**
- `shopify-theme/sections/lts-licence-builder.liquid` gets step 5 markup, all picker CSS (in its single `{% stylesheet %}`), JS, schema settings, the switch of licence JSON to cents, and the `addToCart()` rewrite.

### Kind and pickability rule (`snippets/lts-picker-row.liquid`)

```liquid
{%- comment -%}
  Pickable-product rule. MUST mirror the app embed's sellable rule:
  love-to-sing-content-studio/shopify/extensions/lts-blog-blocks/blocks/shop-drawer-embed.liquid:32-37
  Params: product (required), source: 'popular' | 'search'
{%- endcomment -%}
{%- liquid
  assign sfx = product.template_suffix | default: ''
  assign song_sfx = 'song_christmas,song_kids,song_celebration,song_halloween' | split: ','
  assign kind = ''
  if product.available
    if sfx == 'video_download'
      assign kind = 'video'
    elsif sfx == 'album'
      assign kind = 'album'
    elsif song_sfx contains sfx and product.metafields.lts.downloads_ready.value
      assign kind = 'song'
    endif
  endif
  assign v = product.selected_or_first_available_variant
-%}
{%- if kind != '' and v -%}
  <li class="lts-lb-pick" data-kind="{{ kind }}" data-variant-id="{{ v.id }}"
      data-price="{{ v.price }}" data-title="{{ product.title | escape }}" data-source="{{ source }}">
    {%- if product.featured_image -%}
      {{ product.featured_image | image_url: width: 96 | image_tag: loading: 'lazy', alt: '', class: 'lts-lb-pick__thumb' }}
    {%- else -%}
      <span class="lts-lb-pick__thumb lts-lb-pick__thumb--empty" aria-hidden="true"></span>
    {%- endif -%}
    <span class="lts-lb-pick__title">{{ product.title | escape }}</span>
    <span class="lts-lb-pick__kind">{{ kind | capitalize }}</span>
    <span class="lts-lb-pick__price">{{ v.price | money }}</span>
    <button type="button" class="lts-lb-pick__toggle" aria-pressed="false"
            aria-label="Add {{ product.title | escape }} to your picks">
      <span class="lts-lb-pick__state" aria-hidden="true">Add</span>
    </button>
  </li>
{%- endif -%}
```

- `song_lyrics` is **excluded by default**. Add it to `song_sfx` only if Phase 1 confirms those are real song products.
- Licences, membership, e-books, the default template and legacy `single.*` all fall through to `kind = ''` and render nothing.
- `data-price` is integer **cents** in presentment currency.
- *Optional:* for albums, append "· N songs" to the kind badge if a track-count metafield exists. Skip it if not.

### Results section (`sections/lts-licence-picker-results.liquid`)

```liquid
<ul class="lts-lb-results" role="list">
  {%- paginate search.results by 48 -%}
    {%- for item in search.results -%}
      {%- if item.object_type == 'product' -%}{%- render 'lts-picker-row', product: item, source: 'search' -%}{%- endif -%}
    {%- endfor -%}
  {%- endpaginate -%}
</ul>
{% schema %}{ "name": "Licence picker results", "settings": [] }{% endschema %}
```

The response comes wrapped in `<div id="shopify-section-lts-licence-picker-results">` with no layout. The JS extracts `.lts-lb-results` with `DOMParser` and counts the `<li>` items.

### Licence JSON → cents (`lts-licence-builder.liquid:29`)

```liquid
"{{ key }}":{"from":{{ p.price_min }},"variants":{ {%- for v in p.variants -%}"{{ v.option1 | remove: 'Band ' }}":{"id":{{ v.id }},"price":{{ v.price }}}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%} }}
```

`money(cents)` then formats `cents/100`. It keeps whole-dollar display when `cents % 100 === 0`. Better still, render with a `data-money-format` taken from `{{ shop.money_format | json }}`. At minimum, keep the `$` prefix as it is today.

### JS behaviour (inside the existing IIFE; new code in `const`/`let`, `async/await` and `for…of`, with no Liquid inside the logic so it can move to an asset later)

- **Config:** read `data-search-url="{{ routes.search_url }}"`, `data-cart-add-url="{{ routes.cart_add_url }}"` and `data-cart-url="{{ routes.cart_url }}"` off the section root. Build URLs with `URL` and `URLSearchParams`.
- **State:** `picks = new Map()`, keyed by **`String(variantId)`**, with values `{title, kind, price}` (cents). Plus `busy = false`.
- **`syncRows()`** is the one function that reflects state. For every `.lts-lb-pick` in the step, it sets `aria-pressed`, the state span text (Add / Added ✓) and the `--picked` modifier from `picks.has(row.dataset.variantId)`. It also rebuilds "Your picks", using `textContent` only. Call it after every toggle, after every insert of search results, and after popular lists switch.
- **Search:**
  - Under 2 chars: show popular picks and hide results.
  - Otherwise debounce 300ms, then `controller?.abort(); controller = new AbortController()` and fetch.
  - On response: `if (!r.ok) throw`. Ignore the result if `term !== input.value.trim()`. Insert it, run `syncRows()`, and show the first 8 rows plus "Show more (N)".
  - In the catch: ignore `err.name === 'AbortError'`. Otherwise show the error state with a **Try again** button.
  - While loading, keep the old results dimmed (`aria-busy="true"`) and reserve a `min-block-size` so the layout doesn't jump.
  - **Empty state:** `No songs or videos match "<term>"` set via `textContent`, plus a **Clear search** button.
  - Announce "N results" in the status node.
- **Filter chips:** set `data-filter` on `.lts-lb-picker`. CSS does the hiding: `.lts-lb-picker[data-filter="video"] .lts-lb-pick:not([data-kind="video"]){display:none}`. Albums show only under All. Announce the visible count.
- **Toggle:** a delegated `click` listener on `.lts-lb-picker` for `.lts-lb-pick__toggle`. Add or delete in `picks`, then `syncRows()`, then `render()`. Announce "Added <title>. 3 picks, $12.00". Focus stays on the button.
- **Remove (×) in Your picks:** each × button gets `aria-label="Remove <title>"`. After removal, move focus to the next ×, else the previous one, else the "Your picks" heading (`tabindex="-1"`).
- **Popular picks:** SSR three `<ul data-org="church|school|community" hidden>` lists (at most 6 shown each). `render()` unhides the current org's list, or hides the whole row if that list is empty. The heading comes from a label map (churches / schools / community groups), not `{{ org }}s`.
- **Membership selected:** show the `membership_note` setting text (empty means hidden).
- **`render()` changes:**
  - Compute and render the picks block (`Songs & videos (N) $Y`) **before** the existing early-return branches.
  - Show "Total today $Z" and the big price only where the licence price resolved. Otherwise show "Licence from $X/year + songs $Y".
  - The button needs a valid licence, as now, **and `!busy`**. Its copy is `Add licence + N items, $Z`, or the current copy when there are no picks.
- **`addToCart()` rewrite:**
  ```js
  async function addToCart() {
    if (busy) return;
    // …existing num / orgName / variant validation unchanged…
    busy = true; render(); addBtn.textContent = 'Adding…';
    try {
      const cart = await fetch(cfg.cartUrl + '.js', { headers: { Accept: 'application/json' } }).then(r => r.json());
      const owned = new Set(cart.items.map(i => String(i.variant_id)));
      const skipped = [];
      const items = [{ id: variantId, quantity: 1, properties: { /* existing 5 props, unchanged */ } }];
      for (const [id, p] of picks) {
        if (owned.has(id)) { skipped.push(p.title); continue; }
        items.push({ id: Number(id), quantity: 1, properties: { _lts_source: 'licence_builder' } });
      }
      const r = await fetch(cfg.cartAddUrl + '.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items })
      });
      const j = await r.json();
      if (!r.ok) throw j;
      track('licence_builder_add_to_cart', { licence: grant, org_type: org, picks_count: items.length - 1, value: totalCents / 100 });
      picks.clear(); syncRows();
      if (skipped.length) announce(skipped.length + ' item(s) were already in your cart and were not added again.');
      document.dispatchEvent(new CustomEvent('cart:reload'));   // cart-sync.js already fires cart:refresh
    } catch (err) {
      showCartError((err && err.description) || 'Something went wrong adding to your cart. Please try again.'); // textContent, role="alert"
      document.dispatchEvent(new CustomEvent('cart:refresh')); // a partial add is possible on 422
    } finally {
      busy = false; render();
    }
  }
  ```
- **Analytics:** `track(name, params)` wraps `window.gtag?.('event', name, {...params, surface: 'licence_builder'})` in try/catch, the same guard as `trackPreview` in `snippets/lts-shop-drawer.liquid:526`. The only event is `licence_builder_add_to_cart`.

### Markup sketch (step 5, appended after step 4 in `.lts-lb-panel`)

```html
<div class="lts-lb-step lts-lb-picker" data-filter="all"
     data-search-url="{{ routes.search_url }}" data-cart-add-url="{{ routes.cart_add_url }}" data-cart-url="{{ routes.cart_url }}">
  <h3 class="lts-lb-n">5 &middot; Add songs &amp; videos <span class="lts-lb-opt">(optional)</span></h3>
  <p class="lts-lb-hint lts-lb-picker__memnote" hidden>{{ section.settings.membership_note }}</p>

  <div class="lts-lb-seg-row lts-lb-seg-row--chips" role="group" aria-label="Filter results by type">
    <button type="button" class="lts-lb-seg" data-filter="all"   aria-pressed="true">All</button>
    <button type="button" class="lts-lb-seg" data-filter="song"  aria-pressed="false">Songs</button>
    <button type="button" class="lts-lb-seg" data-filter="video" aria-pressed="false">Videos</button>
  </div>

  <search aria-label="Song and video search">
    <label class="lts-lb-qlab" for="lts-lb-q-{{ section.id }}">Search songs, videos and albums</label>
    <input class="lts-lb-txt lts-lb-picker__q" id="lts-lb-q-{{ section.id }}" type="search" autocomplete="off"
           enterkeyhint="search" aria-describedby="lts-lb-qhint-{{ section.id }}"
           aria-controls="lts-lb-res-{{ section.id }}" placeholder="e.g. Pohutukawa Tree" />
    <p class="lts-lb-hint" id="lts-lb-qhint-{{ section.id }}">Type 2 or more letters.</p>
  </search>

  <div class="lts-lb-picker__popular">
    <p class="lts-lb-picker__poplab"></p>  <!-- "{{ section.settings.popular_heading }}" + label map, set by JS -->
    {%- for o in 'church,school,community' | split: ',' -%}
      {%- assign key = 'picks_' | append: o -%}
      <ul class="lts-lb-results" role="list" data-org="{{ o }}" hidden>
        {%- for p in section.settings[key] limit: 6 -%}{%- render 'lts-picker-row', product: p, source: 'popular' -%}{%- endfor -%}
      </ul>
    {%- endfor -%}
  </div>
  <div class="lts-lb-picker__results" id="lts-lb-res-{{ section.id }}" aria-busy="false" hidden></div>

  <div class="lts-lb-picker__picked">
    <h4 class="lts-lb-picker__pickedh" tabindex="-1">Your picks</h4>
    <ul role="list"></ul>
  </div>
  <p class="visually-hidden lts-lb-picker__status" role="status"></p>
</div>
```

The summary card gains `.lts-lb-sumcard__picks` (a `Songs & videos (N) · $Y` line, which jumps to Your picks) and a `.lts-lb-sumcard__error` with `role="alert"`. **Scope the existing `.lts-lb-sumcard li::before` ✓ rule to `#lts-lb-sumFeatures li`** (or a `__features` class) so it doesn't leak.

### CSS notes (in the builder's `{% stylesheet %}`, existing tokens)
- `.lts-lb-seg-row--chips{flex-direction:row; flex-wrap:wrap}` must win over the `max-width:520px` column rule.
- Rows: a grid of `48px thumb | 1fr title/kind | auto price | 44px toggle`. The toggle and × are **≥44×44px** with ≥8px gaps. Below 520px, the price and toggle wrap under the title.
- Badges: `--red-ink` text on `--red-50`. Avoid `--muted` on `--hair` (4.6:1, borderline).
- The search input border is **`#958a84`** (≥3:1 on white, WCAG 1.4.11). The existing `--line` border is about 1.2:1.
- Replace `outline:none` focus styles on the new controls with a `:focus-visible` 2px `--red` outline.
- Add the new transitions to the section's existing `prefers-reduced-motion` block, scoped to `.lts-lb-blk`.
- Use logical properties (`margin-block`, `padding-inline`) and BEM names (`.lts-lb-pick__*`, `.lts-lb-picker__*`). Use no IDs in new selectors.
- `.visually-hidden`: reuse the theme's utility if present, otherwise add a scoped one.

### Theme-editor settings (added to the builder schema)

```json
{ "type": "header", "content": "Step 5: songs & videos" },
{ "type": "text", "id": "popular_heading", "label": "Popular picks heading", "default": "Popular with" },
{ "type": "textarea", "id": "membership_note", "label": "Note shown when Membership is selected",
  "default": "Membership already includes downloads of our whole catalogue. Add items here only if you want them straight away." },
{ "type": "product_list", "id": "picks_church",    "label": "Church picks",    "limit": 6 },
{ "type": "product_list", "id": "picks_school",    "label": "School picks",    "limit": 6 },
{ "type": "product_list", "id": "picks_community", "label": "Community picks", "limit": 6 }
```

Picks go through the same snippet, so a product picked in the editor that later becomes gated or sold out quietly disappears.

## Spec-Flow: Edge Cases & States

| Situation | Behaviour |
|---|---|
| Licence incomplete, picks chosen | Button disabled with the current copy. Picks are kept. The summary shows "Licence from $X/year + songs $Y". |
| Licence complete, no picks | Today's behaviour: licence only. Copy is unchanged. |
| Licence variant missing (`render()` `:279-287` branch) | Price unavailable, as now. The picks line still renders, because it's computed before the early return. |
| Switch licence type or org after picking | Picks persist. The popular list swaps, and `syncRows()` reapplies the picked state. |
| Same product in popular and search | `syncRows()` keeps both in sync, because state lives in the Map, not the DOM. |
| Picked item appears in later search results | It renders as "Added ✓" (via `syncRows()` after insert). Clicking it removes it, as expected. |
| Product already in cart at add time | Dropped from the payload. The status node says "N item(s) were already in your cart". |
| Gated cover song, unavailable product, licence, e-book | Never rendered. |
| Search under 2 chars | Popular shown, results hidden. |
| Typing fast / stale response | The previous request is aborted. A response whose term ≠ the current input is discarded. `AbortError` is silent. |
| Zero results (or zero for the active chip) | Generic empty message (via `textContent`) plus **Clear search**. |
| Search HTTP error, network error or 429 | "Search isn't working right now" plus **Try again**. Popular picks are still usable. |
| Double-click Add / typing during the add | The `busy` flag blocks re-entry, and `render()` keeps the button disabled. |
| `/cart/add.js` 422 or network error | `role="alert"` error, picks kept, button re-enabled. `cart:refresh` re-renders the drawer (a partial add is possible). |
| Success | Picks cleared, `cart:reload` opens the drawer, licence fields kept. |
| Membership selected | Step visible, plus the `membership_note`. |
| Mobile (< 860px) | Step 5 is last in the panel and the summary follows it. Results show 8, then "Show more". The sticky bar is a follow-up. |
| Multi-currency / Markets subfolders | All prices are integer cents in presentment currency. Routes come from `routes.*`. |

## Implementation Phases

### Phase 1: Foundation (results section + row snippet)
- [ ] `snippets/lts-picker-row.liquid` (exact kind rule, image nil-guard, a11y toggle markup)
- [ ] `sections/lts-licence-picker-results.liquid`
- [ ] On dev theme `185067962641`: `/search?q=pohu&type=product&options[unavailable_products]=hide&section_id=lts-licence-picker-results&preview_theme_id=185067962641` returns rows with variant IDs. A song with `lts.downloads_ready=false` is absent. Licences and e-books are absent.
- [ ] Inspect `song_lyrics`-suffix products (Admin or Composio `shopify_suji`). Add the suffix to `song_sfx` only if they're real song products.

### Phase 2: Step 5 UI + state (`sections/lts-licence-builder.liquid`)
- [ ] Switch the licence JSON to cents, plus `money(cents)`. Regression-check the licence-only flow and the `?licence=&org=&size=` deep links.
- [ ] Step 5 markup, chips, `<search>`, SSR popular lists, Your picks, status node
- [ ] Schema: heading, membership note, 3 `product_list` settings
- [ ] JS: config from data attributes, `picks` Map, `syncRows()`, debounced + aborted search, filter chips, delegated toggle and remove with focus management, show-more, membership note
- [ ] `render()`: picks block before the early returns, total today, `busy`-aware button
- [ ] CSS per the notes above. Scope the `li::before` ✓ rule.

### Phase 3: Cart + polish
- [ ] Rewrite `addToCart()` (`busy`, `/cart.js` dedupe, `items[]`, `_lts_source`, `r.ok`, `role="alert"` error, `cart:reload` / failure `cart:refresh`)
- [ ] GA4 `licence_builder_add_to_cart`
- [ ] a11y pass: keyboard-only run, screen-reader announcements, 44px targets, contrast check, reduced motion, 375px width
- [ ] `shopify theme check` on the 3 files
- [ ] Find out on dev whether a 422 batch is all-or-nothing (e.g. temporarily pick a draft or out-of-stock variant ID via the console) and note the result in the PR

## Acceptance Criteria

### Functional
- [ ] Step 5 appears for all four licence types, labelled optional.
- [ ] 2+ characters show matching songs, videos and albums (thumb, title, kind, price) within about 1s. Results show 8, then "Show more".
- [ ] All / Songs / Videos filter without a new request. Albums appear only under All.
- [ ] Popular picks match the selected org type and change with it. They're hidden if that list is empty and hidden while searching.
- [ ] Gated cover songs, unavailable products, licences, membership and e-books never appear.
- [ ] Toggling updates Your picks, the summary (`Songs & videos (N) $Y`, `Total today $Z`) and every visible copy of that row, including rows inserted later.
- [ ] One click adds the licence (5 properties unchanged) plus picks not already in the cart (`quantity: 1`, `_lts_source: licence_builder`). The drawer opens with all of them.
- [ ] Licence-only add and URL-prefill deep links behave exactly as before.
- [ ] A failed add shows an alert, keeps picks, and doesn't fake success. Double-clicking can't add twice.
- [ ] A paid test order with licence + 2 songs produces 1 issued licence and a DownloadPackage with both songs.

### Non-functional
- [ ] On load: one SSR render and no extra requests. `/cart.js` is fetched only at add time.
- [ ] Search is debounced (300ms). Stale requests are aborted and stale responses discarded.
- [ ] WCAG 2.2 AA:
  - search wrapped in a labelled `<search>`
  - toggles keep a stable name and flip `aria-pressed`
  - one `role="status"` node, and `role="alert"` for cart errors
  - focus managed on remove
  - targets ≥44px
  - search border ≥3:1
  - `:focus-visible` outlines
  - reduced motion respected
- [ ] No horizontal scroll at 375px. `shopify theme check` shows no new errors.

## Success Metrics
- **Attach rate:** orders containing a licence line that also have at least one `_lts_source=licence_builder` line (visible in order line properties in admin). The GA4 view is `licence_builder_add_to_cart` with `picks_count > 0`.
- **Added value per licence order:** GA4 `value` minus the licence price.
- No rise in licence-builder abandonment (GA4 page → add_to_cart, before and after).

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Broad terms ("christmas") put albums and e-books in the top 48, so the Videos chip shows few | Accept for v1 (raise `paginate` up to 250 if needed, since the cap is 250). Follow-up option: bias the query when the Videos chip is active. |
| Gating rule drifts from the app embed | The snippet header comment names the source of truth. Call it out in the PR. |
| `/cart/add.js` partial add on 422 (undocumented) | `cart:refresh` on any failure. Picks are kept so the user can retry. Test on dev in Phase 3. |
| Doc wording that the "section ID must exist in the template" | Live test shows rendering by filename works. Phase 1 re-checks it on the dev theme. |
| Customers buying songs they already **own** from past orders | Out of scope (the dedupe only covers the current cart). Possible follow-up: a customer-owned check via the studio API. |
| **Deploy safety** (CLAUDE.md §3) | New branch from `main` in the website repo (the current checkout is on `feat/mega-menu-rebuild`). Pull the dev theme fresh. Run `shopify theme list` to confirm roles. Push **only** the 3 files with `--only` to `185067962641`. Never push to live. Commit and push to GitHub in the same session. Open a PR with `gh pr merge --auto`. |
| Popular-pick settings live per theme in `templates/page.licence-builder.json` | Configure them on the **dev** theme editor, then pull that JSON into git before the PR. They carry over when dev is published. |
| The inline `<script>` keeps growing | New code avoids Liquid, so a later move to `assets/lts-licence-builder.js` is mechanical. Note it in the PR. |

## Open Questions (defaults chosen, confirm with Mark)
1. **Membership note:** on, with the default copy above. It's a theme setting, so it can be edited or cleared without a deploy.
2. **Albums:** included under "All" with an "Album" badge, and no dedicated chip.
3. **E-books / lyrics books / `song_lyrics` products:** excluded unless Phase 1 shows `song_lyrics` are real songs.
4. **Popular picks:** Mark or Tessa chooses up to 6 products per org type in the dev theme editor after Phase 2.

## References
- Brainstorm: `docs/brainstorms/2026-10-19-licence-builder-song-picker-brainstorm.md`
- Builder: `shopify-theme/sections/lts-licence-builder.liquid:22-34, 261-352, 371-397`
- Search pipeline: `shopify-theme/assets/predictive-search.js:13-19,111-128`, `sections/predictive-search.liquid:25-38`
- Cart drawer events: `shopify-theme/assets/cart-drawer.js:35-36,110,135`. Auto-refresh: `assets/cart-sync.js:22`
- Multi-item add precedent: `shopify-theme/snippets/lts-shop-drawer.liquid:492-505`
- Hidden properties: `shopify-theme/snippets/line-item.liquid:162-164`
- `product_list` pattern: `shopify-theme/sections/featured-products.liquid:5,145-154`
- GA4 helper: `shopify-theme/snippets/lts-shop-drawer.liquid:523-550`
- Gating rule: `love-to-sing-content-studio/shopify/extensions/lts-blog-blocks/blocks/shop-drawer-embed.liquid:32-37`. Writer: `studio/lib/services/song-sellable.ts:13-18`
- Webhook: `love-to-sing-content-studio/studio/lib/services/purchase.ts:75-94,175-225`
- Shopify docs:
  - [Section Rendering API](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-section-rendering-api)
  - [Storefront search](https://shopify.dev/docs/storefronts/themes/navigation-search/search)
  - [`search` object](https://shopify.dev/docs/api/liquid/objects/search)
  - [Pagination limits](https://shopify.dev/docs/storefronts/themes/best-practices/performance/limit-pagination-depth)
  - [Predictive search](https://shopify.dev/docs/api/ajax/reference/predictive-search)
  - [Cart AJAX API](https://shopify.dev/docs/api/ajax/reference/cart)
  - [Input settings (`product_list`)](https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings)
  - [`variant` object](https://shopify.dev/docs/api/liquid/objects/variant)
