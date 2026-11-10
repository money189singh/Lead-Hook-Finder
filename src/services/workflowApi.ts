import { Workflow, WorkflowRun, WorkflowNode } from '../types/workflow';

export const workflowApi = {
  async getWorkflows(): Promise<Workflow[]> {
    const res = await fetch('/api/workflows');
    if (!res.ok) throw new Error('Failed to fetch workflows');
    const data = await res.json();
    return data.workflows || [];
  },

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}`);
    if (!res.ok) throw new Error('Failed to fetch workflow');
    const data = await res.json();
    return data.workflow;
  },

  async createWorkflow(wf: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wf),
    });
    if (!res.ok) throw new Error('Failed to create workflow');
    const data = await res.json();
    return data.workflow;
  },

  async updateWorkflow(id: string, wf: Partial<Workflow>): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wf),
    });
    if (!res.ok) throw new Error('Failed to update workflow');
    const data = await res.json();
    return data.workflow;
  },

  async deleteWorkflow(id: string): Promise<boolean> {
    const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete workflow');
    const data = await res.json();
    return data.deleted;
  },

  async toggleWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`/api/workflows/${id}/toggle`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle workflow');
    const data = await res.json();
    return data.workflow;
  },

  async executeWorkflow(id: string, payload?: any): Promise<WorkflowRun> {
    const res = await fetch(`/api/workflows/${id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) throw new Error('Failed to execute workflow');
    const data = await res.json();
    return data.run;
  },

  async getRuns(workflowId: string): Promise<WorkflowRun[]> {
    const res = await fetch(`/api/workflows/${workflowId}/runs`);
    if (!res.ok) throw new Error('Failed to fetch runs');
    const data = await res.json();
    return data.runs || [];
  },

  async getRun(runId: string): Promise<WorkflowRun> {
    const res = await fetch(`/api/workflows/runs/${runId}`);
    if (!res.ok) throw new Error('Failed to fetch run details');
    const data = await res.json();
    return data.run;
  },

  async testSingleNode(node: WorkflowNode, inputData: any): Promise<{
    output: any;
    agentThoughts?: any[];
    branchTaken?: string;
    durationMs: number;
  }> {
    const res = await fetch('/api/workflows/test-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node, inputData }),
    });
    if (!res.ok) throw new Error('Failed to test node');
    return res.json();
  },
};
