import React from 'react';
import { Download, Play, Sun, Moon, PanelLeftOpen, PanelLeftClose, Building, Bot, Webhook, Cpu, Layers, Settings, Sparkles } from 'lucide-react';
import { NavTab } from './Sidebar';
import { ScrapeJob, ScrapeSettings } from '../types';
import { useTheme } from '../context/ThemeContext';
import { UserProfileButton } from './UserProfileButton';
import { StatusIndicator } from './glass/StatusIndicator';
import { GlassButton } from './glass/GlassButton';

interface HeaderProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  onExportXlsx: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenWorkspace?: () => void;
  onOpenAgents?: () => void;
  onOpenInbound?: () => void;
  onOpenTechDetector?: () => void;
  onOpenWaterfall?: () => void;
  onOpenAiAgent?: () => void;
  activeWorkspaceName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNavigate,
  currentJob,
  settings,
  onExportXlsx,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenWorkspace,
  onOpenAgents,
  onOpenInbound,
  onOpenTechDetector,
  onOpenWaterfall,
  onOpenAiAgent,
  activeWorkspaceName,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const titles: Record<NavTab, { title: string }> = {
    dashboard: { title: 'Dashboard' },
    'hunting-agents': { title: 'Autonomous Lead Hunting Agents' },
    'tech-detector': { title: 'Website Tech Stack Detector' },
    waterfall: { title: 'Waterfall Decision-Maker Finder' },
    'inbound-gateway': { title: 'Inbound Webhooks & Extension Gateway' },
    workspaces: { title: 'Team Workspaces & Roles' },
    'algo-search': { title: 'Algo Search Engine' },
    'social-radar': { title: 'Social Demand Radar' },
    'google-maps': { title: 'Google Maps Lead Scraper' },
    discovery: { title: 'AI Prospect Discovery' },
    'ai-studio': { title: 'AI Sales Copilot & Outreach Studio' },
    workflows: { title: 'AI Automation Workflows (n8n Engine)' },
    'buying-signals': { title: 'Live Buying Signals Radar' },
    scraper: { title: 'Website Contact Scraper' },
    results: { title: 'Leads & Results' },
    'email-verifier': { title: 'Email Verifier' },
    verifier: { title: 'Business Verifier' },
    history: { title: 'Scrape History' },
    'ai-control': { title: 'AI Control Center' },
    resilience: { title: 'Proxy & Resilience' },
    settings: { title: 'Settings' },
    about: { title: 'About LeadHook' },
  };

  const currentInfo = titles[activeTab] || {
    title: 'LeadHook',
  };
  const hasContacts = Boolean(currentJob && currentJob.contacts && currentJob.contacts.length > 0);

  return (
    <header
      id="app-header"
      className="h-14 mx-3 mt-3 px-5 glass-panel rounded-2xl flex items-center justify-between z-20 shrink-0 select-none shadow-sm transition-all duration-200"
    >
      {/* Title & Context */}
      <div className="flex items-center gap-2.5 overflow-hidden min-w-0 mr-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Toggle sidebar"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition cursor-pointer shrink-0"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}
        <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 whitespace-nowrap shrink-0">
          <span>{currentInfo.title}</span>
        </h2>
      </div>

      {/* Primary Feature Switcher & Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Global AI Controller Agent Trigger */}
        {onOpenAiAgent && (
          <button
            id="header-ai-agent-btn"
            onClick={onOpenAiAgent}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#155eef] via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="LeadHook AI Controller Agent (⌘K)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Agent</span>
          </button>
        )}

        {/* Lead Hunting Agents */}
        <button
          id="header-nav-hunting-agents"
          onClick={() => {
            if (onOpenAgents) onOpenAgents();
            onNavigate('hunting-agents');
          }}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'hunting-agents'
              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
              : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300'
          }`}
          title="Lead Hunting Agents"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Agents</span>
        </button>

        {/* Website Tech Stack Detector */}
        <button
          id="header-nav-tech-detector"
          onClick={() => {
            if (onOpenTechDetector) onOpenTechDetector();
            onNavigate('tech-detector');
          }}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'tech-detector'
              ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-500/20'
              : 'border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/80 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300'
          }`}
          title="Tech Stack Detector"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tech Stack</span>
        </button>

        {/* Waterfall Enrichment */}
        <button
          id="header-nav-waterfall"
          onClick={() => {
            if (onOpenWaterfall) onOpenWaterfall();
            onNavigate('waterfall');
          }}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'waterfall'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
              : 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
          }`}
          title="Waterfall Enrichment"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Waterfall</span>
        </button>

        {/* Inbound Webhooks & Extension */}
        <button
          id="header-nav-inbound"
          onClick={() => {
            if (onOpenInbound) onOpenInbound();
            onNavigate('inbound-gateway');
          }}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'inbound-gateway'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
              : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          }`}
          title="Inbound & Extension"
        >
          <Webhook className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Inbound</span>
        </button>

        {/* Workspace Switcher Button */}
        <button
          id="header-nav-workspace"
          onClick={() => {
            if (onOpenWorkspace) onOpenWorkspace();
            onNavigate('workspaces');
          }}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'workspaces'
              ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20'
              : 'border-purple-200 dark:border-purple-900/60 bg-purple-50/80 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300'
          }`}
          title="Workspaces"
        >
          <Building className="w-3.5 h-3.5" />
          <span className="max-w-[100px] truncate hidden lg:inline">{activeWorkspaceName || 'Workspaces'}</span>
        </button>

        {/* Gemini Active Status Indicator */}
        <StatusIndicator
          status={settings?.has_key ? 'active' : 'warning'}
          label={settings?.has_key ? 'Gemini Active' : 'Set API Key'}
          onClick={() => onNavigate('settings')}
        />

        {/* Settings Button */}
        <button
          id="header-nav-settings"
          onClick={() => onNavigate('settings')}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* Quick Export XLSX */}
        {hasContacts && (
          <GlassButton
            id="header-quick-export-xlsx"
            size="xs"
            variant="secondary"
            onClick={onExportXlsx}
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          >
            Export Excel
          </GlassButton>
        )}

        {/* New Scrape Button */}
        {activeTab !== 'scraper' && (
          <GlassButton
            id="header-new-scrape-btn"
            size="xs"
            variant="primary"
            onClick={() => onNavigate('scraper')}
            icon={<Play className="w-3 h-3 fill-white" />}
          >
            New Scrape
          </GlassButton>
        )}

        <div className="h-4 w-px bg-slate-200/80 dark:bg-slate-800/80 mx-0.5" />

        {/* Theme Toggle */}
        <button
          id="header-theme-toggle-btn"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition cursor-pointer active:scale-95"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* User Account / Profile */}
        <UserProfileButton />
      </div>
    </header>
  );
};
