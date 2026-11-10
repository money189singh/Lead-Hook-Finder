import { Router } from 'express';
import { globalWorkspaceService } from './workspaceService';

export const workspaceRouter = Router();

// GET /api/workspaces
workspaceRouter.get('/', (req, res) => {
  try {
    const list = globalWorkspaceService.getWorkspaces();
    const active = globalWorkspaceService.getActiveWorkspace();
    res.json({
      workspaces: list,
      activeWorkspaceId: active.id,
      activeWorkspace: active,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces
workspaceRouter.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });
    const ws = globalWorkspaceService.createWorkspace(name);
    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/switch
workspaceRouter.post('/switch', (req, res) => {
  try {
    const { id } = req.body;
    const ws = globalWorkspaceService.setActiveWorkspace(id);
    res.json({ success: true, activeWorkspace: ws });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:id/members
workspaceRouter.post('/:id/members', (req, res) => {
  try {
    const ws = globalWorkspaceService.addMember(req.params.id, req.body);
    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/workspaces/:id/members/:memberId
workspaceRouter.put('/:id/members/:memberId', (req, res) => {
  try {
    const { role } = req.body;
    const ws = globalWorkspaceService.updateMemberRole(req.params.id, req.params.memberId, role);
    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:id/members/:memberId
workspaceRouter.delete('/:id/members/:memberId', (req, res) => {
  try {
    const ws = globalWorkspaceService.removeMember(req.params.id, req.params.memberId);
    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/assign-lead
workspaceRouter.post('/assign-lead', (req, res) => {
  try {
    const { contactId, assigneeName } = req.body;
    if (!contactId || !assigneeName) {
      return res.status(400).json({ error: 'contactId and assigneeName required' });
    }
    globalWorkspaceService.assignLead(contactId, assigneeName);
    res.json({ success: true, contactId, assigneeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
