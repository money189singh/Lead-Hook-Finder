// ============================================================================
// WORKFLOW AUTOMATION ENGINE TYPES (N8N-STYLE + AI AGENT SYSTEM)
// ============================================================================

export type WorkflowNodeType =
  // Triggers
  | 'webhook_trigger'
  | 'schedule_trigger'
  | 'lead_discovered_trigger'
  | 'manual_trigger'
  // In-Built Tools
  | 'http_request'
  | 'web_scraper'
  | 'search_discovery'
  | 'email_verifier'
  | 'code_transform'
  | 'send_notification'
  | 'save_crm_lead'
  | 'delay'
  // Conditions & Flow Control
  | 'condition_if'
  | 'switch_router'
  | 'loop_items'
  // AI & Autonomous Agents
  | 'ai_agent'
  | 'ai_generate_text'
  | 'ai_lead_qualifier'
  | 'ai_extract_structured_data'
  | 'ai_sentiment_analyzer'
  | 'ai_research_dossier'
  | 'ai_tech_stack_detector'
  // Cloud & CRM Integrations
  | 'hubspot_crm'
  | 'salesforce_crm'
  | 'slack_notification'
  | 'discord_webhook'
  | 'telegram_alert'
  | 'email_dispatch'
  | 'google_sheets'
  | 'airtable_sync'
  | 'clearbit_enrichment';

export type NodeCategory = 'trigger' | 'tool' | 'logic' | 'ai' | 'action' | 'integration';

export interface ConditionRule {
  id: string;
  field: string; // e.g. "json.email", "json.score", "json.contacts.length"
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'is_empty'
    | 'is_not_empty'
    | 'regex_match'
    | 'is_valid_email';
  value: string;
}

export interface AgentThoughtStep {
  step: number;
  thought: string;
  toolCalled?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  timestamp: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: WorkflowNodeType;
  category: NodeCategory;
  position: { x: number; y: number };
  disabled?: boolean;
  notes?: string;
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'output' | 'true' | 'false' | string;
  targetHandle?: 'input' | string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: 'prospecting' | 'enrichment' | 'intelligence' | 'verification' | 'custom';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunStatus?: 'idle' | 'running' | 'success' | 'failed' | 'cancelled';
  lastRunAt?: string;
  runsCount?: number;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  inputData?: any;
  outputData?: any;
  error?: string;
  branchTaken?: 'true' | 'false' | string;
  agentThoughts?: AgentThoughtStep[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  trigger: string;
  initialInput?: any;
  finalOutput?: any;
  nodeExecutions: Record<string, NodeExecutionResult>;
  error?: string;
}

export interface NodeDefinitionMeta {
  type: WorkflowNodeType;
  name: string;
  description: string;
  category: NodeCategory;
  iconName: string;
  color: string;
  defaultData: Record<string, any>;
  hasConditionHandles?: boolean;
  supportedTools?: string[];
}
