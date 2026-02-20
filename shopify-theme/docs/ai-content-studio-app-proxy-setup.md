# Shopify App Proxy Setup (`/apps/lts-ai`)

## Goal
Route Shopify storefront requests from:
- `/apps/lts-ai/*`

to your API service:
- `https://<your-api-domain>/*`

## 1) Deploy API service
Suggested: Render using `shopify-theme/apps/ai-content-studio-api`.

Set env vars:
- `PORT=8787`
- `DAILY_CHAT_LIMIT=3`
- `SIGNING_SECRET=<random-strong-string>`
- `SHOPIFY_APP_PROXY_SECRET=<from Shopify app>`
- `SHOPIFY_STORE_DOMAIN=christmas-songs-carols.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN=<admin token>`
- `REQUIRED_MEMBER_TAG=ai_member`
- `GEMINI_API_KEY=<google ai studio key>`

## 2) Configure Shopify app proxy
In Shopify Partner app settings:
- App proxy prefix: `apps`
- Subpath: `lts-ai`
- Proxy URL: `https://<your-api-domain>`

This gives routes like:
- `https://christmas-songs-carols.myshopify.com/apps/lts-ai/chat`

## 3) Verify signature and customer identity
API uses:
- `signature`
- `logged_in_customer_id`

`/chat` and file routes require authenticated customer identity.

## 4) Theme settings
In `AI Content Studio` section settings:
- `Backend API base URL` = `/apps/lts-ai`
- `Required customer tag` = `ai_member`

## 5) Acceptance test
1. Logged out user sees login gate
2. Logged in non-member can preview chat but cannot generate files
3. Member can generate DOCX/PDF
4. Same file can be downloaded max 3 times
5. 4th download attempt is blocked
6. User cannot exceed 3 chats/day
