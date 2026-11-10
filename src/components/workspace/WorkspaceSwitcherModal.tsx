import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  Shield,
  Plus,
  Check,
  UserPlus,
  Trash2,
  Crown,
  Layers,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../types';

interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onWorkspaceChanged?: (ws: Workspace) => void;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onWorkspaceChanged,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws_default');
  const [activeTab, setActiveTab] = useState<'switch' | 'members' | 'create'>('switch');
  const [isLoading, setIsLoading] = useState(false);

  // New Workspace form
  const [newWsName, setNewWsName] = useState('');

  // New Member form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<WorkspaceRole>('member');

  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
    }
  }, [isOpen]);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        if (data.activeWorkspaceId) {
          setActiveWorkspaceId(data.activeWorkspaceId);
        }
      }
    } catch {
      onShowToast('Could not load workspaces', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleSwitchWorkspace = async (id: string) => {
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Switch failed');
      const data = await res.json();
      setActiveWorkspaceId(id);
      onShowToast(`Switched to workspace "${data.activeWorkspace.name}"`, 'success');
      if (onWorkspaceChanged) onWorkspaceChanged(data.activeWorkspace);
    } catch (e: any) {
      onShowToast(e.message || 'Switch failed', 'error');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWsName.trim() }),
      });
      if (!res.ok) throw new Error('Create failed');
      const ws: Workspace = await res.json();
      onShowToast(`Workspace "${ws.name}" created!`, 'success');
      setNewWsName('');
      setActiveWorkspaceId(ws.id);
      setActiveTab('switch');
      loadWorkspaces();
      if (onWorkspaceChanged) onWorkspaceChanged(ws);
    } catch (e: any) {
      onShowToast(e.message || 'Create failed', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          role: newMemberRole,
        }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      const updatedWs: Workspace = await res.json();
      setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
      onShowToast(`Invited ${newMemberName} to workspace!`, 'success');
      setNewMemberName('');
      setNewMemberEmail('');
    } catch (e: any) {
      onShowToast(e.message || 'Add member failed', 'error');
    }
  };

  const handleUpdateRole = async (memberId: string, role: WorkspaceRole) => {
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const updatedWs: Workspace = await res.json();
        setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
        onShowToast('Member role updated', 'info');
      }
    } catch {
      onShowToast('Role update failed', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updatedWs: Workspace = await res.json();
        setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
        onShowToast('Member removed', 'info');
      }
    } catch {
      onShowToast('Remove failed', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="glass-card relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0c1322] border border-blue-200/80 dark:border-blue-900/40 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Team Collaboration & Multi-Workspace
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('switch')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'switch'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Workspaces ({workspaces.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Members ({activeWorkspace?.members?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Workspace</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'switch' && (
            <div className="space-y-3">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;

                return (
                  <div
                    key={ws.id}
                    onClick={() => handleSwitchWorkspace(ws.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'border-purple-500/80 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628] hover:border-purple-300 dark:hover:border-purple-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isActive ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {ws.name}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-purple-600 text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {ws.members?.length || 1} team members &bull; {ws.assignedLeadsCount || 0} assigned leads
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      ) : (
                        <span>Switch &rarr;</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-5">
              {/* Invite Member Card */}
              <form onSubmit={handleAddMember} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                  <span>Invite Teammate to "{activeWorkspace?.name}"</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Full Name (e.g., Alex Rivera)"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-slate-900 dark:text-white"
                    required
                  />
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-slate-900 dark:text-white"
                    required
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-slate-900 dark:text-white"
                  >
                    <option value="member">Member (Can scrape & export)</option>
                    <option value="admin">Admin (Can edit settings)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Send Workspace Invite</span>
                </button>
              </form>

              {/* Members List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Current Workspace Members
                </h3>

                {activeWorkspace?.members?.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1628] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {m.avatar ? (
                        <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold flex items-center justify-center">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{m.name}</span>
                          {m.role === 'owner' && <Crown className="w-3 h-3 text-amber-500" />}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {m.role === 'owner' ? (
                        <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                          Owner
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.id, e.target.value as any)}
                          className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#101730] text-slate-900 dark:text-white capitalize"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {m.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateWorkspace} className="max-w-md mx-auto space-y-4 py-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Workspace Name
                </label>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g., Enterprise Outbound Team"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101730] text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Workspace</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
