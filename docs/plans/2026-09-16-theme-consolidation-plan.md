# Theme Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dev theme v3.2.0 the single clean base (live v3.1.5 content + mega-menu/search/countdown work) with git matching it exactly, then prune superseded themes.

**Architecture:** Reconcile in place — v3.2.0 already equals live + branch work except `page.about.json`. One `--only` push fixes the theme; one git catch-up commit adopts the theme-side-newer files; then verify by re-pull diff and prune old themes. Design: `docs/plans/2026-09-16-theme-consolidation-design.md`.

**Tech Stack:** Shopify CLI (`shopify theme push/pull/list/delete`), git. Repo root: `C:\Users\Mark\.claude\projects\Love to Sing\Love to Sing Website`. Theme dir: `shopify-theme/`. Pulled snapshots (already on disk from the 2026-09-16 review): `tmp/theme-live-315` (live v3.1.5) and `tmp/theme-dev-320` (dev v3.2.0).

---

## HARD CONSTRAINTS — read before every task

1. **NEVER publish a theme and NEVER push to the live theme (v3.1.5, id `185465241873`) — Mark's explicit permission is required for anything touching live.** Every push in this plan targets dev v3.2.0 (`185067962641`) only.
2. **Never run a bare/full-directory `shopify theme push`.** Only `--only <file>` pushes. Full pushes delete remote-only state and the CLI strips `visible_if` blocks from `header-group.json` (would destroy the editor-configured mega-menu blocks).
3. **Theme deletions run last, only after the verification diff is clean**, and only the four listed IDs. Never delete `185049940241` (v3.1.3 fallback), `185465241873` (live), `185067962641` (dev).
4. Work on branch `feat/mega-menu-rebuild`. Do not touch `main`.
5. Every command that talks to Shopify includes `--store christmas-songs-carols.myshopify.com`.

---

### Task 1: Confirm theme roles (safety gate)

**Files:** none

**Step 1: List themes and confirm roles**

Run (PowerShell):
```powershell
shopify theme list --store christmas-songs-carols.myshopify.com
```

Expected: `Love to Sing Website v3.1.5 (photo wall fix)` is `[live]` with id `#185465241873`, and `Love to Sing Website v3.2.0` is `[unpublished]` with id `#185067962641`. **If roles or ids differ, STOP and report to Mark — do not proceed.**

**Step 2: Confirm git branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `feat/mega-menu-rebuild`

---

### Task 2: Adopt reconciled files into the working tree

The theme editor's versions are newer than git for these files; live's copy wins for `page.about.json`.

**Files:**
- Modify (copy from `tmp/theme-dev-320/`): `shopify-theme/snippets/single-multi-login.liquid`, `shopify-theme/templates/page.single.livestream-v2.liquid`, `shopify-theme/templates/metaobject/team.json`, `shopify-theme/templates/metaobject/team.linda.json`, `shopify-theme/templates/metaobject/team.mark.json`, `shopify-theme/templates/metaobject/team.tessa.json`, `shopify-theme/sections/header-group.json`, `shopify-theme/config/settings_data.json`, `shopify-theme/templates/page.buy-a-licence.json`, `shopify-theme/templates/product.song_christmas.json`, `shopify-theme/templates/product.song_halloween.json`
- Modify (copy from `tmp/theme-live-315/`): `shopify-theme/templates/page.about.json`

**Step 1: Copy the eleven dev-theme files over the git copies**

Run (PowerShell, from repo root):
```powershell
$files = @(
  'snippets/single-multi-login.liquid',
  'templates/page.single.livestream-v2.liquid',
  'templates/metaobject/team.json',
  'templates/metaobject/team.linda.json',
  'templates/metaobject/team.mark.json',
  'templates/metaobject/team.tessa.json',
  'sections/header-group.json',
  'config/settings_data.json',
  'templates/page.buy-a-licence.json',
  'templates/product.song_christmas.json',
  'templates/product.song_halloween.json'
)
foreach ($f in $files) { Copy-Item "tmp/theme-dev-320/$f" "shopify-theme/$f" -Force }
```

**Step 2: Copy live's About template over the git copy**

```powershell
Copy-Item "tmp/theme-live-315/templates/page.about.json" "shopify-theme/templates/page.about.json" -Force
```

**Step 3: Verify the working tree now matches the dev snapshot except page.about + non-theme extras**

Run via the Bash tool (from repo root):
```bash
git diff --no-index --name-status shopify-theme tmp/theme-dev-320 | grep -vE 'shopify-theme/(apps|docs|scripts)/|shopify-theme/\.gitignore|shopify\.theme\.toml'
```

Expected output — exactly one line:
```
M	shopify-theme/templates/page.about.json
```
(the dev snapshot still has the old About copy; everything else identical). Any other `M`/`A`/`D` theme file here means a copy was missed — fix before continuing.

---

### Task 3: Push live's About template to dev v3.2.0

**Files:** pushes `shopify-theme/templates/page.about.json` (already live's copy after Task 2) to theme `185067962641`.

**Step 1: Push the single file to the DEV theme**

Run (PowerShell, from repo root):
```powershell
shopify theme push --only templates/page.about.json --theme 185067962641 --path shopify-theme --store christmas-songs-carols.myshopify.com
```

Expected: success message listing 1 file updated, targeting theme **185067962641** (double-check the id echoed by the CLI is NOT 185465241873).

---

### Task 4: Commit the git catch-up sync

**Files:** the twelve files from Task 2.

**Step 1: Review what's staged is only the expected twelve**

Run: `git status -s -- shopify-theme`
Expected: exactly the 12 modified files from Task 2 (`M` lines), nothing else under `shopify-theme/`.

**Step 2: Commit and push**

```powershell
git add shopify-theme/snippets/single-multi-login.liquid shopify-theme/templates/page.single.livestream-v2.liquid shopify-theme/templates/metaobject shopify-theme/sections/header-group.json shopify-theme/config/settings_data.json shopify-theme/templates/page.buy-a-licence.json shopify-theme/templates/product.song_christmas.json shopify-theme/templates/product.song_halloween.json shopify-theme/templates/page.about.json
git commit -m @'
chore(theme): sync git to dev theme v3.2.0 state

Adopt theme-editor-newer versions (login snippet, livestream template,
team metaobject templates, header-group menu blocks, settings_data,
buy-a-licence + song product templates) and live v3.1.5''s About copy.
Git now matches dev theme 185067962641 exactly.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
git push
```

Expected: commit created on `feat/mega-menu-rebuild`, pushed to origin.

---

### Task 5: Update CLAUDE.md theme table

**Files:**
- Modify: `CLAUDE.md` (project root) — section "1. Shopify themes"

**Step 1: Edit the roles table**

Replace the current table rows so they read:

```markdown
| Role | Theme | ID |
|------|-------|----|
| **DEV / working** (push here) | **Love to Sing Website v3.2.0** `[unpublished]` | **`185067962641`** |
| **LIVE** (never push here) | Love to Sing Website v3.1.5 (photo wall fix) `[live]` | `185465241873` |
```

And append a dated bullet to the notes under the table:

```markdown
- 2026-09-16: v3.1.5 (photo wall fix) is live — the photo-wall fixes were applied to the 3.1.x line and published; they are also on v3.2.0 and in git. v3.1.3 is kept as the pre-photo-fix fallback; v3.1.0/v3.1.1/v3.1.2/v3.1.4 were deleted. Consolidation details: `docs/plans/2026-09-16-theme-consolidation-design.md`.
```

**Step 2: Commit and push**

```powershell
git add CLAUDE.md
git commit -m @'
docs: CLAUDE.md theme table — v3.1.5 live, v3.2.0 dev

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
git push
```

---

### Task 6: Verify — re-pull v3.2.0 and diff against git

**Files:** creates `tmp/theme-dev-320-verify/` (throwaway).

**Step 1: Pull the dev theme fresh**

```powershell
New-Item -ItemType Directory -Force tmp\theme-dev-320-verify | Out-Null
shopify theme pull --theme 185067962641 --path tmp\theme-dev-320-verify --store christmas-songs-carols.myshopify.com --force
```

**Step 2: Diff against the working tree**

Run via the Bash tool:
```bash
git diff --no-index --name-status shopify-theme tmp/theme-dev-320-verify | grep -vE 'shopify-theme/(apps|docs|scripts)/|shopify-theme/\.gitignore|shopify\.theme\.toml'
```

Expected: **no output** (zero theme-file differences). If any file differs, STOP, inspect the content diff, and reconcile before pruning. (One known benign possibility: Shopify re-adding the auto-generated `/* ... */` header comment to JSON templates — if that's the only difference, adopt the pulled version into git with a follow-up commit.)

**Step 3: Spot-check in the browser**

Open the dev preview: `https://christmas-songs-carols.myshopify.com/?preview_theme_id=185067962641`
Check: (a) About page shows live's copy — intro mentions "five YouTube channels", testimonials include Henry (95-year-old fan) and Ana Talakai; (b) photo wall page loads with filters + music player; (c) mega menu + search overlay still work. Report screenshots/findings to Mark.

---

### Task 7: Prune the four superseded themes

**Only after Task 6 is fully clean.** Deletion is irreversible.

**Step 1: Re-list themes and re-confirm ids**

```powershell
shopify theme list --store christmas-songs-carols.myshopify.com
```

Confirm the four targets are still `[unpublished]` and named as expected:
- v3.1.0 → `185013862673`
- v3.1.1 → `185014518033`
- v3.1.2 → `185032147217`
- v3.1.4 (photo fix) → `185463177489`

**Step 2: Delete each (one at a time, checking output)**

```powershell
shopify theme delete --theme 185013862673 --force --store christmas-songs-carols.myshopify.com
shopify theme delete --theme 185014518033 --force --store christmas-songs-carols.myshopify.com
shopify theme delete --theme 185032147217 --force --store christmas-songs-carols.myshopify.com
shopify theme delete --theme 185463177489 --force --store christmas-songs-carols.myshopify.com
```

**Step 3: Confirm final state**

```powershell
shopify theme list --store christmas-songs-carols.myshopify.com
```

Expected remaining: Version 9.9, Backup of [Dev] Songs ×2, Blog Rebuild v7 ×2, Santa Tracker Preview v1, v3.1.3, v3.1.5 `[live]`, v3.2.0 `[unpublished]` — nine themes.

---

### Task 8: Wrap up

**Step 1: Clean the throwaway verify folder**

```powershell
Remove-Item -Recurse -Force tmp\theme-dev-320-verify -Confirm:$false
```
(Keep `tmp/theme-live-315` and `tmp/theme-dev-320` for reference until the branch merges, or delete them too if Mark prefers.)

**Step 2: Report to Mark**

Summarize: v3.2.0 is the clean consolidated base, git matches it, CLAUDE.md updated, four themes pruned. Remind: PR into `main` happens only when v3.2.0 is approved to publish — **publishing requires Mark's explicit go-ahead**.
