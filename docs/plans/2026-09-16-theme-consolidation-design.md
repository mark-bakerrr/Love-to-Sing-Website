# Theme consolidation — clean v3.2.0 dev theme (design)

**Date:** 2026-09-16
**Branch:** `feat/mega-menu-rebuild`
**Status:** Approved by Mark 2026-09-16

## Goal

One clean dev theme (v3.2.0) containing the live site's current state (v3.1.5,
including the photo-wall fixes) plus the mega-menu / search-drawer / countdown
work, with git matching it exactly — so all future building happens on one
consolidated base.

## Hard constraint

**Nothing is published or pushed to the live theme without Mark's explicit
permission.** All pushes in this work target the unpublished dev theme
v3.2.0 (`185067962641`) only. The live theme v3.1.5 (`185465241873`) is only
ever read from (already pulled to `tmp/theme-live-315`).

## Findings from the theme review (2026-09-16)

Full file-by-file diff of live v3.1.5 vs dev v3.2.0 vs local branch:

1. **Photo-wall work is already ported.** `photo-wall.css/.js/.liquid`,
   `photo-wall-playlist.json`, and `main-team-bio.liquid` are byte-identical
   across live, dev, and the git branch. Nothing to port at code level.
2. **Dev v3.2.0 = live v3.1.5 + branch work.** Every code difference between
   live and dev is mega-menu/search/countdown work from this branch. No
   live-only files; live's `settings_data.json` has nothing dev lacks (dev
   only adds 8 countdown keys).
3. **Git is stale for a handful of files** — both themes agree on newer
   versions than what's committed: `single-multi-login.liquid`,
   `page.single.livestream-v2.liquid`, the four `templates/metaobject/team*.json`,
   plus editor-state JSON dev is ahead on: `header-group.json` (menu_item
   blocks created in the editor — required, since Shopify CLI strips
   `visible_if` blocks on push), `settings_data.json`,
   `page.buy-a-licence.json`, `product.song_christmas.json`,
   `product.song_halloween.json`.
4. **One content conflict:** `page.about.json` — identical section structure,
   different copy. **Decision: live's version wins** (intro mentioning the
   five YouTube channels; Henry / Saradha / Ana testimonials).
5. **CLAUDE.md is out of date** — still lists v3.1.3 as live.

## Chosen approach: reconcile in place

Rejected alternatives: duplicating live into a fresh dev theme (would destroy
the editor-configured `menu_item` blocks, which cannot be re-pushed via CLI
due to the `visible_if` strip bug) and a git-first full-directory push
(violates the safe-deploy rule; also nukes the menu blocks).

## Steps

1. **Fix the About page on dev** — push live's `templates/page.about.json`
   (from `tmp/theme-live-315`) to v3.2.0 with
   `shopify theme push --only templates/page.about.json --theme 185067962641`.
   This is the only change v3.2.0 needs.
2. **Sync git to the theme state** — one commit on `feat/mega-menu-rebuild`
   adopting the dev theme's versions (from `tmp/theme-dev-320`) of:
   `snippets/single-multi-login.liquid`,
   `templates/page.single.livestream-v2.liquid`,
   `templates/metaobject/team.json` / `team.linda.json` / `team.mark.json` /
   `team.tessa.json`, `sections/header-group.json`,
   `config/settings_data.json`, `templates/page.buy-a-licence.json`,
   `templates/product.song_christmas.json`,
   `templates/product.song_halloween.json`, and `templates/page.about.json`
   (live's copy). Push to origin.
3. **Update CLAUDE.md** — theme table: LIVE = v3.1.5 `185465241873`,
   DEV = v3.2.0 `185067962641`; note photo fixes are on both lines. Separate
   commit, same branch.
4. **Prune superseded themes** — delete v3.1.0, v3.1.1, v3.1.2, v3.1.4 only.
   Keep v3.1.3 (pre-photo-fix fallback), v3.1.5 (live), v3.2.0 (dev), and the
   older named backups (Version 9.9, Backup of [Dev] Songs ×2, Blog Rebuild
   ×2, Santa Tracker Preview v1).
5. **Verify** — re-pull v3.2.0, diff against git (expect: theme files
   identical), spot-check About page, photo wall, and mega menu on the
   v3.2.0 preview URL.

## Error handling / safety

- Every theme push is `--only` a single file; no full-directory pushes.
- Theme deletions run last, only after the verification diff is clean, and
  never touch v3.1.3 / v3.1.5 / v3.2.0.
- Git stays on `feat/mega-menu-rebuild`; PR into `main` only when v3.2.0 is
  ready to publish (main keeps matching live until then).
