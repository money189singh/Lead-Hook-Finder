import { Router } from 'express';
import { globalTechDetector } from './techDetectorEngine';

export const techDetectorRouter = Router();

// POST /api/tech/detect
techDetectorRouter.post('/detect', async (req, res) => {
  try {
    const { url, html } = req.body;
    if (!url && !html) {
      return res.status(400).json({ error: 'URL or HTML is required' });
    }

    if (html) {
      const technologies = globalTechDetector.detectFromHtml(html);
      return res.json({
        url: url || 'direct_html',
        domain: url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : 'direct_html',
        technologies,
        analyzedAt: new Date().toISOString(),
      });
    }

    const result = await globalTechDetector.detectUrl(url);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tech/batch-detect
techDetectorRouter.post('/batch-detect', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls)) {
      return res.status(400).json({ error: 'Array of URLs is required' });
    }

    const limitedUrls = urls.slice(0, 15);
    const results = await Promise.all(limitedUrls.map((u) => globalTechDetector.detectUrl(u)));
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
