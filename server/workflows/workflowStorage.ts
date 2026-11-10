import fs from 'fs';
import path from 'path';
import { Workflow, WorkflowRun } from '../../src/types/workflow';
import { PRESET_WORKFLOWS } from '../../src/services/workflowTemplates';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const RUNS_FILE = path.join(DATA_DIR, 'workflow_runs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export class WorkflowStorage {
  private static workflowsMemory: Map<string, Workflow> = new Map();
  private static runsMemory: Map<string, WorkflowRun> = new Map();
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    ensureDataDir();

    // Load workflows
    if (fs.existsSync(WORKFLOWS_FILE)) {
      try {
        const raw = fs.readFileSync(WORKFLOWS_FILE, 'utf-8');
        const list: Workflow[] = JSON.parse(raw);
        list.forEach((w) => this.workflowsMemory.set(w.id, w));
      } catch (e) {
        console.error('Failed reading workflows.json, using defaults:', e);
      }
    }

    // Seed preset workflows if empty or add missing presets
    PRESET_WORKFLOWS.forEach((pw) => {
      if (!this.workflowsMemory.has(pw.id)) {
        this.workflowsMemory.set(pw.id, pw);
      }
    });
    this.persistWorkflows();

    // Load runs
    if (fs.existsSync(RUNS_FILE)) {
      try {
        const raw = fs.readFileSync(RUNS_FILE, 'utf-8');
        const runs: WorkflowRun[] = JSON.parse(raw);
        runs.forEach((r) => this.runsMemory.set(r.id, r));
      } catch (e) {
        console.error('Failed reading workflow_runs.json:', e);
      }
    }

    this.initialized = true;
  }

  private static persistWorkflows() {
    try {
      ensureDataDir();
      const list = Array.from(this.workflowsMemory.values());
      fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error persisting workflows:', e);
    }
  }

  private static persistRuns() {
    try {
      ensureDataDir();
      const list = Array.from(this.runsMemory.values())
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 50); // Keep last 50 runs
      fs.writeFileSync(RUNS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error persisting workflow runs:', e);
    }
  }

  public static getAllWorkflows(): Workflow[] {
    this.init();
    return Array.from(this.workflowsMemory.values());
  }

  public static getWorkflow(id: string): Workflow | null {
    this.init();
    return this.workflowsMemory.get(id) || null;
  }

  public static saveWorkflow(wf: Workflow): Workflow {
    this.init();
    wf.updatedAt = new Date().toISOString();
    this.workflowsMemory.set(wf.id, wf);
    this.persistWorkflows();
    return wf;
  }

  public static deleteWorkflow(id: string): boolean {
    this.init();
    const removed = this.workflowsMemory.delete(id);
    if (removed) {
      this.persistWorkflows();
    }
    return removed;
  }

  public static saveRun(run: WorkflowRun): WorkflowRun {
    this.init();
    this.runsMemory.set(run.id, run);
    this.persistRuns();

    // Update workflow last run status
    const wf = this.workflowsMemory.get(run.workflowId);
    if (wf) {
      wf.lastRunStatus = run.status;
      wf.lastRunAt = run.finishedAt || run.startedAt;
      wf.runsCount = (wf.runsCount || 0) + 1;
      this.persistWorkflows();
    }
    return run;
  }

  public static getRunsForWorkflow(workflowId: string): WorkflowRun[] {
    this.init();
    return Array.from(this.runsMemory.values())
      .filter((r) => r.workflowId === workflowId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public static getRun(id: string): WorkflowRun | null {
    this.init();
    return this.runsMemory.get(id) || null;
  }
}
