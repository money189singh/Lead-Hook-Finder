import { Router } from 'express';
import { globalBuyingSignalsEngine } from './signalsEngine';

export const signalsRouter = Router();

// GET /api/signals/radar - Returns all active buying signals & stats
signalsRouter.get('/radar', (req, res) => {
  try {
    const data = globalBuyingSignalsEngine.getRadarData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/news - Returns live commercial news feed items
signalsRouter.get('/news', (req, res) => {
  try {
    const news = globalBuyingSignalsEngine.getNewsFeed();
    res.json(news);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signals/scan - Triggers a live AI radar scan for real-time buying signals
signalsRouter.post('/scan', async (req, res) => {
  try {
    const { query, industry, location } = req.body;
    const result = await globalBuyingSignalsEngine.runLiveRadarScan({
      query: query ? String(query).trim() : undefined,
      industry: industry ? String(industry).trim() : undefined,
      location: location ? String(location).trim() : undefined,
    });
    res.json(result);
  } catch (err: any) {
    let msg = err?.message || 'Failed to complete radar scan';
    try {
      if (typeof msg === 'string' && msg.includes('"error":')) {
        const parsed = JSON.parse(msg);
        msg = parsed?.error?.message || msg;
      }
    } catch {}
    if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      msg = 'Gemini API Rate Limit / Quota Exceeded (429). Please try again shortly or check your Gemini billing tier.';
    }
    res.status(500).json({ error: msg });
  }
});
