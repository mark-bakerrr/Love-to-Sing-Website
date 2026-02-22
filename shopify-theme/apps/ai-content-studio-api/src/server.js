import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, AlignmentType, BorderStyle, PageBreak } from 'docx';

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
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '';

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
  // TODO: Re-enable customer tag check for production
  // For now, allow all authenticated users to download for testing
  return true;

  /*
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
  */
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

  let instruction;
  if (contentType === 'colouring_sheet') {
    instruction = `You are creating a colouring activity guide for teachers and parents using Love to Sing songs.
Do NOT describe what the image should look like — the image is generated separately.
Instead, provide practical content:
- A title for the colouring activity
- Suggested Love to Sing songs to play while colouring
- Learning objectives (fine motor skills, colour recognition, creativity, etc.)
- Step-by-step activity instructions for the teacher/parent
- Discussion questions to ask children about the picture
- Extension activities (e.g. cut and paste, colour by number, group display)
Keep it practical, fun, and classroom-ready.`;
  } else {
    instruction = 'Generate classroom-safe educational content only related to Love to Sing music catalog. Use practical structure and include suggested songs.';
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${instruction}\n\nType: ${contentType}\nPrompt: ${prompt}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Gemini failed (${response.status})`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || 'No content returned';
  return { text };
}

async function generateColouringImage(prompt) {
  if (!GEMINI_API_KEY) return null;

  const imagePrompt = `Create a simple black and white colouring page for children. Line art only, no shading, no filled areas, thick clear outlines suitable for colouring in. The scene should be: ${prompt}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] }
  };

  console.log('Generating colouring image...');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`Image generation failed (${response.status}):`, errText.slice(0, 300));
    return null;
  }
  const data = await response.json();
  const imagePart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart) {
    console.error('No image in response. Parts:', JSON.stringify(data?.candidates?.[0]?.content?.parts?.map((p) => Object.keys(p))));
    return null;
  }
  console.log(`Image generated: ${imagePart.inlineData.data.length} bytes base64`);
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

// Parse markdown line into docx TextRuns with bold/italic support
function parseInlineFormatting(text) {
  const runs = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 22 }));
    }
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], bold: true, size: 22 }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], italics: true, size: 22 }));
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 22 }));
  }
  return runs.length ? runs : [new TextRun({ text, size: 22 })];
}

// Convert markdown text to an array of docx Paragraphs
function markdownToDocxParagraphs(md) {
  const paragraphs = [];
  for (const line of md.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }));
    } else if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 150 } }));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      paragraphs.push(new Paragraph({ children: parseInlineFormatting(trimmed.slice(2)), bullet: { level: 0 }, spacing: { after: 60 } }));
    } else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '');
      paragraphs.push(new Paragraph({ children: parseInlineFormatting(text), numbering: { reference: 'default-numbering', level: 0 }, spacing: { after: 60 } }));
    } else if (trimmed === '---' || trimmed === '***') {
      paragraphs.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, spacing: { before: 200, after: 200 } }));
    } else if (trimmed === '') {
      paragraphs.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    } else {
      paragraphs.push(new Paragraph({ children: parseInlineFormatting(trimmed), spacing: { after: 80 } }));
    }
  }
  return paragraphs;
}

async function renderDocxBuffer(title, body, imageBuffer) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'Love to Sing', bold: true, size: 36, color: '333333' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 28, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }),
  ];

  if (imageBuffer) {
    // Page break before image
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      children: [new ImageRun({ data: imageBuffer, transformation: { width: 550, height: 550 }, type: 'png' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 }
    }));
    // Page break after image so text starts on a new page
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  children.push(...markdownToDocxParagraphs(body));

  children.push(
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: '\u00A9 Love to Sing. All rights reserved.', size: 16, color: '999999', italics: true })],
      alignment: AlignmentType.CENTER
    })
  );

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }]
      }]
    },
    sections: [{ children }]
  });
  return Packer.toBuffer(doc);
}

// Render markdown text into a formatted PDF
function renderPdfBuffer(title, body, imageBuffer) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#333333').text('Love to Sing', { align: 'center' });
    doc.moveDown(0.3).fontSize(16).font('Helvetica-Bold').fillColor('#555555').text(title, { align: 'center' });
    doc.moveDown(0.8);

    // Colouring sheet image on its own page
    if (imageBuffer) {
      try {
        doc.addPage();
        const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const pageH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
        doc.image(imageBuffer, doc.page.margins.left, doc.page.margins.top, {
          fit: [pageW, pageH],
          align: 'center',
          valign: 'center'
        });
      } catch { /* skip image on error */ }
    }

    // Text content on a new page after the image
    if (imageBuffer) doc.addPage();

    // Formatted body
    doc.fillColor('#000000');
    for (const line of body.split('\n')) {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith('### ')) {
        doc.moveDown(0.4).fontSize(13).font('Helvetica-Bold').text(trimmed.slice(4));
      } else if (trimmed.startsWith('## ')) {
        doc.moveDown(0.5).fontSize(15).font('Helvetica-Bold').text(trimmed.slice(3));
      } else if (trimmed.startsWith('# ')) {
        doc.moveDown(0.6).fontSize(18).font('Helvetica-Bold').text(trimmed.slice(2));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        doc.fontSize(11).font('Helvetica').text(`  \u2022  ${trimmed.slice(2)}`, { indent: 15 });
      } else if (/^\d+\.\s/.test(trimmed)) {
        doc.fontSize(11).font('Helvetica').text(`  ${trimmed}`, { indent: 15 });
      } else if (trimmed === '---' || trimmed === '***') {
        doc.moveDown(0.3).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#CCCCCC').stroke();
        doc.moveDown(0.3);
      } else if (trimmed === '') {
        doc.moveDown(0.3);
      } else {
        // Handle inline bold by splitting on **...**
        const parts = trimmed.split(/(\*\*.+?\*\*)/g);
        if (parts.some((p) => p.startsWith('**'))) {
          doc.fontSize(11);
          for (const part of parts) {
            if (part.startsWith('**') && part.endsWith('**')) {
              doc.font('Helvetica-Bold').text(part.slice(2, -2), { continued: true });
            } else if (part) {
              doc.font('Helvetica').text(part, { continued: true });
            }
          }
          doc.font('Helvetica').text('');
        } else {
          doc.fontSize(11).font('Helvetica').text(trimmed);
        }
      }
    }

    // Footer
    doc.moveDown(2).fontSize(8).font('Helvetica-Oblique').fillColor('#999999')
      .text('\u00A9 Love to Sing. All rights reserved.', { align: 'center' });

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
  // TODO: Re-enable daily limit for production
  // if (used >= DAILY_LIMIT) return proxyJson(res, 429, { error: 'Daily chat limit reached', dailyLimit: DAILY_LIMIT });

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
  const titleMap = { lesson_plan: 'Lesson Plan', colouring_sheet: 'Colouring Sheet', activity_plan: 'Activity Plan', music_learning_guide: 'Music Learning Guide' };
  const docTitle = titleMap[generation.contentType] || 'AI Resource';
  const fileName = `${generation.contentType}-${new Date().toISOString().slice(0, 10)}.${format}`;

  // Generate colouring sheet image if applicable
  let imageBuffer = null;
  if (generation.contentType === 'colouring_sheet') {
    try { imageBuffer = await generateColouringImage(generation.prompt); } catch { /* continue without image */ }
  }

  let contentBase64;
  if (format === 'docx') {
    const buffer = await renderDocxBuffer(docTitle, generation.previewText, imageBuffer);
    contentBase64 = buffer.toString('base64');
  } else {
    const buffer = await renderPdfBuffer(docTitle, generation.previewText, imageBuffer);
    contentBase64 = buffer.toString('base64');
  }

  db.files[fileId] = {
    // TODO: Re-enable maxDownloads: 3 for production
    id: fileId, userId, generationId, format, name: fileName,
    contentBase64, downloadCount: 0, maxDownloads: 999, createdAt: nowIso()
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
  // TODO: Re-enable download limit for production
  // if (file.downloadCount >= file.maxDownloads) return proxyJson(res, 403, { error: 'Download limit reached' });

  file.downloadCount += 1;
  persistDb();

  const token = generateDownloadToken({ fileId: file.id, userId, exp: Date.now() + 1000 * 60 * 10 });
  const streamPath = `/files/${file.id}/stream?token=${token}`;
  proxyJson(res, 200, {
    url: PUBLIC_API_URL ? `${PUBLIC_API_URL}${streamPath}` : streamPath,
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
