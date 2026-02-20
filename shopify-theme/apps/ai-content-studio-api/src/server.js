import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const DAILY_LIMIT = Number(process.env.DAILY_CHAT_LIMIT || 3);
const PORT = Number(process.env.PORT || 8787);
const SIGNING_SECRET = process.env.SIGNING_SECRET || 'replace-me';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
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
  try {
    Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')));
  } catch {
    // ignore corrupt file for now
  }
}

function persistDb() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function getUserId(req) {
  return req.header('x-shopify-customer-id') || req.query.customerId;
}

function getDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function canGenerate(req) {
  return req.header('x-lts-entitled') === 'true';
}

function nextId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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
    return {
      text: `Draft ${contentType.replace('_', ' ')} based on Love to Sing songs:\n\n${prompt}\n\n(Placeholder response, GEMINI_API_KEY not configured)`
    };
  }

  const instruction = `You are generating classroom resources only about Love to Sing music. Keep output practical, age-appropriate, and classroom safe.`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: `${instruction}\n\nType: ${contentType}\nPrompt: ${prompt}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1400 }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gemini failed (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || 'No content returned';
  return { text };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/terms/accept', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  db.termsAcceptance[userId] = {
    acceptedAt: new Date().toISOString(),
    version: req.body?.version || 'v1'
  };
  persistDb();
  res.json({ ok: true });
});

app.post('/chat', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, contentType = 'lesson_plan' } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const day = getDateKey();
  const usageKey = `${userId}:${day}`;
  const used = db.usageByUserDate[usageKey] || 0;
  if (used >= DAILY_LIMIT) {
    return res.status(429).json({ error: 'Daily chat limit reached', dailyLimit: DAILY_LIMIT });
  }

  let ai;
  try {
    ai = await generateWithGeminiFlash(prompt, contentType);
  } catch (err) {
    return res.status(502).json({ error: 'Model generation failed', detail: String(err.message || err) });
  }

  db.usageByUserDate[usageKey] = used + 1;

  const generationId = nextId('gen');
  db.generations[generationId] = {
    id: generationId,
    userId,
    prompt,
    contentType,
    previewText: ai.text,
    createdAt: new Date().toISOString()
  };
  persistDb();

  res.json({
    generationId,
    message: 'Preview generated',
    previewText: ai.text,
    remainingChats: Math.max(DAILY_LIMIT - (used + 1), 0)
  });
});

app.post('/generate', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!canGenerate(req)) return res.status(402).json({ error: 'Membership required' });

  const { generationId, format } = req.body || {};
  if (!generationId || !format || !['docx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'generationId and format(docx|pdf) are required' });
  }

  const generation = db.generations[generationId];
  if (!generation || generation.userId !== userId) {
    return res.status(404).json({ error: 'Generation not found' });
  }

  const fileId = nextId('file');
  const fileName = `${generation.contentType}-${new Date().toISOString().slice(0, 10)}.${format}`;
  db.files[fileId] = {
    id: fileId,
    userId,
    generationId,
    format,
    name: fileName,
    content: generation.previewText,
    downloadCount: 0,
    maxDownloads: 3,
    createdAt: new Date().toISOString()
  };
  persistDb();

  res.json({ fileId, fileName });
});

app.get('/files', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const userFiles = Object.values(db.files)
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ files: userFiles });
});

app.post('/files/:id/download', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = db.files[req.params.id];
  if (!file || file.userId !== userId) return res.status(404).json({ error: 'File not found' });
  if (file.downloadCount >= file.maxDownloads) {
    return res.status(403).json({ error: 'Download limit reached' });
  }

  file.downloadCount += 1;
  persistDb();

  const token = generateDownloadToken({ fileId: file.id, userId, exp: Date.now() + 1000 * 60 * 10 });
  res.json({
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

  const brandedContent = `Love to Sing\n\n© Love to Sing. All rights reserved.\nGenerated content remains copyright Love to Sing. Reproduction/distribution prohibited outside Terms of Service.\n\n${file.content}`;
  const mime = file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.send(brandedContent);
});

app.listen(PORT, () => {
  console.log(`AI Content Studio API listening on :${PORT}`);
});
