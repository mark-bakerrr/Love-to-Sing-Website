import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const DAILY_LIMIT = Number(process.env.DAILY_CHAT_LIMIT || 3);
const PORT = Number(process.env.PORT || 8787);
const SIGNING_SECRET = process.env.SIGNING_SECRET || 'replace-me';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SHOPIFY_APP_PROXY_SECRET = process.env.SHOPIFY_APP_PROXY_SECRET || '';
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const REQUIRED_MEMBER_TAG = process.env.REQUIRED_MEMBER_TAG || 'ai_member';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'store.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  usageByUserDate: {},
  generations: {},
  files: {},
  termsAcceptance: {}
};
if (fs.existsSync(DATA_PATH)) {
  try { Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch {}
}
function persistDb() { fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8'); }

function nowIso() { return new Date().toISOString(); }
function getDateKey() { return new Date().toISOString().slice(0, 10); }
function nextId(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

function verifyAppProxySignature(query) {
  if (!SHOPIFY_APP_PROXY_SECRET || !query.signature) return false;
  const pairs = Object.keys(query)
    .filter((k) => k !== 'signature')
    .sort()
    .map((k) => `${k}=${Array.isArray(query[k]) ? query[k].join(',') : query[k]}`)
    .join('');
  const digest = crypto.createHmac('sha256', SHOPIFY_APP_PROXY_SECRET).update(pairs).digest('hex');
  return digest === query.signature;
}

function getUserId(req) {
  const headerId = req.header('x-shopify-customer-id') || req.query.customerId || req.body?.customerId;
  const appProxyId = req.query.logged_in_customer_id;

  if (appProxyId && verifyAppProxySignature(req.query)) {
    return String(appProxyId);
  }
  return headerId ? String(headerId) : null;
}

async function isEntitled(req, userId) {
  const headerEntitled = req.header('x-lts-entitled') === 'true';
  if (headerEntitled) return true;

  if (!SHOPIFY_ADMIN_TOKEN || !SHOPIFY_STORE_DOMAIN || !userId) return false;

  const query = `#graphql
    query getCustomer($id: ID!) {
      customer(id: $id) {
        id
        tags
      }
    }
  `;

  const gid = `gid://shopify/Customer/${userId}`;
  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN
    },
    body: JSON.stringify({ query, variables: { id: gid } })
  });
  if (!response.ok) return false;

  const data = await response.json();
  const tags = data?.data?.customer?.tags || [];
  return tags.includes(REQUIRED_MEMBER_TAG);
}

function generateDownloadToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyDownloadToken(token) {
  const [encoded, sig] = String(token || '').split('.');
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function generateWithGeminiFlash(prompt, contentType) {
  if (!GEMINI_API_KEY) {
    return { text: `Draft ${contentType.replace('_', ' ')} based on Love to Sing songs:\n\n${prompt}\n\n(Placeholder response, GEMINI_API_KEY not configured)` };
  }

  const instruction = 'Generate classroom-safe educational content only related to Love to Sing music catalog. Use practical structure and include suggested songs.';
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${instruction}\n\nType: ${contentType}\nPrompt: ${prompt}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1400 }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Gemini failed (${response.status})`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || 'No content returned';
  return { text };
}

async function renderDocxBuffer(title, body) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Love to Sing', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: title, bold: true })] }),
        ...body.split('\n').map((line) => new Paragraph({ text: line || ' ' })),
        new Paragraph({ text: '© Love to Sing. All rights reserved.' }),
        new Paragraph({ text: 'Generated content remains copyright Love to Sing. Reproduction/distribution prohibited outside Terms of Service.' })
      ]
    }]
  });
  return Packer.toBuffer(doc);
}

function renderPdfBuffer(title, body) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50 });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(22).text('Love to Sing');
    doc.moveDown().fontSize(16).text(title);
    doc.moveDown().fontSize(11).text(body);
    doc.moveDown(2).fontSize(9).text('© Love to Sing. All rights reserved.');
    doc.text('Generated content remains copyright Love to Sing. Reproduction/distribution prohibited outside Terms of Service.');
    doc.end();
  });
}

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Love to Sing AI Preview</title>
  <style>body{font-family:Arial,sans-serif;max-width:760px;margin:30px auto;padding:0 12px}textarea{width:100%;height:120px}button{padding:10px 14px}pre{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}</style>
  </head><body>
    <h2>Love to Sing AI Preview</h2>
    <p>Quick preview endpoint. This uses guest preview mode and respects daily limits.</p>
    <textarea id="prompt" placeholder="Create a 20-minute classroom activity plan using two Love to Sing songs"></textarea><br/><br/>
    <button id="go">Generate Chat Preview</button>
    <pre id="out">Waiting...</pre>
    <script>
      document.getElementById('go').onclick = async () => {
        const prompt = document.getElementById('prompt').value.trim();
        if(!prompt) return;
        const res = await fetch('/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({customerId:'guest-preview', prompt, contentType:'lesson_plan'})});
        const data = await res.json();
        document.getElementById('out').textContent = JSON.stringify(data, null, 2);
      };
    </script>
  </body></html>`);
});

// Shopify App Proxy intercepts non-2xx responses and renders storefront HTML
// instead of forwarding the JSON body. All API routes must return HTTP 200
// with a { statusCode, error } payload so the frontend can handle errors.
function proxyJson(res, statusCode, body) {
  res.status(200).json({ ...body, statusCode });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/terms/accept', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return proxyJson(res, 401, { error: 'Unauthorized' });
  db.termsAcceptance[userId] = { acceptedAt: nowIso(), version: req.body?.version || 'v1' };
  persistDb();
  proxyJson(res, 200, { ok: true });
});

app.post('/chat', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return proxyJson(res, 401, { error: 'Unauthorized' });

  const { prompt, contentType = 'lesson_plan' } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return proxyJson(res, 400, { error: 'prompt is required' });

  const usageKey = `${userId}:${getDateKey()}`;
  const used = db.usageByUserDate[usageKey] || 0;
  if (used >= DAILY_LIMIT) return proxyJson(res, 429, { error: 'Daily chat limit reached', dailyLimit: DAILY_LIMIT });

  let ai;
  try { ai = await generateWithGeminiFlash(prompt, contentType); }
  catch (err) { return proxyJson(res, 502, { error: 'Model generation failed', detail: String(err.message || err) }); }

  db.usageByUserDate[usageKey] = used + 1;
  const generationId = nextId('gen');
  db.generations[generationId] = { id: generationId, userId, prompt, contentType, previewText: ai.text, createdAt: nowIso() };
  persistDb();

  proxyJson(res, 200, { generationId, message: 'Preview generated', previewText: ai.text, remainingChats: Math.max(DAILY_LIMIT - (used + 1), 0) });
});

app.post('/generate', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return proxyJson(res, 401, { error: 'Unauthorized' });

  const entitled = await isEntitled(req, userId);
  if (!entitled) return proxyJson(res, 402, { error: 'Membership required' });

  const { generationId, format } = req.body || {};
  if (!generationId || !format || !['docx', 'pdf'].includes(format)) return proxyJson(res, 400, { error: 'generationId and format(docx|pdf) are required' });

  const generation = db.generations[generationId];
  if (!generation || generation.userId !== userId) return proxyJson(res, 404, { error: 'Generation not found' });

  const fileId = nextId('file');
  const fileName = `${generation.contentType}-${new Date().toISOString().slice(0, 10)}.${format}`;

  let contentBase64;
  if (format === 'docx') {
    const buffer = await renderDocxBuffer('AI Resource', generation.previewText);
    contentBase64 = buffer.toString('base64');
  } else {
    const buffer = await renderPdfBuffer('AI Resource', generation.previewText);
    contentBase64 = buffer.toString('base64');
  }

  db.files[fileId] = {
    id: fileId, userId, generationId, format, name: fileName,
    contentBase64, downloadCount: 0, maxDownloads: 3, createdAt: nowIso()
  };
  persistDb();

  proxyJson(res, 200, { fileId, fileName });
});

app.get('/files', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return proxyJson(res, 401, { error: 'Unauthorized' });

  const userFiles = Object.values(db.files)
    .filter((f) => f.userId === userId)
    .map((f) => ({ ...f, contentBase64: undefined }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  proxyJson(res, 200, { files: userFiles });
});

app.post('/files/:id/download', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return proxyJson(res, 401, { error: 'Unauthorized' });

  const file = db.files[req.params.id];
  if (!file || file.userId !== userId) return proxyJson(res, 404, { error: 'File not found' });
  if (file.downloadCount >= file.maxDownloads) return proxyJson(res, 403, { error: 'Download limit reached' });

  file.downloadCount += 1;
  persistDb();

  const token = generateDownloadToken({ fileId: file.id, userId, exp: Date.now() + 1000 * 60 * 10 });
  proxyJson(res, 200, {
    url: `/files/${file.id}/stream?token=${token}`,
    downloadCount: file.downloadCount,
    remainingDownloads: Math.max(file.maxDownloads - file.downloadCount, 0)
  });
});

app.get('/files/:id/stream', (req, res) => {
  const payload = verifyDownloadToken(req.query.token);
  if (!payload || payload.fileId !== req.params.id) return res.status(401).send('Invalid token');

  const file = db.files[req.params.id];
  if (!file || file.userId !== payload.userId) return res.status(404).send('File not found');

  const mime = file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const buffer = Buffer.from(file.contentBase64, 'base64');

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.send(buffer);
});

app.listen(PORT, () => console.log(`AI Content Studio API listening on :${PORT}`));
