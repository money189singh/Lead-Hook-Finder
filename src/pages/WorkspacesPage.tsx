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
  Mail,
  UserCheck,
} from 'lucide-react';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../types';

interface WorkspacesPageProps {
  onShowToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  onWorkspaceChanged?: (ws: Workspace) => void;
}

export const WorkspacesPage: React.FC<WorkspacesPageProps> = ({
  onShowToast,
  onWorkspaceChanged,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws_default');
  const [activeTab, setActiveTab] = useState<'members' | 'workspaces' | 'create'>('members');
  const [isLoading, setIsLoading] = useState(false);

  // New Workspace form
  const [newWsName, setNewWsName] = useState('');

  // New Member form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<WorkspaceRole>('member');

  useEffect(() => {
    loadWorkspaces();
  }, []);

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
      setActiveTab('members');
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
      if (!res.ok) throw new Error('Role update failed');
      const updatedWs: Workspace = await res.json();
      setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
      onShowToast(`Role updated to ${role}`, 'info');
    } catch (e: any) {
      onShowToast(e.message || 'Role update failed', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this teammate from the workspace?')) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Remove failed');
      const updatedWs: Workspace = await res.json();
      setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
      onShowToast('Member removed from workspace', 'info');
    } catch (e: any) {
      onShowToast(e.message || 'Remove failed', 'error');
    }
  };

  return (
    <div id="workspaces-page" className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-purple-200/80 dark:border-purple-900/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 text-white shadow-md">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Team Collaboration, Roles & Multi-Workspace
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                RBAC & Collaboration
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Quick Selector */}
        <div className="flex items-center gap-2">
          <select
            value={activeWorkspaceId}
            onChange={(e) => handleSwitchWorkspace(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 focus:outline-none cursor-pointer"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.members.length} members)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'members'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members ({activeWorkspace?.members?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('workspaces')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'workspaces'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>All Workspaces ({workspaces.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'create'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Create New Workspace</span>
        </button>
      </div>

      {/* Tab: Members Table */}
      {activeTab === 'members' && activeWorkspace && (
        <div className="space-y-6">
          {/* Invite Box */}
          <form
            onSubmit={handleAddMember}
            className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-purple-500" />
              <span>Invite New Teammate</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Full Name (e.g. David Ross)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              />
              <input
                type="email"
                required
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Work Email (e.g. david@company.com)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as WorkspaceRole)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer transition shrink-0"
                >
                  Invite
                </button>
              </div>
            </div>
          </form>

          {/* Members Table */}
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase text-slate-500 tracking-wider">
              {activeWorkspace.name} Teammates & Permission Roles
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeWorkspace.members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{member.name}</span>
                        {member.role === 'owner' && (
                          <span className="p-0.5 rounded text-amber-500" title="Workspace Owner">
                            <Crown className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {member.email} &bull; Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <select
                      value={member.role}
                      disabled={member.role === 'owner'}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as WorkspaceRole)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: All Workspaces */}
      {activeTab === 'workspaces' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((w) => {
            const isCurrent = w.id === activeWorkspaceId;

            return (
              <div
                key={w.id}
                className={`glass-card p-5 rounded-2xl border transition-all space-y-3 ${
                  isCurrent
                    ? 'border-purple-500/50 bg-purple-500/5 dark:bg-purple-950/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{w.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">/{w.slug}</span>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Active
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {w.members.length} team members &bull; Created {new Date(w.createdAt).toLocaleDateString()}
                </div>

                {!isCurrent && (
                  <button
                    onClick={() => handleSwitchWorkspace(w.id)}
                    className="w-full py-2 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 transition cursor-pointer"
                  >
                    Switch to Workspace
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Create New Workspace */}
      {activeTab === 'create' && (
        <form
          onSubmit={handleCreateWorkspace}
          className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-w-lg"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-500" />
            <span>Create Organization Workspace</span>
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              required
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="e.g. Enterprise Outbound / EMEA Sales"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md cursor-pointer transition"
          >
            Create Workspace
          </button>
        </form>
      )}
    </div>
  );
};
