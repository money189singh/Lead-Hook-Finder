import fs from 'fs';
import path from 'path';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws_default',
    name: 'Main Growth Workspace',
    slug: 'main-growth',
    role: 'owner',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    assignedLeadsCount: 42,
    members: [
      {
        id: 'mem_owner',
        name: 'Workspace Owner',
        email: 'admin@leadhook.ai',
        role: 'owner',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
        joinedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        id: 'mem_sarah',
        name: 'Sarah Chen',
        email: 'sarah.c@leadhook.ai',
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face',
        joinedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'mem_marcus',
        name: 'Marcus Vance',
        email: 'marcus.v@leadhook.ai',
        role: 'member',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        joinedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'mem_elena',
        name: 'Elena Rostova',
        email: 'elena.r@leadhook.ai',
        role: 'viewer',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
        joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        lastActiveAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ],
  },
  {
    id: 'ws_agency_fintech',
    name: 'Agency Client: FinTech Alpha',
    slug: 'fintech-alpha',
    role: 'admin',
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    assignedLeadsCount: 16,
    members: [
      {
        id: 'mem_owner',
        name: 'Workspace Owner',
        email: 'admin@leadhook.ai',
        role: 'owner',
        joinedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      },
      {
        id: 'mem_marcus',
        name: 'Marcus Vance',
        email: 'marcus.v@leadhook.ai',
        role: 'member',
        joinedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
    ],
  },
];

export class WorkspaceService {
  private workspaces: Workspace[] = [];
  private activeWorkspaceId = 'ws_default';
  private leadAssignments = new Map<string, string>(); // contactId -> memberName

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch {}
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(WORKSPACES_FILE)) {
        const raw = fs.readFileSync(WORKSPACES_FILE, 'utf-8');
        this.workspaces = JSON.parse(raw);
      } else {
        this.workspaces = INITIAL_WORKSPACES;
        this.saveToDisk();
      }
    } catch {
      this.workspaces = INITIAL_WORKSPACES;
    }
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(this.workspaces, null, 2), 'utf-8');
    } catch {}
  }

  public getWorkspaces(): Workspace[] {
    return this.workspaces;
  }

  public getActiveWorkspace(): Workspace {
    const found = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
    return found || this.workspaces[0] || INITIAL_WORKSPACES[0];
  }

  public setActiveWorkspace(id: string): Workspace {
    const found = this.workspaces.find((w) => w.id === id);
    if (!found) {
      throw new Error(`Workspace ${id} not found`);
    }
    this.activeWorkspaceId = id;
    return found;
  }

  public createWorkspace(name: string): Workspace {
    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const ws: Workspace = {
      id: `ws_${Date.now()}`,
      name: cleanName,
      slug,
      role: 'owner',
      createdAt: new Date().toISOString(),
      assignedLeadsCount: 0,
      members: [
        {
          id: `mem_${Date.now()}`,
          name: 'Workspace Owner',
          email: 'admin@leadhook.ai',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      ],
    };

    this.workspaces.push(ws);
    this.activeWorkspaceId = ws.id;
    this.saveToDisk();
    return ws;
  }

  public addMember(workspaceId: string, memberData: { name: string; email: string; role: WorkspaceRole }): Workspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) throw new Error('Workspace not found');

    const newMember: WorkspaceMember = {
      id: `mem_${Date.now()}`,
      name: memberData.name.trim(),
      email: memberData.email.trim().toLowerCase(),
      role: memberData.role || 'member',
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    ws.members.push(newMember);
    this.saveToDisk();
    return ws;
  }

  public updateMemberRole(workspaceId: string, memberId: string, role: WorkspaceRole): Workspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) throw new Error('Workspace not found');

    const m = ws.members.find((item) => item.id === memberId);
    if (!m) throw new Error('Member not found');
    m.role = role;

    this.saveToDisk();
    return ws;
  }

  public removeMember(workspaceId: string, memberId: string): Workspace {
    const ws = this.workspaces.find((w) => w.id === workspaceId);
    if (!ws) throw new Error('Workspace not found');

    ws.members = ws.members.filter((m) => m.id !== memberId);
    this.saveToDisk();
    return ws;
  }

  public assignLead(contactId: string, assigneeName: string): void {
    this.leadAssignments.set(contactId, assigneeName);
  }

  public getAssignment(contactId: string): string | undefined {
    return this.leadAssignments.get(contactId);
  }
}

export const globalWorkspaceService = new WorkspaceService();
