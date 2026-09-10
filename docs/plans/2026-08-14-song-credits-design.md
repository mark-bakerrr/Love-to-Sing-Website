# Song Credits — Design

**Date:** 2026-08-14
**Area:** `sections/song-about.liquid` on `product.song_*` templates (lovetosing.com)
**Status:** Design approved — ready for implementation plan.

## Goal

Add a **Credits** block to the Song About section on individual song pages, showing role-attributed credits (e.g. "Written by Linda Adamson"). Must support any number of writers/contributors and any role (future-proof), reuse people across the catalogue, and render only what's populated.

## Data model — Approach A (Person + Credit join, metaobjects)

Two metaobjects + product metafields:

1. **`contributor`** metaobject
   - `name` — single line text (required)
   - `link` — URL (optional; e.g. artist/bio page, APRA/IPI, website). Shown only if set.
   - Reused across the whole catalogue (a writer credited on many songs is one entry).

2. **`song_credit`** metaobject (the join that carries the role)
   - `contributor` — metaobject reference → `contributor` (required)
   - `role` — single-line text restricted to a **predefined-but-extendable list**: Writer, Composer, Arranger, Producer, Performer, Vocals, Musician, Mixing, Mastering (add more in admin, no code change)
   - Reusable: e.g. one "Linda Adamson · Writer" credit can be referenced by many songs.

3. **Product (song) metafields**
   - `custom.credits` — **list of metaobject references → `song_credit`** (ordered)
   - `custom.copyright_line` — single-line text. Blank ⇒ default "© Love to Sing Limited"; set it for licensed songs we don't own.

**Performer** is rendered **statically** as "Performed by Love to Sing" (always shown) — no per-song data needed.

## Role → phrase mapping (approved)

| Role | Phrase |
|------|--------|
| Writer | Written by {name} |
| Composer | Composed by {name} |
| Arranger | Arranged by {name} |
| Producer | Produced by {name} |
| Performer | Performed by {name} |
| *(any other/custom role)* | {Role}: {name}  — e.g. "Vocals: …" |

Fallback keeps unknown roles readable without a code change.

## Display

- **Location:** new Credits block in the Song About **aside, above the Categories (tags) pills**.
- **Design:** Variant **B — micro-label rows**: a tiny uppercase role label above each name; names link out when `contributor.link` is set. Ends with the copyright line.
- **Conditional:** the whole block renders only if there is ≥1 credit (or an override); each role line renders only if populated. Copyright always shows (default or override).
- Wireframe: `docs/plans/credits-wireframes/index.html` (Variant B).

## Ingestion — 13 priority original Christmas songs

All credited: **Written by Linda Adamson · Performed by Love to Sing · © Love to Sing Limited.**
Efficient path: create one `contributor` (Linda Adamson) + one `song_credit` (Linda Adamson · Writer), then reference that single credit on all 13 song products:

Christmas Is a Season of Love · Pōhutukawa Tree · Christmas in the Southern Hemisphere · He Has a Red, Red Coat · Christ Was Born on Christmas Day · I'm Standing Under the Mistletoe · Ring Ring Ring the Bells · I've Got the Christmas Joy · When Santa Comes to My House · Chubby Little Snowman · In France He's Known as Père Noël · I'm a Little Snowman · Waiata Pōhutukawa Tree

(Match products by title/handle; copyright + performer come from defaults, so only the writer credit is attached.)

## Implementation notes

- Build/test on the **v3 dev theme** (`Love to Sing Website v3.0.0`, unpublished) per repo `CLAUDE.md`; never push to live.
- Metaobject definitions + product metafield definitions are created in Shopify admin (or via Admin API); the section reads them via Liquid.
- Follow the repo workflow: branch → `shopify theme push --only sections/song-about.liquid` (+ new css) → commit + push to GitHub.

## Open items / edge cases

- Bulk ingestion of the 13 songs: theme edit (Liquid) is separate from **data entry** (metaobjects + attaching credits to products) — the latter is done via admin or Admin API (needs product↔title matching). Confirm whether to script it via the content-studio Admin API or enter manually.
- `role` predefined list seed values (above) — extend anytime in admin.
