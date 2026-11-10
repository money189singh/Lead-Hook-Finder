import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { FirstRunModal } from './components/FirstRunModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { LoadingScreen } from './components/LoadingScreen';

import { DashboardPage } from './pages/DashboardPage';
import { GoogleMapsScraperPage } from './pages/GoogleMapsScraperPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { ScraperPage } from './pages/ScraperPage';
import { ResultsPage } from './pages/ResultsPage';
import { EmailVerifierPage } from './pages/EmailVerifierPage';
import { BusinessVerifierPage } from './pages/BusinessVerifierPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { AiControlCenterPage } from './pages/AiControlCenterPage';
import { ResiliencePage } from './pages/ResiliencePage';
import { AboutPage } from './pages/AboutPage';
import { BuyingSignalsRadarPage } from './pages/BuyingSignalsRadarPage';
import { AiSalesStudioPage, AiSalesStudioInitialState } from './pages/AiSalesStudioPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { AlgoSearchPage } from './pages/AlgoSearchPage';
import { SocialDemandRadarPage } from './pages/SocialDemandRadarPage';
import { HuntingAgentsPage } from './pages/HuntingAgentsPage';
import { TechDetectorPage } from './pages/TechDetectorPage';
import { WaterfallPage } from './pages/WaterfallPage';
import { InboundGatewayPage } from './pages/InboundGatewayPage';
import { WorkspacesPage } from './pages/WorkspacesPage';

import { ScrapeJob, ScrapeSettings, HistoryItem, Workspace } from './types';
import { useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { firestoreService } from './lib/firestoreService';
import { AutonomousAgentsModal } from './components/hunting/AutonomousAgentsModal';
import { InboundGatewayModal } from './components/inbound/InboundGatewayModal';
import { WorkspaceSwitcherModal } from './components/workspace/WorkspaceSwitcherModal';
import { TechStackDetectorModal } from './components/tech/TechStackDetectorModal';
import { GlobalToolAgentDrawer } from './components/agent/GlobalToolAgentDrawer';

export default function App() {
  const { user } = useAuth();
  const [isLoadingScreen, setIsLoadingScreen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [aiStudioInitialState, setAiStudioInitialState] = useState<AiSalesStudioInitialState | null>(null);
  const [currentJob, setCurrentJob] = useState<ScrapeJob | null>(null);
  const [settings, setSettings] = useState<ScrapeSettings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showFirstRunModal, setShowFirstRunModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Enterprise Modules Modal States
  const [isAutonomousAgentsOpen, setIsAutonomousAgentsOpen] = useState<boolean>(false);
  const [isInboundGatewayOpen, setIsInboundGatewayOpen] = useState<boolean>(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [isTechDetectorOpen, setIsTechDetectorOpen] = useState<boolean>(false);
  const [isAiAgentDrawerOpen, setIsAiAgentDrawerOpen] = useState<boolean>(false);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>('Main Growth');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('leadhook_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('leadhook_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  const isPollingRef = useRef<boolean>(false);
  const savedJobIdsRef = useRef<Set<string>>(new Set());

  // Helper to add toast notification
  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
      let displayMessage = message;
      // Handle raw JSON errors from Gemini API or RPC calls
      if (typeof message === 'string' && (message.trim().startsWith('{') || message.includes('"error":'))) {
        try {
          const parsed = JSON.parse(message);
          if (parsed?.error?.message) {
            displayMessage = parsed.error.message;
          } else if (parsed?.message) {
            displayMessage = parsed.message;
          }
        } catch {
          // regex fallback
          const msgMatch = message.match(/"message"\s*:\s*"([^"]+)"/);
          if (msgMatch && msgMatch[1]) {
            displayMessage = msgMatch[1];
          }
        }
      }

      // Friendly translation for Gemini quota / 429 errors
      if (
        typeof displayMessage === 'string' &&
        (displayMessage.includes('RESOURCE_EXHAUSTED') ||
          displayMessage.includes('exceeded your current quota') ||
          displayMessage.includes('quota') && displayMessage.includes('429'))
      ) {
        displayMessage =
          'Gemini API Quota Exceeded (429 Rate Limit): Your key reached its temporary request limit. LeadHook automatically activated intelligent fallback radar.';
        type = 'warning';
      }

      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, message: displayMessage, type }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch settings from server & sync with Firestore when user is authenticated
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        // If user is authenticated, check if they have personal Firestore settings
        if (user) {
          try {
            const firestoreSettings = await firestoreService.getUserSettings(user.uid);
            if (firestoreSettings) {
              setSettings({ ...data, ...firestoreSettings });
              if (!data.has_key) {
                setShowFirstRunModal(true);
              }
              return;
            }
          } catch (e) {
            console.warn('Error reading Firestore user settings:', e);
          }
        }
        setSettings(data);
        if (!data.has_key) {
          setShowFirstRunModal(true);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, [user]);

  // Fetch history list from server and Firestore
  const fetchHistory = useCallback(async () => {
    try {
      // If user is signed in, load from their Firestore history
      if (user) {
        try {
          const userHistory = await firestoreService.getUserScrapeHistory(user.uid);
          if (userHistory && userHistory.length > 0) {
            setHistory(userHistory);
            return;
          }
        } catch (e) {
          console.warn('Error fetching Firestore history:', e);
        }
      }

      // Default/fallback: fetch local server history
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, [user]);

  // Fetch job status
  const fetchJobStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scrape/status');
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setCurrentJob(data.job);
        }
      }
    } catch (err) {
      console.error('Error fetching job status:', err);
    }
  }, []);

  // Initial load & Reconnect listener
  useEffect(() => {
    fetchSettings();
    fetchHistory();
    fetchJobStatus();

    const handleOnline = () => {
      fetchJobStatus();
      fetchHistory();
      showToast('Internet reconnected — synced latest status from cloud!', 'success');
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchSettings, fetchHistory, fetchJobStatus]);

  // Polling loop when a job is active or running
  useEffect(() => {
    let interval: any = null;
    const shouldPoll =
      currentJob?.status === 'running' ||
      currentJob?.status === 'paused';

    if (shouldPoll) {
      interval = setInterval(async () => {
        if (!isPollingRef.current) {
          isPollingRef.current = true;
          try {
            const res = await fetch('/api/scrape/status');
            if (res.ok) {
              const data = await res.json();
              if (data.job) {
                setCurrentJob(data.job);
                // If it finished and not yet saved to Firestore in this session
                if (data.job.status === 'completed' && !savedJobIdsRef.current.has(data.job.id)) {
                  savedJobIdsRef.current.add(data.job.id);
                  showToast('Scraping batch completed successfully!', 'success');
                  if (user) {
                    firestoreService
                      .saveUserScrapeJob(user.uid, data.job)
                      .catch((e) => console.warn('Could not save scrape job to Firestore:', e));
                  }
                  fetchHistory();
                }
              }
            }
          } finally {
            isPollingRef.current = false;
          }
        }
      }, 700);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentJob?.status, fetchHistory, showToast]);

  // Actions
  const handleOpenAiStudio = useCallback((state: AiSalesStudioInitialState) => {
    setAiStudioInitialState(state);
    setActiveTab('ai-studio');
  }, []);

  const handleStartScrape = async (urls: string[], jobSettings?: Partial<ScrapeSettings>) => {
    try {
      const res = await fetch('/api/scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, settings: jobSettings }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to start scraping batch', 'error');
        return;
      }
      setCurrentJob(data.job);
      showToast(`Started scraping ${urls.length} website(s)`, 'success');
      setActiveTab('scraper');
    } catch (err: any) {
      showToast(err.message || 'Network error starting scraper', 'error');
    }
  };

  const handlePauseScrape = async () => {
    try {
      await fetch('/api/scrape/pause', { method: 'POST' });
      showToast('Scraping paused', 'warning');
      fetchJobStatus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResumeScrape = async () => {
    try {
      await fetch('/api/scrape/resume', { method: 'POST' });
      showToast('Scraping resumed', 'success');
      fetchJobStatus();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStopScrape = async () => {
    try {
      await fetch('/api/scrape/stop', { method: 'POST' });
      showToast('Scraping stopped', 'info');
      fetchJobStatus();
      fetchHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveSettings = async (updatedSettings: Partial<ScrapeSettings>): Promise<boolean> => {
    try {
      // If user is signed in, persist non-secret settings to Firestore
      if (user) {
        firestoreService
          .saveUserSettings(user.uid, updatedSettings)
          .catch((e) => console.warn('Could not save user settings to Firestore:', e));
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to save settings', 'error');
        return false;
      }
      const data = await res.json();
      setSettings(data);
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleTestKey = async (apiKey: string) => {
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to test key' };
    }
  };

  const handleExportXlsx = async (targetId?: string) => {
    showToast('Generating Excel workbook...', 'info');
    try {
      const url = targetId ? `/api/export/xlsx?datasetId=${encodeURIComponent(targetId)}` : '/api/export/xlsx';
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to export Excel file', 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `leadhook_dataset_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('Excel report downloaded successfully', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handleExportCsv = async (targetId?: string) => {
    showToast('Preparing CSV export...', 'info');
    try {
      const url = targetId ? `/api/export/csv?datasetId=${encodeURIComponent(targetId)}` : '/api/export/csv';
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to export CSV file', 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `leadhook_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      showToast('CSV report downloaded successfully', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handleSelectHistoryJob = async (jobId: string) => {
    try {
      if (user) {
        try {
          const firestoreJob = await firestoreService.getUserJobById(user.uid, jobId);
          if (firestoreJob) {
            setCurrentJob(firestoreJob);
            setActiveTab('results');
            showToast(`Loaded results for job: ${jobId} (from Firestore)`, 'info');
            return;
          }
        } catch (e) {
          console.warn('Could not load job from Firestore, trying local storage:', e);
        }
      }

      const res = await fetch(`/api/history/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setCurrentJob(data.job);
          setActiveTab('results');
          showToast(`Loaded results for job: ${jobId}`, 'info');
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteHistoryJob = async (jobId: string) => {
    try {
      if (user) {
        firestoreService
          .deleteUserJob(user.uid, jobId)
          .catch((e) => console.warn('Could not delete job from Firestore:', e));
      }

      const res = await fetch(`/api/history/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== jobId));
        showToast('History record deleted', 'info');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div
      id="app-root"
      className="min-h-screen bg-[#F8FAFC] dark:bg-[#080C18] text-slate-800 dark:text-slate-100 flex overflow-hidden font-sans antialiased selection:bg-[#155eef]/20 selection:text-[#155eef] dark:selection:text-blue-300 relative transition-colors duration-200"
    >
      {/* Ambient Glass Reflections & Soft Radial Atmospheric Ambient Blobs (15-30s slow ambient drift) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="ambient-blob-1 absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full bg-gradient-to-br from-blue-400/8 via-indigo-300/6 to-transparent blur-[120px] dark:from-blue-600/12 dark:via-indigo-500/8 dark:to-transparent" />
        <div className="ambient-blob-2 absolute top-1/3 -right-40 w-[580px] h-[580px] rounded-full bg-gradient-to-bl from-sky-400/8 via-blue-500/6 to-transparent blur-[110px] dark:from-sky-500/10 dark:via-indigo-600/8 dark:to-transparent" />
        <div className="ambient-blob-3 absolute -bottom-40 left-1/3 w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-indigo-400/6 via-cyan-400/6 to-transparent blur-[100px] dark:from-indigo-600/8 dark:via-blue-500/6 dark:to-transparent" />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentJob={currentJob}
        settings={settings}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Header */}
        <Header
          activeTab={activeTab}
          onNavigate={setActiveTab}
          currentJob={currentJob}
          settings={settings}
          onExportXlsx={() => handleExportXlsx()}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onOpenWorkspace={() => setIsWorkspaceModalOpen(true)}
          onOpenAgents={() => setIsAutonomousAgentsOpen(true)}
          onOpenInbound={() => setIsInboundGatewayOpen(true)}
          onOpenTechDetector={() => setIsTechDetectorOpen(true)}
          onOpenWaterfall={() => setActiveTab('waterfall')}
          onOpenAiAgent={() => setIsAiAgentDrawerOpen(true)}
          activeWorkspaceName={activeWorkspaceName}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto relative">
          {activeTab === 'dashboard' && (
            <DashboardPage
              currentJob={currentJob}
              settings={settings}
              onNavigate={setActiveTab}
              onStartQuickBatch={(urls) => handleStartScrape(urls)}
              onExportXlsx={() => handleExportXlsx()}
            />
          )}

          {activeTab === 'hunting-agents' && (
            <HuntingAgentsPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'tech-detector' && (
            <TechDetectorPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'waterfall' && (
            <WaterfallPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'inbound-gateway' && (
            <InboundGatewayPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'workspaces' && (
            <WorkspacesPage
              onShowToast={showToast}
              onWorkspaceChanged={(ws) => setActiveWorkspaceName(ws.name)}
            />
          )}

          {activeTab === 'google-maps' && (
            <GoogleMapsScraperPage
              settings={settings}
              onShowToast={showToast}
              onImportToScraper={(urls) => handleStartScrape(urls)}
              onNavigateToScraper={() => {
                fetchJobStatus();
                setActiveTab('scraper');
              }}
              onOpenAiStudio={handleOpenAiStudio}
              onNavigateToVerifier={() => setActiveTab('verifier')}
              onNavigateToEmailVerifier={() => setActiveTab('email-verifier')}
            />
          )}

          {activeTab === 'buying-signals' && (
            <BuyingSignalsRadarPage
              settings={settings}
              onShowToast={showToast}
              onNavigateToScraper={() => {
                fetchJobStatus();
                setActiveTab('scraper');
              }}
              onImportToScraper={(urls) => handleStartScrape(urls)}
              onOpenAiStudio={handleOpenAiStudio}
            />
          )}

          {activeTab === 'algo-search' && (
            <AlgoSearchPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
              onExportXlsx={(targetId) => handleExportXlsx(targetId)}
            />
          )}

          {activeTab === 'social-radar' && (
            <SocialDemandRadarPage
              onShowToast={showToast}
              onNavigateToResults={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'discovery' && (
            <DiscoveryPage
              settings={settings}
              onShowToast={showToast}
              onImportToScraper={(urls) => handleStartScrape(urls)}
              onNavigateToScraper={() => {
                fetchJobStatus();
                setActiveTab('scraper');
              }}
              onNavigateToMaps={() => setActiveTab('google-maps')}
              onOpenAiStudio={handleOpenAiStudio}
            />
          )}

          {activeTab === 'ai-studio' && (
            <AiSalesStudioPage
              initialState={aiStudioInitialState}
              currentJob={currentJob}
              history={history}
              onShowToast={showToast}
              onNavigateToDiscovery={(query) => {
                setActiveTab('discovery');
              }}
              onNavigateToGoogleMaps={(query) => {
                setActiveTab('google-maps');
              }}
            />
          )}

          {activeTab === 'workflows' && (
            <WorkflowsPage onShowToast={showToast} />
          )}

          {activeTab === 'scraper' && (
            <ScraperPage
              currentJob={currentJob}
              settings={settings}
              onStartScrape={handleStartScrape}
              onPauseScrape={handlePauseScrape}
              onResumeScrape={handleResumeScrape}
              onStopScrape={handleStopScrape}
              onUpdateSettings={handleSaveSettings}
              onNavigateToResults={() => setActiveTab('results')}
              onNavigateToSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'results' && (
            <ResultsPage
              currentJob={currentJob}
              onExportXlsx={(targetId) => handleExportXlsx(targetId)}
              onExportCsv={(targetId) => handleExportCsv(targetId)}
              onShowToast={showToast}
              settings={settings}
              onUpdateSettings={handleSaveSettings}
              onOpenAiStudio={handleOpenAiStudio}
              onStartScrape={(urls) => handleStartScrape(urls)}
            />
          )}

          {activeTab === 'email-verifier' && (
            <EmailVerifierPage
              currentJob={currentJob}
              onShowToast={showToast}
              onNavigateToScraper={() => setActiveTab('scraper')}
            />
          )}

          {activeTab === 'verifier' && (
            <BusinessVerifierPage
              currentJob={currentJob}
              settings={settings}
              onRefreshJob={fetchJobStatus}
              onUpdateSettings={handleSaveSettings}
              onExportXlsx={() => handleExportXlsx()}
              onExportCsv={() => handleExportCsv()}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'history' && (
            <HistoryPage
              history={history}
              onSelectJob={handleSelectHistoryJob}
              onExportHistoryXlsx={(jobId) => handleExportXlsx(jobId)}
              onDeleteHistory={handleDeleteHistoryJob}
            />
          )}

          {activeTab === 'ai-control' && (
            <AiControlCenterPage
              onShowToast={showToast}
              onProvidersUpdated={fetchSettings}
            />
          )}

          {activeTab === 'resilience' && (
            <ResiliencePage
              currentJob={currentJob}
              settings={settings}
              onShowToast={showToast}
              onRefreshSettings={fetchSettings}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestKey={handleTestKey}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'about' && (
            <AboutPage onReplayLoadingScreen={() => setIsLoadingScreen(true)} />
          )}
        </main>
      </div>

      {/* Cinematic LeadHook Neon Loading Screen */}
      {isLoadingScreen && (
        <LoadingScreen onComplete={() => setIsLoadingScreen(false)} />
      )}

      {/* First-Run Setup Modal */}
      <FirstRunModal
        isOpen={showFirstRunModal}
        onClose={() => setShowFirstRunModal(false)}
        onSaveKey={async (key) => {
          const ok = await handleSaveSettings({ gemini_api_key: key });
          if (ok) {
            showToast('Gemini API key saved successfully!', 'success');
          }
          return ok;
        }}
        onTestKey={handleTestKey}
      />

      {/* Authentication Modal */}
      <AuthModal />

      {/* Autonomous Always-On Lead Hunting Agents Modal */}
      <AutonomousAgentsModal
        isOpen={isAutonomousAgentsOpen}
        onClose={() => setIsAutonomousAgentsOpen(false)}
        onShowToast={showToast}
      />

      {/* Inbound Webhooks & Chrome Extension Gateway Modal */}
      <InboundGatewayModal
        isOpen={isInboundGatewayOpen}
        onClose={() => setIsInboundGatewayOpen(false)}
        onShowToast={showToast}
      />

      {/* Team Collaboration & Multi-Workspace Switcher Modal */}
      <WorkspaceSwitcherModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onShowToast={showToast}
        onWorkspaceChanged={(ws) => setActiveWorkspaceName(ws.name)}
      />

      {/* Website Tech Stack & Tooling Detector Modal */}
      <TechStackDetectorModal
        isOpen={isTechDetectorOpen}
        onClose={() => setIsTechDetectorOpen(false)}
        onShowToast={showToast}
      />

      {/* Global AI Tool Controller Agent Drawer */}
      <GlobalToolAgentDrawer
        isOpen={isAiAgentDrawerOpen}
        onToggle={setIsAiAgentDrawerOpen}
        onNavigate={setActiveTab}
        onRefreshJob={fetchJobStatus}
        onRefreshSettings={fetchSettings}
        onRefreshHistory={fetchHistory}
        onExportXlsx={() => handleExportXlsx()}
        onExportCsv={() => handleExportCsv()}
        onShowToast={showToast}
      />

      {/* Toast System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
