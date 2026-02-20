# AI Content Studio API Contract (MVP)

Base URL (theme setting): `/apps/lts-ai`

Local API scaffold implementation lives at:
- `shopify-theme/apps/ai-content-studio-api`

Run locally:
```bash
cd shopify-theme/apps/ai-content-studio-api
npm install
npm run dev
```

## POST /chat
Request:
```json
{
  "prompt": "Create a 30-minute lesson plan using two beginner songs",
  "contentType": "lesson_plan"
}
```

Response:
```json
{
  "generationId": "gen_123",
  "message": "Draft lesson plan created...",
  "previewText": "..."
}
```

Rules:
- Requires logged-in Shopify customer
- Enforce daily cap: 3 chats/day

Auth modes:
- Production: Shopify App Proxy signature + `logged_in_customer_id`
- Dev fallback headers:
  - `x-shopify-customer-id: <id>`
  - `x-lts-entitled: true|false`

Entitlement modes:
- Production: customer tag check through Shopify Admin API (`REQUIRED_MEMBER_TAG`)
- Dev fallback: `x-lts-entitled: true`

## POST /generate
Request:
```json
{
  "generationId": "gen_123",
  "format": "docx"
}
```

Response:
```json
{
  "fileId": "file_123",
  "fileName": "lesson-plan-year-1.docx"
}
```

Rules:
- Requires active paid entitlement
- Supports `docx` and `pdf`
- Generated file gets `download_count = 0`, `max_downloads = 3`

## GET /files
Response:
```json
{
  "files": [
    {
      "id": "file_123",
      "name": "lesson-plan-year-1.docx",
      "format": "docx",
      "downloadCount": 1,
      "maxDownloads": 3,
      "createdAt": "2026-02-20T20:00:00Z"
    }
  ]
}
```

## POST /files/:id/download
Response:
```json
{
  "url": "https://signed-download-url"
}
```

Rules:
- Owner-only
- Block when `downloadCount >= maxDownloads`
- Increment count atomically per successful signed URL issuance
