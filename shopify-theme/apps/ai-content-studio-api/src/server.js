import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const DAILY_LIMIT = Number(process.env.DAILY_CHAT_LIMIT || 3);
const PORT = Number(process.env.PORT || 8787);

// MVP in-memory stores. Replace with DB.
const usageByUserDate = new Map(); // key: userId:YYYY-MM-DD => count
const generations = new Map(); // generationId => data
const files = new Map(); // fileId => data

function getUserId(req) {
  // TODO: replace with Shopify session verification
  return req.header('x-shopify-customer-id') || req.query.customerId;
}

function getDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function canGenerate(req) {
  // TODO: replace with real entitlement check (membership/credits)
  return req.header('x-lts-entitled') === 'true';
}

function nextId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function generateWithGeminiFlash(prompt, contentType) {
  // TODO: wire real Gemini Flash model call.
  return {
    text: `Draft ${contentType.replace('_', ' ')} based on Love to Sing songs:\n\n${prompt}\n\n(Placeholder response from API scaffold)`
  };
}

app.get('/health', (_req, res) => {
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
  const used = usageByUserDate.get(usageKey) || 0;
  if (used >= DAILY_LIMIT) {
    return res.status(429).json({ error: 'Daily chat limit reached', dailyLimit: DAILY_LIMIT });
  }

  const ai = await generateWithGeminiFlash(prompt, contentType);

  usageByUserDate.set(usageKey, used + 1);

  const generationId = nextId('gen');
  generations.set(generationId, {
    id: generationId,
    userId,
    prompt,
    contentType,
    previewText: ai.text,
    createdAt: new Date().toISOString()
  });

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

  const generation = generations.get(generationId);
  if (!generation || generation.userId !== userId) {
    return res.status(404).json({ error: 'Generation not found' });
  }

  const fileId = nextId('file');
  const fileName = `${generation.contentType}-${new Date().toISOString().slice(0, 10)}.${format}`;
  files.set(fileId, {
    id: fileId,
    userId,
    generationId,
    format,
    name: fileName,
    downloadCount: 0,
    maxDownloads: 3,
    createdAt: new Date().toISOString()
  });

  res.json({ fileId, fileName });
});

app.get('/files', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const userFiles = [...files.values()]
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ files: userFiles });
});

app.post('/files/:id/download', (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = files.get(req.params.id);
  if (!file || file.userId !== userId) return res.status(404).json({ error: 'File not found' });
  if (file.downloadCount >= file.maxDownloads) {
    return res.status(403).json({ error: 'Download limit reached' });
  }

  file.downloadCount += 1;

  // TODO: replace with short-lived signed storage URL
  res.json({
    url: `/mock-download/${file.id}`,
    downloadCount: file.downloadCount,
    remainingDownloads: Math.max(file.maxDownloads - file.downloadCount, 0)
  });
});

app.listen(PORT, () => {
  console.log(`AI Content Studio API listening on :${PORT}`);
});
