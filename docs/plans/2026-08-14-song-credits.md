# Song Credits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show role-attributed credits (e.g. "Written by Linda Adamson") in the Song About aside, above the category tags, on `product.song_*` pages.

**Architecture:** Two Shopify metaobjects — `contributor` (name + link) and `song_credit` (contributor ref + role) — joined to each song via a `custom.credits` product metafield (list of `song_credit` refs). `sections/song-about.liquid` reads them, maps role→phrase, and renders Design B (micro-label rows). Performer is static "Love to Sing"; copyright defaults to "© Love to Sing Limited" unless `custom.copyright_line` is set.

**Tech Stack:** Shopify Online Store 2.0 theme (Liquid), metaobjects + product metafields, Shopify CLI. Dev theme: **Love to Sing Website v3.0.0** (`#184956944657`, unpublished). Repo working dir: `shopify-theme/`. Design ref: `docs/plans/2026-08-14-song-credits-design.md`, wireframe `docs/plans/credits-wireframes/index.html` (Variant B).

**Workflow (per repo `CLAUDE.md`):** confirm dev theme via `shopify theme list`; edit → `shopify theme push --only <file> --theme 184956944657` → commit → push to GitHub. Never full-directory push. Branch: `feat/song-credits`.

---

### Task 1: Create the metaobject + metafield definitions (Shopify admin)

Data definitions can't be pushed via the theme CLI — create them once in **Settings → Custom data** (or via Admin API).

**Step 1 — `contributor` metaobject** (Settings → Custom data → Metaobjects → Add definition)
- Name: `Contributor`, type handle: `contributor`
- Fields:
  - `name` — Single line text — **required**
  - `link` — URL — optional
- Options: allow "Used as a reference" (referenceable).

**Step 2 — `song_credit` metaobject**
- Name: `Song credit`, type handle: `song_credit`
- Fields:
  - `contributor` — Metaobject reference → `Contributor` — **required**
  - `role` — Single line text — set **"Limit to a list of values"**: `Writer, Composer, Arranger, Producer, Performer, Vocals, Musician, Mixing, Mastering` — **required**
- Referenceable: yes.

**Step 3 — product metafields** (Settings → Custom data → Products)
- `custom.credits` — **List of metaobject references → Song credit**
- `custom.copyright_line` — Single line text

**Step 4 — Verify:** In admin, open any song product → Metafields → confirm "Credits" (list) and "Copyright line" appear.

**Step 5 — Commit:** (no repo change; note completion in the PR/commit message later.)

---

### Task 2: Build the credits snippet (role→phrase mapping + Design B markup)

**Files:**
- Create: `shopify-theme/snippets/song-credits.liquid`

**Step 1 — Write the snippet** (exact content):

```liquid
{%- comment -%}
  Renders the song credits block (Design B — micro-label rows).
  Reads product.metafields.custom.credits (list of `song_credit` metaobjects)
  and product.metafields.custom.copyright_line (override).
  Accepts: product (defaults to the current product).
{%- endcomment -%}
{%- liquid
  assign _product = product | default: product
  assign credits = _product.metafields.custom.credits.value
  assign copyright_line = _product.metafields.custom.copyright_line
  if copyright_line == blank
    assign copyright_line = '© Love to Sing Limited'
  endif
-%}

{%- if credits != blank or copyright_line != blank -%}
  <div class="song-credits" id="SongCredits">
    <h3 class="song-about__aside-title">Credits</h3>

    <div class="song-credits__list">
      {%- for credit in credits -%}
        {%- liquid
          assign person = credit.contributor.value
          assign person_name = person.name
          assign person_link = person.link
          assign role = credit.role
          case role
            when 'Writer'
              assign phrase = 'Written by'
            when 'Composer'
              assign phrase = 'Composed by'
            when 'Arranger'
              assign phrase = 'Arranged by'
            when 'Producer'
              assign phrase = 'Produced by'
            when 'Performer'
              assign phrase = 'Performed by'
            else
              assign phrase = role | append: ':'
          endcase
        -%}
        {%- if person_name != blank -%}
          <div class="song-credits__row">
            <span class="song-credits__role">{{ phrase }}</span>
            <span class="song-credits__who">
              {%- if person_link != blank -%}
                <a href="{{ person_link }}" rel="noopener" target="_blank">{{ person_name | escape }}</a>
              {%- else -%}
                {{ person_name | escape }}
              {%- endif -%}
            </span>
          </div>
        {%- endif -%}
      {%- endfor -%}

      {%- comment -%} Performer is always Love to Sing {%- endcomment -%}
      <div class="song-credits__row">
        <span class="song-credits__role">Performed by</span>
        <span class="song-credits__who">Love to Sing</span>
      </div>
    </div>

    <p class="song-credits__copyright">{{ copyright_line | escape }}</p>
  </div>
{%- endif -%}
```

**Step 2 — Note the two Liquid unknowns to verify on the dev theme (Task 5):**
- `credit.contributor.value` returns the referenced `contributor` metaobject (then `.name`, `.link`).
- `credit.role` returns the text value. If it renders blank, try `credit.role.value`.

**Step 3 — Commit:**
```bash
git add shopify-theme/snippets/song-credits.liquid
git commit -m "feat(song-credits): add credits snippet with role->phrase mapping"
```

---

### Task 3: Add the credits CSS (Design B)

**Files:**
- Modify: `shopify-theme/assets/song-about.css` (append)

**Step 1 — Append:**

```css
/* ── Song credits (Design B — micro-label rows) ─────────────────────── */
.song-credits { margin-bottom: 2.8rem; }
.song-credits__list { display: flex; flex-direction: column; gap: 1.4rem; }
.song-credits__row { display: flex; flex-direction: column; gap: 0.2rem; }
.song-credits__role {
  font-size: 1.05rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-neutral-400, #888);
  font-weight: 800;
}
.song-credits__who { font-size: var(--fz-m, 1.8rem); font-weight: 800; }
.song-credits__who a { color: var(--c-red-600, #912422); text-decoration: none; }
.song-credits__who a:hover { text-decoration: underline; }
.song-credits__copyright {
  margin: 1.6rem 0 0;
  font-size: var(--fz-s, 1.4rem);
  color: var(--c-neutral-400, #888);
  font-weight: 700;
}
/* divider between credits and categories */
.song-about__aside .song-credits + .song-about__aside-title { margin-top: 0; }
```

**Step 2 — Commit:**
```bash
git add shopify-theme/assets/song-about.css
git commit -m "style(song-credits): micro-label rows CSS"
```

---

### Task 4: Wire the credits into the Song About aside (above tags)

**Files:**
- Modify: `shopify-theme/sections/song-about.liquid` (inside `.song-about__aside`, before the categories block)

**Step 1 — In the aside `<div class="song-about__aside">`, render the snippet BEFORE the `aside_title`/collections.** The aside currently only renders when `collections_ref.size > 0`. Change the aside to also render when credits exist. Replace the aside opening condition:

Find:
```liquid
{%- if collections_ref.size > 0 or collections_ref.count > 0 -%}
  <div class="song-about__aside">
```
Replace with:
```liquid
{%- assign has_credits = product.metafields.custom.credits.value | default: product.metafields.custom.copyright_line -%}
{%- if collections_ref.size > 0 or collections_ref.count > 0 or has_credits != blank -%}
  <div class="song-about__aside">
    {%- render 'song-credits', product: product -%}
    {%- if collections_ref.size > 0 -%}<div class="aside-divider"></div>{%- endif -%}
```
(Leave the existing `aside_title` + collections markup after it; wrap the collections in the existing `{% if aside_title %}`/`<ul>` as-is.)

**Step 2 — Add a minimal divider style** if not present, append to `song-about.css`:
```css
.aside-divider { height: 1px; background: var(--c-neutral-200, #E8E8E8); margin: 2.4rem 0; }
```

**Step 3 — Commit:**
```bash
git add shopify-theme/sections/song-about.liquid shopify-theme/assets/song-about.css
git commit -m "feat(song-credits): render credits in Song About aside above tags"
```

---

### Task 5: Deploy to v3 dev theme + verify rendering

**Step 1 — Confirm dev theme id:**
```bash
cd shopify-theme
shopify theme list --store christmas-songs-carols.myshopify.com
```
Expected: `Love to Sing Website v3.0.0  [unpublished]  #184956944657`. If different, use the current unpublished id.

**Step 2 — Push only the changed files:**
```bash
shopify theme push --only snippets/song-credits.liquid --only sections/song-about.liquid --only assets/song-about.css --store christmas-songs-carols.myshopify.com --theme 184956944657
```
Expected: "pushed successfully".

**Step 3 — Seed ONE test credit** (admin, quick): create Contributor "Linda Adamson" → Song credit (Linda Adamson, Writer) → attach to product "Christmas Is a Season of Love" `custom.credits`.

**Step 4 — Verify on the dev preview:**
Open `https://christmas-songs-carols.myshopify.com/products/<handle>?preview_theme_id=184956944657` for that song.
Check: aside shows **Credits** → "WRITTEN BY / Linda Adamson (link)", "PERFORMED BY / Love to Sing", "© Love to Sing Limited", then a divider and the Categories pills.
- If the name/role render blank, switch `credit.role` → `credit.role.value` and/or `credit.contributor.value` handling in the snippet, re-push, re-check.

**Step 5 — Verify a song WITHOUT credits** still renders fine (no empty Credits heading beyond the static Performer + copyright — confirm that's acceptable, or gate the static Performer/copyright behind `credits != blank` if you'd rather hide the block entirely on songs with no writer).

**Step 6 — Commit** (already committed in Tasks 2-4; nothing new unless the `.value` fix was needed):
```bash
git add -A shopify-theme && git commit -m "fix(song-credits): metaobject field access verified on dev theme" || echo "no fix needed"
```

---

### Task 6: Ingest the 13 priority songs

All: Written by **Linda Adamson**, Performed by Love to Sing, © Love to Sing Limited.

**Step 1 — Reuse the single credit:** the "Linda Adamson · Writer" `song_credit` from Task 5 is reused — attach it to each song's `custom.credits`.

**Step 2 — Attach to these products** (match by title/handle):
Christmas Is a Season of Love · Pōhutukawa Tree · Christmas in the Southern Hemisphere · He Has a Red, Red Coat · Christ Was Born on Christmas Day · I'm Standing Under the Mistletoe · Ring Ring Ring the Bells · I've Got the Christmas Joy · When Santa Comes to My House · Chubby Little Snowman · In France He's Known as Père Noël · I'm a Little Snowman · Waiata Pōhutukawa Tree

**Option A (manual):** admin, per product, set `custom.credits` = [Linda Adamson · Writer]. ~2 min each.
**Option B (scripted):** use the Admin API (content-studio has store creds + upsert-script patterns). Write a script that resolves each product by title → sets the `custom.credits` metafield to the credit's GID. **Decision needed from Mark:** manual vs. scripted. Prefer scripted for 13+ and future scale.

**Step 3 — Verify:** spot-check 3 song pages on the dev preview show the writer credit.

---

### Task 7: Final commit + push to GitHub

**Step 1 — Ensure GitHub is current (repo `CLAUDE.md`):**
```bash
git push -u origin feat/song-credits
```
**Step 2 — Publish path:** merge to `main` when approved; deploy to live only after the v3→live promotion Mark controls. Do not push to the live theme directly.

---

## Notes / decisions for Mark
- **Ingestion method** (Task 6): manual admin vs. scripted Admin API. Scripted is better for scale but needs the store Admin token (present in `love-to-sing-content-studio/.env`).
- **Empty-credit songs** (Task 5, Step 5): should songs with no writer still show "Performed by Love to Sing / ©", or hide the whole block? Current plan shows them; easy to gate if you prefer hidden.
