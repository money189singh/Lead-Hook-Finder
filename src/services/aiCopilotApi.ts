import {
  OutreachGenerationRequest,
  OutreachSequenceResult,
  AccountDossierRequest,
  AccountDossierResult,
  IcpArchitectRequest,
  IcpArchitectResult,
  ObjectionHandlerRequest,
  ObjectionHandlerResult,
} from '../types';

export const aiCopilotApi = {
  async generateOutreach(req: OutreachGenerationRequest): Promise<OutreachSequenceResult> {
    const res = await fetch('/api/ai/copilot/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate outreach sequence' }));
      throw new Error(err.error || 'Failed to generate outreach sequence');
    }
    return res.json();
  },

  async generateAccountDossier(req: AccountDossierRequest): Promise<AccountDossierResult> {
    const res = await fetch('/api/ai/copilot/account-dossier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate account dossier' }));
      throw new Error(err.error || 'Failed to generate account dossier');
    }
    return res.json();
  },

  async architectIcp(req: IcpArchitectRequest): Promise<IcpArchitectResult> {
    const res = await fetch('/api/ai/copilot/icp-architect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to architect ICP' }));
      throw new Error(err.error || 'Failed to architect ICP');
    }
    return res.json();
  },

  async handleObjection(req: ObjectionHandlerRequest): Promise<ObjectionHandlerResult> {
    const res = await fetch('/api/ai/copilot/objection-handler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to handle sales objection' }));
      throw new Error(err.error || 'Failed to handle sales objection');
    }
    return res.json();
  },
};
