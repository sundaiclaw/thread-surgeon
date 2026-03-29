import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeThread, getOpenRouterStatus } from './openrouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');
const indexHtml = path.join(distDir, 'index.html');

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'thread-surgeon', configured: getOpenRouterStatus().configured });
});

app.get('/api/config-status', (_req, res) => {
  const status = getOpenRouterStatus();
  res.json(status);
});

app.post('/api/analyze', async (req, res) => {
  const thread = typeof req.body?.thread === 'string' ? req.body.thread.trim() : '';

  if (!thread) {
    return res.status(400).json({ error: 'Paste a thread before running Thread Surgeon.' });
  }

  if (thread.length < 40) {
    return res.status(400).json({ error: 'Please provide a longer thread so the AI has enough context.' });
  }

  try {
    const analysis = await analyzeThread(thread);
    return res.json(analysis);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Unexpected server error.',
    });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    return res.sendFile(indexHtml);
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.status(404).send('Build the frontend with `npm run build` or start the Vite dev server with `npm run dev`.');
});

app.listen(port, () => {
  console.log(`Thread Surgeon listening on http://localhost:${port}`);
});
