# Love to Sing Website — working instructions

Shopify theme repo for **lovetosing.com** (store `christmas-songs-carols.myshopify.com`).
Theme lives in `shopify-theme/`. GitHub: <https://github.com/mark-bakerrr/Love-to-Sing-Website>

---

## 1. Shopify themes — confirm roles EVERY time

| Role | Theme | ID |
|------|-------|----|
| **DEV / working** (push here) | **Love to Sing Website v3.1.3** `[unpublished]` | **`185049940241`** |
| **LIVE** (never push here) | Love to Sing Website v3.1.2 `[live]` | `185032147217` |

- Theme roles change over time. **ALWAYS run `shopify theme list` and confirm `[live]` vs `[unpublished]` before ANY push. Never assume a theme id.**
- All development and testing pushes go to the current **unpublished** dev theme (currently v3.1.3).
- **Theme-editor settings gotcha:** section settings (logo, message, background video, playlist tracks) are saved per-theme in `config/settings_data.json`. Configure them on the **current dev theme, then publish** — edits made on an old/stale theme-editor tab save to that unpublished theme and never reach the live site. (2026-08-19: Halloween video was set on an unpublished v3.1.0 tab; had to transplant it onto the dev theme before publishing.)

---

## 2. GitHub is the source of truth — keep it up to date ALWAYS

- **Never commit directly to `main`.** Work on a branch.
- **Every change goes through a Pull Request** into `main`. Open a PR for review before merging.
- **On every Shopify upload, also commit and push to GitHub in the same session** — the remote must always match what's deployed. Never `shopify theme push` without a matching `git push`.
- Commit early and often; push to remote frequently. GitHub should always be as up to date as possible.
- After merge, keep `main` in sync with the live theme.

**Typical loop:** branch → edit → `shopify theme push --only <file>` to the dev theme → `git add` + `git commit` + `git push` → open PR → merge.

---

## 3. Safe deploy workflow (learned the hard way — 2026-08-13)

The git `shopify-theme/` tree can drift from the live/dev theme. A full-directory `shopify theme push` **overwrites the remote and DELETES remote-only files** — this once wiped ~a month of work (licence builder, membership, santa-tracker, new cart) that existed only on the theme.

- **To change a file:** pull the dev theme fresh → edit → `shopify theme push --only <path> --theme <dev id>`.
- **Never** run a bare / full-directory `shopify theme push` from a stale working tree.
- `shopify theme push` removes remote files not present locally — treat every push as potentially destructive; verify local ≈ remote first.
- **Before overwriting or deleting anything, confirm it isn't the only copy.** Check `git status` (uncommitted) and `@{u}..` (unpushed) before deleting any local clone.
