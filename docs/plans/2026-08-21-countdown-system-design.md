# Seasonal Countdown System — design & build

_Date: 2026-08-21 · Branch: `feat/christmas-countdown` · Dev theme: Love to Sing Website v3.2.0 (`185067962641`)_

## Goal

A reusable, themeable countdown system for lovetosing.com — Halloween & Christmas first, but built as a **generic engine** so any future countdown (campaigns, launches) is just a new instance. Two surfaces:

1. **Countdown block** (a section) merchants drop onto templates and pick a design from a dropdown.
2. **Global floating widget** — one site-wide bottom-right overlay, driven by the active season, click-through to the countdown pages.

## Key decisions

- **One reusable thing with a design dropdown**, not N separate blocks — the engine (ticking, timezone, auto-hide) lives in one place. Delivered THREE ways, all sharing `snippets/countdown-card.liquid` + `assets/lts-countdown.{css,js}`: (1) an inline **block** inside the Main Song Product section (`main-song` has a local `countdown` block type, rendered under "Share this song"); (2) a standalone full-width **section** (`sections/countdown.liquid`) for other pages; (3) the global overlay **widget**. `main-song` is custom-coded (renders its blocks via filtered loops), so the block is a local block type there rather than a portable `@theme` block.
- **Auto + manual override** for season selection; **auto-hide at 00:00:00** once a countdown passes its target (per Mark).
- **Separate skin sets**: elaborate section skins vs one compact widget skin per season.
- Art via **Higgsfield** (children's-storybook style, transparent PNGs), background-removed.
- **Shared engine** with a data-attribute contract; timezone-correct via `Intl.DateTimeFormat` so every visitor sees identical numbers. `?now=<ISO>` QA override.
- **GSAP** (already bundled in theme) for idle + hover flourishes + number-pop; all guarded by `prefers-reduced-motion`.
- **Creepster** Google Font for Halloween skins.

## Shipping skins (6)

| design value | season | class | fx | art |
|---|---|---|---|---|
| `xmas-advent` | Christmas | s-advent | advent | — (CSS + falling snow) |
| `xmas-globe` (default) | Christmas | s-globe | globe | lts-cd-xmas-snowglobe.png |
| `xmas-sleigh` | Christmas | s-sleigh | sleigh | lts-cd-xmas-sleigh.png (Santa in sleigh) |
| `hall-jack` | Halloween | s-jack | pumpkin | lts-cd-hall-pumpkin.png (behind numbers, scary hover) |
| `hall-neon` | Halloween | s-neon | neon | — (CSS, Creepster) |
| `hall-cauldron` | Halloween | s-cauldron | cauldron | lts-cd-hall-cauldron.png |

_Cut during review: Fireplace Stockings, Starry Minimal, Tombstone, Haunted Minimal._

## Engine data-contract

`[data-countdown]` with: `data-target-month`, `data-target-day`, `data-tz` (IANA), `data-end` (`hide`|`message`|`message-then-hide`), `data-grace-days`, `data-recurring`, optional `data-widget`. Inner `[data-unit="days|hours|minutes|seconds"]` and `[data-countdown-message]`.

## Files

**New**
- `assets/lts-countdown.css` — 6 skins + widget, scoped under `.lts-cd` / `.lts-cdw`.
- `assets/lts-countdown.js` — engine (Intl tz, recurring, end modes, `?now=`) + GSAP layer (no-ops without gsap / reduced-motion).
- `assets/lts-cd-{xmas-snowglobe,xmas-sleigh,hall-pumpkin,hall-cauldron}.png`
- `sections/countdown.liquid` — the block (design dropdown, target date + editor `info`, timezone, end behaviour, CTA, transparent-bg, presets).
- `snippets/countdown-season.liquid` — server-side active-season resolver (auto windows: Halloween Sep 15–Oct 31, Christmas Nov 1–Dec 25).
- `snippets/countdown-widget.liquid` — global floating widget (stretched-link nav, per-season localStorage dismiss).

**Edited**
- `layout/theme.liquid` — `{% render 'countdown-widget' %}` before `</body>`.
- `config/settings_schema.json` — "Countdown widget" group (`countdown_widget_mode`, `countdown_widget_tz`, per-season link/month/day).
- `templates/product.song_christmas.json` / `product.song_halloween.json` — pre-placed `countdown` section after `main`.

## Deploy notes

- Built on dev theme v3.2.0; live theme is v3.1.3 — never pushed there.
- Every push was targeted `--only`; existing files were pulled fresh and drift-checked (only CRLF/LF differences) before pushing, per the safe-deploy rule.
- Widget is date-gated: in Auto mode outside the seasonal windows it renders nothing. To preview off-season, set Theme settings → Countdown widget → Active season.

## Follow-ups / not done

- Refactor the two existing full-page countdown sections (`christmas-countdown.liquid`, `halloween-countdown.liquid`) onto the shared engine — deferred.
- Set the widget's countdown-page links + confirm page handles in theme settings.
- Optional: a 5th Halloween / balance to 5 per season later.
