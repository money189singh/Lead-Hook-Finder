import { Router, Request, Response } from 'express';
import { globalCompanyResearchService } from './researchService';
import { globalOpenRouterClient } from './openRouterClient';
import { globalResearchCache } from './cache';
import { CompanyResearchRequest } from './types';

export const researchRouter = Router();

/**
 * GET /api/research/status
 * Returns provider configuration status, model, search engine status, metrics
 * Never exposes raw API keys.
 */
researchRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = globalCompanyResearchService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve research status' });
  }
});

/**
 * POST /api/research/company
 * Triggers external research for a specific company
 */
researchRouter.post('/company', async (req: Request, res: Response) => {
  try {
    const body: CompanyResearchRequest = req.body;
    if (!body || !body.companyName) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'companyName is required in request body.' },
      });
      return;
    }

    const result = await globalCompanyResearchService.researchCompany(body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message || 'External research execution failed' },
    });
  }
});

/**
 * POST /api/research/test-connection
 * Tests OpenRouter API key and model connectivity
 */
researchRouter.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body || {};
    const result = await globalOpenRouterClient.testConnection(apiKey, model);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Connection test failed' });
  }
});

/**
 * POST /api/research/test-fixture
 * Runs deterministic Sierra Law test fixture to verify parsing, validation, and Firebase merger
 */
researchRouter.post('/test-fixture', (req: Request, res: Response) => {
  try {
    const fixtureResult = globalCompanyResearchService.executeFixtureTest();
    res.json(fixtureResult);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Fixture test failed' });
  }
});

/**
 * GET /api/research/cache
 * Lists active cache entries
 */
researchRouter.get('/cache', (req: Request, res: Response) => {
  try {
    const list = globalResearchCache.listKeys();
    res.json({ total: list.length, items: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/research/cache/:key
 * Clears cache for a given key or all if key is 'all'
 */
researchRouter.delete('/cache/:key', (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (key === 'all') {
      globalResearchCache.clear();
      res.json({ success: true, message: 'All research cache cleared' });
    } else {
      globalResearchCache.delete(key);
      res.json({ success: true, message: `Cache cleared for ${key}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
