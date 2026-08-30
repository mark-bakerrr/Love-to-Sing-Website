# Love to Sing — Livestream Overlays (Vercel)

Embeddable replicas of the lovetosing.com countdown/tracker pages, for use as
**upstream.so webpage embeds**. Shopify serves every Online Store page with
`X-Frame-Options: DENY` + `frame-ancestors 'none'` (not removable), so the live
pages can't be iframed — these static copies can.

| Page | Replica of |
|------|-----------|
| `/christmas-countdown` | lovetosing.com/pages/christmas-countdown |
| `/halloween-countdown` | lovetosing.com/pages/halloween-countdown |
| `/santa-tracker` | lovetosing.com/pages/santa-tracker |

- `?overlay=1` on the countdowns hides the music player (broadcast mode); `?now=<ISO>` fakes the clock for QA.
- `vercel.json` sets `Content-Security-Policy: frame-ancestors *` so any host (upstream.so) may embed.

## Structure

- `assets/` — CSS/JS/JSON mirrored from the **live** theme (t/106 = v3.1.3) at build time. Committed.
- `media/` — videos, images, audio, GLB models (~185 MB). **Gitignored**; run `./fetch-media.ps1` to download from the Shopify CDN before deploying.
- Page settings (logo, backgrounds, playlist, timezone, messages) are **baked in** from the live pages' rendered config — they do not follow theme-editor changes. If you change the Shopify countdown settings, update the matching `index.html` here and redeploy.

## Deploy

```powershell
./fetch-media.ps1        # once, to populate media/
vercel deploy --prod     # project: lts-livestream-overlays
```

## Halloween note

The live Halloween page has a background video set, which (per the section's
logic) suppresses the mist/crows/pumpkins FX overlays — so those FX files are
not mirrored here. If the video is ever removed on Shopify, port the FX videos
too (`halloween-mist.mp4`, `halloween-crows.webm`, `halloween-pumpkins.webm`).
