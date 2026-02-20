# AI Content Studio API

## Run locally
```bash
cd shopify-theme/apps/ai-content-studio-api
npm install
npm run dev
```

## Environment
See `.env.example`.

Required for production:
- `SIGNING_SECRET`
- `SHOPIFY_APP_PROXY_SECRET`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_TOKEN`
- `REQUIRED_MEMBER_TAG` (default: `ai_member`)
- `GEMINI_API_KEY`

## Notes
- Daily chat limit enforced server-side (default 3/day).
- Document generation requires entitlement (Shopify customer tag check).
- Downloads are capped at 3 per file.
- Download links are signed and short-lived.
