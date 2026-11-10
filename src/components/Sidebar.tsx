import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Compass,
  Users,
  History,
  Settings,
  ShieldCheck,
  Building2,
  Cpu,
  Globe,
  Sparkles,
  LogOut,
  CheckCircle2,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Radio,
  Wand2,
  GitBranch,
  Search,
  Radar,
  Bot,
  Layers,
  Webhook,
  Building,
} from 'lucide-react';
import { ScrapeJob, ScrapeSettings } from '../types';
import { AppLogo } from './AppLogo';
import { useAuth } from '../context/AuthContext';
import { GlassTooltip } from './glass/GlassTooltip';

export type NavTab =
  | 'dashboard'
  | 'hunting-agents'
  | 'algo-search'
  | 'social-radar'
  | 'tech-detector'
  | 'waterfall'
  | 'inbound-gateway'
  | 'discovery'
  | 'buying-signals'
  | 'ai-studio'
  | 'workflows'
  | 'google-maps'
  | 'scraper'
  | 'results'
  | 'email-verifier'
  | 'verifier'
  | 'history'
  | 'workspaces'
  | 'ai-control'
  | 'resilience'
  | 'settings'
  | 'about';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentJob: ScrapeJob | null;
  settings: ScrapeSettings | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentJob,
  settings,
  isCollapsed: externalCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const { user, userProfile, loginWithGoogle, logout } = useAuth();
  const isScraping = currentJob?.status === 'running';
  const contactsCount = currentJob?.contacts?.length || 0;

  const [miniStorage, setMiniStorage] = useState<{ usedFormatted: string; totalFormatted: string; pct: number } | null>(null);

  useEffect(() => {
    fetch('/api/sql/storage-info')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.success) {
          const usedMb = (data.used_bytes / (1024 * 1024)).toFixed(1);
          setMiniStorage({
            usedFormatted: `${usedMb} MB`,
            totalFormatted: '500 MB',
            pct: Math.min(100, Math.max(1, (data.used_bytes / data.total_quota_bytes) * 100)),
          });
        }
      })
      .catch(() => {});
  }, [activeTab]);

  const sections = [
    {
      title: 'Lead Gen',
      items: [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'hunting-agents' as NavTab, label: 'Lead Hunting Agents', icon: Bot, tag: '24/7' },
        { id: 'tech-detector' as NavTab, label: 'Tech Stack Detector', icon: Cpu, tag: 'BUILTWITH' },
        { id: 'waterfall' as NavTab, label: 'Waterfall Enrichment', icon: Layers, tag: 'PHONE' },
        { id: 'inbound-gateway' as NavTab, label: 'Inbound & Extension', icon: Webhook, tag: '1-CLICK' },
        { id: 'algo-search' as NavTab, label: 'Algo Search Engine', icon: Search, tag: 'APOLLO' },
        { id: 'social-radar' as NavTab, label: 'Social Demand Radar', icon: Radar, tag: 'HOT' },
        { id: 'discovery' as NavTab, label: 'AI Prospect Discovery', icon: Sparkles, tag: 'AI' },
        { id: 'ai-studio' as NavTab, label: 'AI Sales Copilot', icon: Wand2, tag: 'COPILOT' },
        { id: 'workflows' as NavTab, label: 'AI Workflows (n8n)', icon: GitBranch, tag: 'AUTO' },
        { id: 'buying-signals' as NavTab, label: 'Buying Signals Radar', icon: Radio, tag: 'RADAR' },
        { id: 'google-maps' as NavTab, label: 'Google Maps Scraper', icon: MapPin },
        { id: 'scraper' as NavTab, label: 'Website Scraper', icon: Compass, isLive: isScraping },
        {
          id: 'results' as NavTab,
          label: 'Leads & Results',
          icon: Users,
          count: contactsCount > 0 ? String(contactsCount) : undefined,
        },
      ],
    },
    {
      title: 'Verification',
      items: [
        { id: 'email-verifier' as NavTab, label: 'Email Verifier', icon: ShieldCheck },
        { id: 'verifier' as NavTab, label: 'Business Verifier', icon: Building2 },
        { id: 'history' as NavTab, label: 'Scrape History', icon: History },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'workspaces' as NavTab, label: 'Team Workspaces', icon: Building, tag: 'TEAM' },
        { id: 'ai-control' as NavTab, label: 'AI Control Center', icon: Cpu },
        { id: 'resilience' as NavTab, label: 'Proxy & Resilience', icon: Globe },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className={`relative m-3 mr-0 h-[calc(100vh-24px)] glass-panel rounded-2xl flex flex-col justify-between select-none shrink-0 z-30 transition-all duration-300 ease-out shadow-lg ${
        isCollapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div
          className={`h-16 border-b border-white/60 dark:border-white/5 flex items-center ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          }`}
        >
          {isCollapsed ? (
            <GlassTooltip content="Click to expand sidebar" position="right">
              <button
                onClick={toggleCollapse}
                className="p-1 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition cursor-pointer group flex items-center justify-center"
                title="Expand navigation sidebar"
              >
                <AppLogo size={32} withContainer className="shadow-xs shrink-0 transition-transform duration-200 group-hover:scale-105" />
              </button>
            </GlassTooltip>
          ) : (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <AppLogo size={32} withContainer className="shadow-xs shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white block leading-none truncate">
                    LeadHook
                  </span>
                </div>
              </div>

              <button
                onClick={toggleCollapse}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Grouped Navigation */}
        <div className="p-2 space-y-3 pt-3">
          {sections.map((section, sIdx) => (
            <div key={section.title} className="space-y-1">
              {isCollapsed ? (
                sIdx > 0 && <div className="w-8 h-px bg-slate-200/60 dark:bg-white/10 mx-auto my-2" />
              ) : (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                const buttonContent = (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => onSelectTab(item.id)}
                    className={`group ${
                      isCollapsed
                        ? 'w-10 h-10 mx-auto flex items-center justify-center rounded-xl'
                        : 'w-full flex items-center justify-between px-2.5 py-2 rounded-xl'
                    } text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-white/95 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-xs border border-white/80 dark:border-white/10 shadow-blue-500/5'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                          isCollapsed ? 'group-hover:scale-110' : 'group-hover:translate-x-0.5'
                        } ${
                          isActive
                            ? 'text-[#155eef] dark:text-blue-400 drop-shadow-[0_0_8px_rgba(21,94,239,0.35)]'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                        }`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isLive && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        )}
                        {item.count && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.count}
                          </span>
                        )}
                        {item.tag && (
                          <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            {item.tag}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );

                if (isCollapsed) {
                  return (
                    <div key={item.id} className="w-full flex justify-center py-0.5">
                      <GlassTooltip content={item.label} position="right">
                        {buttonContent}
                      </GlassTooltip>
                    </div>
                  );
                }

                return buttonContent;
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Area */}
      <div className="p-2 border-t border-white/60 dark:border-white/5 space-y-2">
        {/* Live Scrape Progress Indicator */}
        {isScraping && currentJob && (
          <div className={`p-2 rounded-xl glass-panel-subtle ${isCollapsed ? 'text-center' : 'space-y-1'}`}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {!isCollapsed && 'Scraping'}
              </span>
              {!isCollapsed && (
                <span className="font-mono text-slate-500 text-[10px]">
                  {currentJob.completed_websites + currentJob.failed_websites}/{currentJob.total_websites}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="w-full h-1 bg-slate-200/50 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#155eef] to-cyan-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      currentJob.total_websites > 0
                        ? Math.min(
                            100,
                            Math.round(
                              ((currentJob.completed_websites + currentJob.failed_websites) /
                                currentJob.total_websites) *
                                100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Mini Apple Cloud Storage Widget */}
        {isCollapsed ? (
          <GlassTooltip content={`Cloud Storage: ${miniStorage?.usedFormatted || '2.2 MB'} / 500 MB (Click to view)`} position="right">
            <button
              onClick={() => onSelectTab('results')}
              className="w-10 h-10 mx-auto rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 flex items-center justify-center transition cursor-pointer"
              title="Cloud Storage & Database"
            >
              <Cloud className="w-4 h-4 text-blue-500" />
            </button>
          </GlassTooltip>
        ) : (
          <button
            onClick={() => onSelectTab('results')}
            className="w-full p-2.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all text-left group cursor-pointer"
            title="Cloud Storage & SQLite Database — click to manage files"
          >
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                <span>Cloud Storage</span>
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">
                {miniStorage?.usedFormatted || '2.2 MB'} / 500 MB
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
              <div className="h-full bg-[#007AFF] w-[35%]" title="Google Maps" />
              <div className="h-full bg-[#34C759] w-[45%]" title="AI Discovery" />
              <div className="h-full bg-[#FF9500] w-[15%]" title="Website Scraper" />
              <div className="h-full bg-[#FF2D55] w-[5%]" title="AI Organized" />
            </div>
          </button>
        )}

        {/* User Account / Sign In */}
        {user ? (
          <div
            className={`p-1.5 rounded-xl glass-panel-subtle flex items-center ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            {isCollapsed ? (
              <GlassTooltip content={`${userProfile?.displayName || user.displayName || user.email} (Sign out)`} position="right">
                <button
                  onClick={() => logout()}
                  title="Sign Out"
                  className="cursor-pointer transition-transform hover:scale-105"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userProfile?.displayName || user.displayName || 'User'}
                      className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-blue-500/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#155eef] to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {((userProfile?.displayName || user.displayName || user.email || 'U').charAt(0)).toUpperCase()}
                    </div>
                  )}
                </button>
              </GlassTooltip>
            ) : (
              <>
                <div className="flex items-center gap-2 overflow-hidden">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userProfile?.displayName || user.displayName || 'User'}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#155eef] to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {((userProfile?.displayName || user.displayName || user.email || 'U').charAt(0)).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden text-left">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {userProfile?.displayName || user.displayName || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Cloud Synced</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  title="Sign Out"
                  className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ) : isCollapsed ? (
          <GlassTooltip content="Connect Google Cloud" position="right">
            <button
              id="sidebar-google-signin-btn"
              onClick={() => loginWithGoogle()}
              className="w-10 h-10 mx-auto rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer active:scale-95"
              title="Connect Google Cloud Firestore"
            >
              <Cloud className="w-4 h-4 text-[#155eef]" />
            </button>
          </GlassTooltip>
        ) : (
          <button
            id="sidebar-google-signin-btn"
            onClick={() => loginWithGoogle()}
            className="w-full py-2 px-2.5 rounded-xl glass-panel-subtle hover:bg-white/80 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
            title="Connect Google Cloud Firestore"
          >
            <Cloud className="w-3.5 h-3.5 text-[#155eef]" />
            <span>Connect Cloud</span>
          </button>
        )}
      </div>
    </aside>
  );
};
