import { Router } from 'express';
import { WorkflowStorage } from './workflowStorage';
import { WorkflowExecutionEngine } from './workflowEngine';
import { Workflow } from '../../src/types/workflow';

export const workflowRouter = Router();

// GET /api/workflows - list all workflows
workflowRouter.get('/', (req, res) => {
  try {
    const list = WorkflowStorage.getAllWorkflows();
    res.json({ success: true, workflows: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/workflows/:id - get single workflow
workflowRouter.get('/:id', (req, res) => {
  try {
    const wf = WorkflowStorage.getWorkflow(req.params.id);
    if (!wf) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, workflow: wf });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/workflows - create workflow
workflowRouter.post('/', (req, res) => {
  try {
    const payload = req.body;
    const newWorkflow: Workflow = {
      id: payload.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: payload.name || 'Untitled Automation Workflow',
      description: payload.description || 'Custom automation flow',
      category: payload.category || 'custom',
      active: payload.active ?? true,
      nodes: payload.nodes || [],
      edges: payload.edges || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runsCount: 0,
      lastRunStatus: 'idle',
    };
    const saved = WorkflowStorage.saveWorkflow(newWorkflow);
    res.json({ success: true, workflow: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/workflows/:id - update workflow
workflowRouter.put('/:id', (req, res) => {
  try {
    const existing = WorkflowStorage.getWorkflow(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    const updated: Workflow = {
      ...existing,
      ...req.body,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    const saved = WorkflowStorage.saveWorkflow(updated);
    res.json({ success: true, workflow: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/workflows/:id - delete workflow
workflowRouter.delete('/:id', (req, res) => {
  try {
    const deleted = WorkflowStorage.deleteWorkflow(req.params.id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/workflows/:id/toggle - toggle active state
workflowRouter.post('/:id/toggle', (req, res) => {
  try {
    const wf = WorkflowStorage.getWorkflow(req.params.id);
    if (!wf) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    wf.active = !wf.active;
    const saved = WorkflowStorage.saveWorkflow(wf);
    res.json({ success: true, workflow: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/workflows/:id/execute - execute entire workflow
workflowRouter.post('/:id/execute', async (req, res) => {
  try {
    const wf = WorkflowStorage.getWorkflow(req.params.id);
    if (!wf) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const payload = req.body?.payload || req.body || undefined;
    const run = await WorkflowExecutionEngine.executeWorkflow(wf, payload);
    WorkflowStorage.saveRun(run);

    res.json({ success: true, run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/workflows/:id/runs - get runs for workflow
workflowRouter.get('/:id/runs', (req, res) => {
  try {
    const runs = WorkflowStorage.getRunsForWorkflow(req.params.id);
    res.json({ success: true, runs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/workflows/runs/:runId - get single run
workflowRouter.get('/runs/:runId', (req, res) => {
  try {
    const run = WorkflowStorage.getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    res.json({ success: true, run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/workflows/test-node - test single node in isolation
workflowRouter.post('/test-node', async (req, res) => {
  try {
    const { node, inputData } = req.body;
    if (!node) {
      return res.status(400).json({ success: false, error: 'Node configuration required' });
    }

    const start = Date.now();
    const result = await WorkflowExecutionEngine.executeSingleNode(node, inputData || {});
    const durationMs = Date.now() - start;

    res.json({
      success: true,
      durationMs,
      output: result.output,
      agentThoughts: result.agentThoughts,
      branchTaken: result.branchTaken,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
