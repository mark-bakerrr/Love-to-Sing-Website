# Love to Sing AI Content Studio - Product + Technical Spec

## Goal
Build a paid AI chat experience in Shopify for teachers/parents/students to generate Love to Sing-focused learning resources:
- Lesson plans
- Colouring sheets
- Activity plans
- Music learning guides

Outputs:
- DOCX
- PDF

## Hard Requirements (confirmed)
1. Gemini Flash-first model strategy (cost-efficient)
2. Daily abuse limit: 3 chats per user/day
3. No document generation unless user is paid/member
4. Logged-in users can view files and re-download each file up to 3 times
5. All files must be Love to Sing branded
6. All generated content remains copyright Love to Sing
7. Reproduction/distribution restricted by Terms of Service

## UX Flow
1. User lands on AI page in Shopify theme
2. User logs in (Shopify customer account)
3. Chat UI displays quota remaining (e.g., 2/3 chats left today)
4. User chats and previews generated content
5. To export DOCX/PDF: entitlement check
   - member/paid -> allowed
   - not paid -> prompt to purchase membership/credits
6. Generated files appear in My Files
7. Re-download allowed max 3 per file via signed URLs

## Architecture

### Frontend (Shopify Theme)
- New page template: `page.ai-content-studio.json`
- Embedded chat app block (JS app served by backend)
- Components:
  - Chat panel
  - Content type selector
  - Preview panel
  - Quota status
  - Export buttons (DOCX/PDF)
  - My Files table

### Backend (Node/TypeScript)
- Auth/session bridge with Shopify customer identity
- APIs:
  - `POST /chat`
  - `POST /generate`
  - `GET /files`
  - `POST /files/:id/download`
- Services:
  - Entitlement service (membership/credit check)
  - Quota service (3/day)
  - LLM orchestration (Gemini Flash primary)
  - RAG retrieval over Love to Sing songs
  - Document renderer (DOCX/PDF)
  - File storage + signed URLs

### Data Model
- `users` (shopify_customer_id, email, plan)
- `chat_usage_daily` (user_id, date_nz, count)
- `generations` (user_id, prompt, content_type, output_json, status)
- `files` (generation_id, format, storage_key, download_count, max_downloads=3)
- `entitlements` (user_id, product_id/plan, active_until)
- `terms_acceptance` (user_id, version, accepted_at)

## Entitlement Rules
- `canChat`: user logged in AND daily chats < 3
- `canGenerate`: user logged in AND entitlement active
- `canDownload`: user owns file AND download_count < 3

## Branding + Legal Injection
Each generated DOCX/PDF must include:
- Love to Sing logo and footer styling
- Footer text:
  - "© Love to Sing. All rights reserved."
  - "Generated content remains copyright Love to Sing."
  - "Reproduction/distribution outside license terms is prohibited."
- User watermark for previews where practical

## Security + Abuse Controls
- Rate limiting by user and IP
- Signed URLs (short TTL) for downloads
- Download action always mediated by backend entitlement check
- Prompt/content moderation on unsafe requests
- Audit logging of generations + downloads

## Cost Estimation (Gemini Flash-first)

Assumptions:
- 10,000 chats/month
- Average 6,000 input tokens + 1,500 output tokens
- 90% handled by Flash, 10% escalated to stronger model

Estimated monthly:
- Model spend (Flash-first): ~USD $40-$140
- Infra/storage/doc rendering: ~USD $60-$180
- Total: ~USD $100-$320/month

At 50,000 chats/month:
- Total likely ~USD $400-$1,200/month depending on escalation rate and file volume

## Rollout Plan

### Phase 1 - MVP (1-2 weeks)
- Shopify AI page shell + login gate
- 3/day quota enforcement
- Paid/member gate before generation
- DOCX/PDF generation
- My Files + 3 re-download cap
- Branding + legal footer

### Phase 2 - Quality + Scale
- Better retrieval from all-songs catalog
- Prompt templates by age/curriculum
- Admin analytics dashboard
- Better preview anti-abuse controls

### Phase 3 - Growth
- Credit packs + subscriptions
- Team/school accounts
- Personalized saved teaching packs

## Acceptance Criteria
- Non-member cannot generate DOCX/PDF
- Member can generate DOCX and PDF successfully
- User chat count hard-limited to 3/day
- User can re-download same file only 3 times
- All files include Love to Sing branding + legal text
- My Files lists historical files for logged-in user
