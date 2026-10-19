---
date: 2026-10-19
topic: licence-builder-song-picker
---

# Licence Builder: Add Songs & Videos Step

## What We're Building
An optional **step 5 "Add songs & videos"** on `/pages/licence-builder` (`sections/lts-licence-builder.liquid`). After choosing licence, org type, size and org name, the customer can search for and pick song, video and album products. The summary card lists the picked items with a combined total, and a single **Add to cart** puts the licence and all picked items in the cart together, then opens the cart drawer as it does today.

This is a **convenience cross-sell**. The licence stays catalogue-agnostic ("covers all your purchases"), and picked items are ordinary product line items with no link to the licence and no bundle pricing.

## Why This Approach
Approaches considered:
- **A. Theme-only (chosen):** Shopify predictive search plus popular picks set in the theme editor. Everything lives in the one section file and doesn't depend on Vercel.
- **B. Content Studio search API:** knows `downloadsEnabled` and version groupings, but the storefront page would depend on Vercel (firewall incidents have happened before) and it needs a new public `/api/store/*` route.

A won. Excluding gated cover songs needs only a filter rule, and keeping the page independent of Vercel matters more.

## Key Decisions
- **Purpose: cross-sell only.** No line-item properties tying songs to the licence and no certificate changes.
- **Picker: search plus popular picks.** A predictive search box (`/search/suggest.json`), plus a short row of suggested products that changes with the selected org type (church / school / community), curated via theme-editor product-list settings.
- **Versions: separate products with an All / Songs / Videos filter.** No song→video grouping. Video products are identified by title ("Video Song Download") or tag, since most products have no product type.
- **Membership: still show the step.** Even though membership includes the whole catalogue, the step stays visible, e.g. for albums.
- **Placement: optional step 5.** A licence on its own still adds to cart. Picked items appear in the summary card with a running total.
- **One cart call:** `/cart/add.js` with an `items[]` array (licence with its existing 5 properties, plus each picked product at quantity 1).

## Open Questions
- **Cover-song gating:** how do we exclude products whose downloads are disabled (`downloadsEnabled=false`, buy button hidden) from search results and picks? Do they stay `available` in Shopify, or do they carry a tag or metafield we can filter on?
- Should albums appear in search results, or only songs and videos?
- Popular picks: one list per org type (3 settings), or a single list?
- Membership copy: add a hint like "Your membership already lets you download everything", so members don't buy what they already have?
- Mobile layout: the summary card stacks below the panel under 860px. Where does the picked-items list go so the total stays visible?
- Lyrics products ($6.99): in scope or not?

## Next Steps
→ `/workflows:plan` for implementation details
