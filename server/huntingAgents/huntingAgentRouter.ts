import { Router } from 'express';
import { globalHuntingAgentEngine } from './huntingAgentEngine';

export const huntingAgentRouter = Router();

// GET /api/hunting-agents
huntingAgentRouter.get('/', (req, res) => {
  try {
    const agents = globalHuntingAgentEngine.getAgents();
    res.json(agents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hunting-agents
huntingAgentRouter.post('/', (req, res) => {
  try {
    const created = globalHuntingAgentEngine.createAgent(req.body);
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/hunting-agents/:id
huntingAgentRouter.put('/:id', (req, res) => {
  try {
    const updated = globalHuntingAgentEngine.updateAgent(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hunting-agents/:id
huntingAgentRouter.delete('/:id', (req, res) => {
  try {
    const deleted = globalHuntingAgentEngine.deleteAgent(req.params.id);
    res.json({ success: deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hunting-agents/:id/run
huntingAgentRouter.post('/:id/run', async (req, res) => {
  try {
    const run = await globalHuntingAgentEngine.runAgentNow(req.params.id);
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hunting-agents/runs
huntingAgentRouter.get('/runs/all', (req, res) => {
  try {
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    const runs = globalHuntingAgentEngine.getRuns(agentId);
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
