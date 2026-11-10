import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Calendar,
  Zap,
  Building2,
  DollarSign,
  Users,
  X,
  ExternalLink,
  Timer,
  ChevronRight,
  ShieldCheck,
  Minus,
  Briefcase,
  Check,
  TrendingUp,
  FileSpreadsheet,
  Table,
  Cloud,
  Copy,
  Terminal,
  Radio,
  Key,
  Globe,
  Server,
} from 'lucide-react';
import { RecurringSchedule, ScheduleRunLog, DiscoveryCriteria, GoogleSheetsColumnMapping } from '../../types';
import { GoogleSheetsScheduleSelector } from './GoogleSheetsScheduleSelector';
import { triggerScheduleGoogleSheetsSync, checkGoogleSheetsConnection } from '../../lib/googleAuthHelper';

interface ScheduledScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCriteria?: DiscoveryCriteria;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onViewJob?: (jobId: string) => void;
  initialTab?: 'schedules' | 'new' | 'runs' | 'cloud';
}

export const ScheduledScraperModal: React.FC<ScheduledScraperModalProps> = ({
  isOpen,
  onClose,
  currentCriteria,
  onShowToast,
  onViewJob,
  initialTab = 'schedules',
}) => {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [runs, setRuns] = useState<ScheduleRunLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedules' | 'new' | 'runs' | 'cloud'>(initialTab);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [syncingScheduleId, setSyncingScheduleId] = useState<string | null>(null);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudTestResult, setCloudTestResult] = useState<any>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // cron-job.org 1-Click integration state
  const [cronJobOrgStatus, setCronJobOrgStatus] = useState<any>(null);
  const [cronJobOrgApiKey, setCronJobOrgApiKey] = useState('');
  const [cronJobOrgInterval, setCronJobOrgInterval] = useState<number>(60);
  const [isConnectingCronJobOrg, setIsConnectingCronJobOrg] = useState(false);
  const [isDisconnectingCronJobOrg, setIsDisconnectingCronJobOrg] = useState(false);

  // New Schedule Form State
  const [formName, setFormName] = useState('Hourly B2B SaaS Startups & Funding Triggers');
  const [selectedHours, setSelectedHours] = useState<number>(1);
  const [formCadence, setFormCadence] = useState<RecurringSchedule['cadence']>('hourly');
  const [formTimeOfDay, setFormTimeOfDay] = useState('08:00');
  const [formTargetCount, setFormTargetCount] = useState(20);
  const [formAutoEnrich, setFormAutoEnrich] = useState(true);
  const [startImmediately, setStartImmediately] = useState(true);

  // Google Sheets Auto-Sync per-schedule state
  const [googleSheetsEnabled, setGoogleSheetsEnabled] = useState(false);
  const [googleSpreadsheetId, setGoogleSpreadsheetId] = useState('');
  const [googleSpreadsheetName, setGoogleSpreadsheetName] = useState('');
  const [googleSheetId, setGoogleSheetId] = useState<number>(0);
  const [googleSheetName, setGoogleSheetName] = useState('Leads');
  const [googleSheetsMapping, setGoogleSheetsMapping] = useState<Partial<GoogleSheetsColumnMapping>>({});
  const [connectedUserEmail, setConnectedUserEmail] = useState('');
  const [formCriteria, setFormCriteria] = useState<DiscoveryCriteria>(
    currentCriteria || {
      industry: 'B2B SaaS',
      country: 'United States',
      jobTitle: 'Founder, CEO, VP of Sales',
      companyScale: 'startups',
      excludeMegaCaps: true,
      buyingSignalFilter: 'any_signal',
      freshnessMode: 'new_only',
      excludePreviouslyDiscovered: true,
      targetCount: 20,
      maxPagesPerCompany: 3,
      maxQueries: 15,
      autoExtractContacts: true,
      includeGenericEmails: true,
    }
  );

  useEffect(() => {
    if (isOpen) {
      fetchSchedulesAndRuns();
      fetchCronJobOrgStatus();
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (currentCriteria) {
        setFormCriteria(currentCriteria);
        if (currentCriteria.industry) {
          setFormName(`Hourly ${currentCriteria.industry} Prospects Pipeline`);
        }
      }
    }
  }, [isOpen, initialTab, currentCriteria]);

  const fetchSchedulesAndRuns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
        setRuns(data.runs || []);
      }
    } catch (err: any) {
      console.warn('Failed to fetch schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (schedule: RecurringSchedule) => {
    try {
      const res = await fetch(`/api/schedules/${schedule.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? data.schedule : s)));
        onShowToast(
          `Schedule ${data.schedule.enabled ? 'activated' : 'paused'}: ${data.schedule.name}`,
          'success'
        );
      }
    } catch {
      onShowToast('Failed to toggle schedule', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled discovery pipeline?')) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        onShowToast('Schedule deleted', 'info');
      }
    } catch {
      onShowToast('Failed to delete schedule', 'error');
    }
  };

  const handleRunNow = async (id: string) => {
    setTriggeringId(id);
    try {
      const res = await fetch(`/api/schedules/${id}/run-now`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        onShowToast('Scheduled discovery pipeline launched in background!', 'success');
        fetchSchedulesAndRuns();
        if (data.runLog?.jobId && onViewJob) {
          onViewJob(data.runLog.jobId);
          onClose();
        }
      } else {
        onShowToast('Failed to trigger schedule', 'error');
      }
    } catch {
      onShowToast('Error triggering schedule', 'error');
    } finally {
      setTriggeringId(null);
    }
  };

  const handleSyncGoogleSheets = async (schedule: RecurringSchedule) => {
    setSyncingScheduleId(schedule.id);
    try {
      onShowToast(`Syncing leads to "${schedule.googleSpreadsheetName || 'Google Sheets'}"...`, 'info');
      const res = await triggerScheduleGoogleSheetsSync(schedule.id);
      if (res.success || res.stats?.status === 'Completed') {
        const added = res.stats?.recordsAdded ?? 0;
        const updated = res.stats?.recordsUpdated ?? 0;
        onShowToast(
          `Google Sheets synced successfully! (+${added} added, ~${updated} updated)`,
          'success'
        );
        fetchSchedulesAndRuns();
      } else {
        onShowToast(res.stats?.error || 'Failed to sync to Google Sheets', 'error');
        fetchSchedulesAndRuns();
      }
    } catch (err: any) {
      onShowToast(err.message || 'Google Sheets sync error', 'error');
    } finally {
      setSyncingScheduleId(null);
    }
  };

  const handleTestCloudTrigger = async () => {
    setIsTestingCloud(true);
    setCloudTestResult(null);
    try {
      onShowToast('Testing Cloud Cron Webhook autonomously in background...', 'info');
      const res = await fetch('/api/scheduler/cron-tick?force=true', { method: 'POST' });
      const data = await res.json();
      setCloudTestResult(data);
      if (data.success) {
        onShowToast(data.message || 'Cloud Cron Webhook verified successfully!', 'success');
        fetchSchedulesAndRuns();
      } else {
        onShowToast(data.error || 'Cloud webhook returned an issue', 'error');
      }
    } catch (e: any) {
      onShowToast(e.message || 'Failed to trigger cloud webhook', 'error');
    } finally {
      setIsTestingCloud(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/api/scheduler/cron-tick` : '/api/scheduler/cron-tick';
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    onShowToast('Cloud Cron Webhook URL copied to clipboard!', 'success');
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const fetchCronJobOrgStatus = async () => {
    try {
      const res = await fetch('/api/schedules/cronjob-org');
      if (res.ok) {
        const data = await res.json();
        setCronJobOrgStatus(data);
        if (data.cadenceMinutes) {
          setCronJobOrgInterval(data.cadenceMinutes);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cronjob-org status:', err);
    }
  };

  const handleConnectCronJobOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronJobOrgApiKey.trim()) {
      onShowToast('Please enter your cron-job.org API Key', 'error');
      return;
    }
    setIsConnectingCronJobOrg(true);
    try {
      const res = await fetch('/api/schedules/cronjob-org/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cronJobOrgApiKey.trim(),
          cadenceMinutes: cronJobOrgInterval,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to connect to cron-job.org');
      }
      onShowToast(data.message || '24/7 Cloud Autopilot successfully connected to cron-job.org!', 'success');
      setCronJobOrgApiKey('');
      fetchCronJobOrgStatus();
      fetchSchedulesAndRuns();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsConnectingCronJobOrg(false);
    }
  };

  const handleDisconnectCronJobOrg = async () => {
    if (!window.confirm('Are you sure you want to disconnect cron-job.org? Scheduled cloud triggers will stop.')) return;
    setIsDisconnectingCronJobOrg(true);
    try {
      const res = await fetch('/api/schedules/cronjob-org/disconnect', { method: 'POST' });
      if (res.ok) {
        onShowToast('Disconnected from cron-job.org', 'info');
        fetchCronJobOrgStatus();
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsDisconnectingCronJobOrg(false);
    }
  };

  const handleHourPresetClick = (hours: number) => {
    setSelectedHours(hours);
    if (hours === 1) {
      setFormCadence('hourly');
    } else if (hours === 2) {
      setFormCadence('every_2_hours');
    } else if (hours === 3) {
      setFormCadence('every_3_hours');
    } else if (hours === 4) {
      setFormCadence('every_4_hours');
    } else if (hours === 6) {
      setFormCadence('every_6_hours');
    } else if (hours === 8) {
      setFormCadence('every_8_hours');
    } else if (hours === 12) {
      setFormCadence('every_12_hours');
    } else if (hours === 24) {
      setFormCadence('daily');
    } else {
      setFormCadence('custom_hours');
    }
  };

  const handleCustomHourStep = (delta: number) => {
    const next = Math.max(1, Math.min(168, selectedHours + delta));
    handleHourPresetClick(next);
  };

  const getComputedCustomHours = (cadence: RecurringSchedule['cadence']) => {
    if (cadence === 'hourly') return 1;
    if (cadence === 'every_2_hours') return 2;
    if (cadence === 'every_3_hours') return 3;
    if (cadence === 'every_4_hours') return 4;
    if (cadence === 'every_6_hours') return 6;
    if (cadence === 'every_8_hours') return 8;
    if (cadence === 'every_12_hours') return 12;
    if (cadence === 'daily') return 24;
    if (cadence === 'every_2_days') return 48;
    if (cadence === 'weekly') return 168;
    return Math.max(1, selectedHours);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onShowToast('Please enter a schedule name', 'error');
      return;
    }

    try {
      const payload = {
        name: formName.trim(),
        cadence: formCadence,
        customHours: getComputedCustomHours(formCadence),
        timeOfDayUtc: formTimeOfDay,
        targetCount: formTargetCount,
        autoEnrichWebsite: formAutoEnrich,
        startImmediately,
        googleSheetsEnabled,
        googleSpreadsheetId: googleSheetsEnabled ? googleSpreadsheetId : undefined,
        googleSpreadsheetName: googleSheetsEnabled ? googleSpreadsheetName : undefined,
        googleSheetId: googleSheetsEnabled ? googleSheetId : undefined,
        googleSheetName: googleSheetsEnabled ? googleSheetName : undefined,
        googleSheetsMapping: googleSheetsEnabled ? googleSheetsMapping : undefined,
        connectedUserEmail: googleSheetsEnabled ? connectedUserEmail : undefined,
        criteria: {
          ...formCriteria,
          targetCount: formTargetCount,
          freshnessMode: 'new_only',
          excludePreviouslyDiscovered: true,
          excludeMegaCaps: formCriteria.excludeMegaCaps ?? true,
        },
      };

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSchedules((prev) => [data.schedule, ...prev]);
        setActiveTab('schedules');
        onShowToast(`Created recurring schedule: "${data.schedule.name}"`, 'success');
      } else {
        onShowToast('Failed to create schedule', 'error');
      }
    } catch {
      onShowToast('Error creating schedule', 'error');
    }
  };

  const formatCadenceLabel = (cadence: RecurringSchedule['cadence'], customHours?: number) => {
    switch (cadence) {
      case 'hourly':
        return 'Every 1 Hour';
      case 'every_2_hours':
        return 'Every 2 Hours';
      case 'every_3_hours':
        return 'Every 3 Hours';
      case 'every_4_hours':
        return 'Every 4 Hours';
      case 'every_6_hours':
        return 'Every 6 Hours';
      case 'every_8_hours':
        return 'Every 8 Hours';
      case 'every_12_hours':
        return 'Every 12 Hours';
      case 'daily':
        return 'Daily (24 Hours)';
      case 'every_2_days':
        return 'Every 2 Days (48 Hours)';
      case 'weekly':
        return 'Weekly (7 Days)';
      case 'custom_hours':
        return `Every ${customHours || 1} Hour${(customHours || 1) > 1 ? 's' : ''}`;
      default:
        return cadence;
    }
  };

  const formatNextRunRelative = (isoString?: string) => {
    if (!isoString) return 'Pending';
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs <= 0) return 'Due now';
    const diffMins = Math.round(diffMs / (60 * 1000));
    if (diffMins < 60) return `in ${diffMins}m`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours}h`;
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-blue-950/20 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#155eef] via-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  Auto-Recurring Scraper & Scheduled Discovery
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Autopilot Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Discovers fresh companies on hourly intervals with automatic cross-job deduplication.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 ml-3"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-white/10 shrink-0 gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 border border-slate-300/40 dark:border-white/5 text-xs">
            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schedules'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-white/60 dark:border-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Active Schedules</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {schedules.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-gradient-to-r from-[#155eef] to-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('runs')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'runs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-white/60 dark:border-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>History</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {runs.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'cloud'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                  : 'text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40'
              }`}
              title="Autonomous 24/7 execution even when laptop is turned off or in sleep mode"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>24/7 Cloud</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-white/20 text-white uppercase tracking-wider">
                Laptop Off
              </span>
            </button>
          </div>

          <button
            onClick={fetchSchedulesAndRuns}
            disabled={isLoading}
            className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Refresh active schedules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {/* TAB 1: ACTIVE SCHEDULES */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 p-8">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#155eef] flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Active Schedules Configured</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                    Set up an hourly or recurring pipeline to automatically discover fresh startups, track funding rounds, and extract verified decision-makers on autopilot.
                  </p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 transition inline-flex items-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Plus className="w-4 h-4" /> Create First Schedule
                  </button>
                </div>
              ) : (
                schedules.map((schedule) => {
                  const isTriggering = triggeringId === schedule.id;
                  const nextRunRelative = formatNextRunRelative(schedule.nextRunAt);
                  const nextRunFull = schedule.nextRunAt
                    ? new Date(schedule.nextRunAt).toLocaleString()
                    : 'Pending';

                  return (
                    <div
                      key={schedule.id}
                      className="p-5 rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-slate-800/50 backdrop-blur-md hover:border-blue-400/80 dark:hover:border-blue-700/60 shadow-xs hover:shadow-md transition-all space-y-3.5"
                    >
                      {/* Top Header Row: Status, Name, Cadence Chip, and Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              schedule.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
                            }`}
                            title={schedule.enabled ? 'Active & Running' : 'Paused'}
                          />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {schedule.name}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#155eef] dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 flex items-center gap-1 shrink-0">
                            <Timer className="w-3 h-3 text-[#155eef]" />
                            {formatCadenceLabel(schedule.cadence, schedule.customHours)}
                          </span>
                        </div>

                        {/* Action buttons with clear spacing */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {schedule.googleSheetsEnabled && (
                            <button
                              onClick={() => handleSyncGoogleSheets(schedule)}
                              disabled={syncingScheduleId === schedule.id}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                              title="Push and synchronize all leads for this schedule to Google Sheets now"
                            >
                              <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-600 ${syncingScheduleId === schedule.id ? 'animate-spin' : ''}`} />
                              <span>{syncingScheduleId === schedule.id ? 'Syncing...' : 'Sync to Sheets'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleRunNow(schedule.id)}
                            disabled={isTriggering}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Execute this discovery schedule right now"
                          >
                            <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
                            <span>{isTriggering ? 'Running...' : 'Run Now'}</span>
                          </button>

                          <button
                            onClick={() => handleToggle(schedule)}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                              schedule.enabled
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 hover:bg-amber-100'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100'
                            }`}
                            title={schedule.enabled ? 'Pause schedule' : 'Activate schedule'}
                          >
                            {schedule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{schedule.enabled ? 'Pause' : 'Activate'}</span>
                          </button>

                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 rounded-xl transition cursor-pointer active:scale-95"
                            title="Delete schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Criteria Tags Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {schedule.criteria.industry || 'All Tech & SaaS'}
                        </span>

                        {schedule.criteria.jobTitle && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/5 flex items-center gap-1 truncate max-w-[200px]">
                            <Briefcase className="w-3 h-3 text-slate-400" />
                            {schedule.criteria.jobTitle}
                          </span>
                        )}

                        {schedule.googleSheetsEnabled && schedule.googleSpreadsheetId ? (
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${schedule.googleSpreadsheetId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/60 flex items-center gap-1.5 hover:underline"
                            title={`Syncs to: ${schedule.googleSpreadsheetName || 'Spreadsheet'} -> ${schedule.googleSheetName || 'Leads'}`}
                          >
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="truncate max-w-[170px]">{schedule.googleSpreadsheetName || 'Google Sheet'} ({schedule.googleSheetName || 'Leads'})</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-white/5">
                            Sheets Sync: Off
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Fresh (Cross-Job Deduped)
                        </span>
                      </div>

                      {/* Clean 4-Column Metric Grid with min-widths & no wrapping collision */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">
                            Batch Frequency
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs mt-0.5 block truncate">
                            {formatCadenceLabel(schedule.cadence, schedule.customHours)}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">
                            Target / Batch
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs mt-0.5 block">
                            {schedule.targetCount} Prospects
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">
                            Total Discovered
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs mt-0.5 block">
                            +{schedule.totalProspectsFound} Leads
                          </span>
                        </div>

                        <div
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5"
                          title={`Next run: ${nextRunFull}`}
                        >
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">
                            Next Run
                          </span>
                          <span className="text-[#155eef] dark:text-blue-400 font-semibold text-xs mt-0.5 block truncate">
                            {schedule.enabled ? nextRunRelative : 'Paused'}
                          </span>
                        </div>
                      </div>

                      {/* Footer Info Row */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <span>
                            Total Executions: <b className="text-slate-700 dark:text-slate-200">{schedule.totalRuns}</b>
                          </span>
                          {schedule.lastRunAt && (
                            <span>
                              Last Executed: {new Date(schedule.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {schedule.lastRunStatus && (
                          <div className="flex items-center gap-2">
                            {schedule.googleSheetsEnabled && schedule.lastGoogleSheetsSync && (
                              schedule.lastGoogleSheetsSync.status === 'Completed' ? (
                                <a
                                  href={schedule.lastGoogleSheetsSync.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${schedule.googleSpreadsheetId}/edit`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 hover:underline"
                                  title={`Google Sheets: +${schedule.lastGoogleSheetsSync.recordsAdded} new, ~${schedule.lastGoogleSheetsSync.recordsUpdated} updated. Click to open.`}
                                >
                                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    Sheets: +{schedule.lastGoogleSheetsSync.recordsAdded} added, ~{schedule.lastGoogleSheetsSync.recordsUpdated} updated
                                  </span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </a>
                              ) : schedule.lastGoogleSheetsSync.status === 'Authentication Required' ? (
                                <button
                                  onClick={() => handleSyncGoogleSheets(schedule)}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300/60 hover:bg-rose-100 cursor-pointer"
                                  title="Google authorization expired. Click to 1-Click Reconnect & Sync Now"
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>Sheets Auth Expired: Reconnect & Sync</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSyncGoogleSheets(schedule)}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300/60 hover:bg-amber-100 cursor-pointer"
                                  title={schedule.lastGoogleSheetsSync.error || 'Sync issue'}
                                >
                                  <FileSpreadsheet className="w-3 h-3 text-amber-600" />
                                  <span>Sheets: Retry Sync</span>
                                </button>
                              )
                            )}
                            <div className="flex items-center gap-1">
                              <span>Status:</span>
                              <span
                                className={`font-semibold capitalize ${
                                  schedule.lastRunStatus === 'success'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : schedule.lastRunStatus === 'running'
                                    ? 'text-blue-500 animate-pulse'
                                    : 'text-rose-500'
                                }`}
                              >
                                {schedule.lastRunStatus} ({schedule.lastRunProspectsCount || 0} leads)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: CREATE NEW SCHEDULE (WITH HOURLY SELECTOR) */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateSchedule} className="space-y-6">
              {/* Informative Header Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/20 flex items-start gap-3.5 text-xs text-blue-900 dark:text-blue-200">
                <div className="w-8 h-8 rounded-xl bg-[#155eef] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs mb-0.5">
                    Autonomous AI Prospecting Engine
                  </h5>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    The scheduled engine maintains a persistent cross-job deduplication ledger. Each time it triggers on an hourly interval, it filters out all previously discovered domains and surfaces brand-new verified companies.
                  </p>
                </div>
              </div>

              {/* Section 1: Schedule Name */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Pipeline Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hourly B2B SaaS Startups & Funding Triggers"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#155eef]/20 focus:border-[#155eef]"
                  required
                />
              </div>

              {/* Section 2: Hourly Cadence Selector */}
              <div className="p-4.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-[#155eef]" />
                      <span>Choose Schedule Hourly Basis (e.g. after 1 hour, 2 hours, etc.)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Select how frequently the autonomous AI engine should scrape & discover new prospects.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#155eef] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200/80 dark:border-blue-900/40 shrink-0 self-start sm:self-auto">
                    Repeats every {selectedHours} {selectedHours === 1 ? 'hour' : 'hours'} ({Math.round(24 / selectedHours) || 1}x / day)
                  </span>
                </div>

                {/* Quick Hourly Presets Grid */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                    <span>Hourly Presets:</span>
                    <span className="text-[10px] text-slate-400">Click any preset or adjust below</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { hours: 1, label: 'After 1 Hour', sub: '24 batches/day (Real-time)' },
                      { hours: 2, label: 'After 2 Hours', sub: '12 batches/day' },
                      { hours: 3, label: 'After 3 Hours', sub: '8 batches/day' },
                      { hours: 4, label: 'After 4 Hours', sub: '6 batches/day' },
                      { hours: 6, label: 'After 6 Hours', sub: '4 batches/day' },
                      { hours: 8, label: 'After 8 Hours', sub: '3 batches/day' },
                      { hours: 12, label: 'After 12 Hours', sub: 'Twice daily' },
                      { hours: 24, label: 'After 24 Hours', sub: 'Once daily' },
                    ].map((preset) => {
                      const isSelected = selectedHours === preset.hours && formCadence !== 'daily';
                      return (
                        <button
                          key={preset.hours}
                          type="button"
                          onClick={() => handleHourPresetClick(preset.hours)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#155eef] text-white border-[#155eef] shadow-md shadow-blue-500/20'
                              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold">{preset.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span
                            className={`text-[10px] mt-1 ${
                              isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {preset.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fluid Hourly Slider & Interactive Stepper */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Custom Hourly Interval Stepper
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Drag the slider or use +/- to set any exact hour (e.g. 1 hour, 2 hours, 5 hours, etc.)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCustomHourStep(-1)}
                        disabled={selectedHours <= 1}
                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                        title="Decrease 1 hour"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {selectedHours}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {selectedHours === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCustomHourStep(1)}
                        disabled={selectedHours >= 168}
                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                        title="Increase 1 hour"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Range Slider for immediate tactile control */}
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="range"
                      min="1"
                      max="48"
                      step="1"
                      value={Math.min(48, selectedHours)}
                      onChange={(e) => handleHourPresetClick(parseInt(e.target.value, 10))}
                      className="w-full accent-[#155eef] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>1h (Hourly)</span>
                      <span>6h</span>
                      <span>12h</span>
                      <span>24h (Daily)</span>
                      <span>48h (2 Days)</span>
                    </div>
                  </div>

                  {/* Quick Hour Pill Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 mr-1">Quick Select:</span>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 48].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHourPresetClick(h)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                          selectedHours === h
                            ? 'bg-[#155eef] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timing & First Run Execution Mode */}
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    First Run Execution Timing:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                        startImmediately
                          ? 'bg-white dark:bg-slate-900 border-[#155eef] shadow-xs text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="timingOption"
                        checked={startImmediately}
                        onChange={() => setStartImmediately(true)}
                        className="text-[#155eef] focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span>⚡ Run 1st Batch Immediately</span>
                        <span className="block text-[10px] text-slate-400 font-normal">
                          Starts now, then repeats every {selectedHours} {selectedHours === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                        !startImmediately
                          ? 'bg-white dark:bg-slate-900 border-[#155eef] shadow-xs text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="timingOption"
                        checked={!startImmediately}
                        onChange={() => setStartImmediately(false)}
                        className="text-[#155eef] focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span>⏱️ Wait {selectedHours} {selectedHours === 1 ? 'Hour' : 'Hours'} Before 1st Run</span>
                        <span className="block text-[10px] text-slate-400 font-normal">
                          First execution starts after {selectedHours} {selectedHours === 1 ? 'hour' : 'hours'}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Live Forecast Calculation Box */}
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <b>24-Hour Discovery Forecast:</b> ~{Math.max(1, Math.round(24 / selectedHours))} automated batches targeting ~<b>{Math.max(1, Math.round(24 / selectedHours)) * formTargetCount} verified prospects</b> / day with automatic deduplication.
                    </span>
                  </div>
                </div>

                {/* Daily Preferred Time UTC (Only if 24 hours selected) */}
                {formCadence === 'daily' && (
                  <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Preferred Daily Run Time (UTC):
                    </span>
                    <input
                      type="time"
                      value={formTimeOfDay}
                      onChange={(e) => setFormTimeOfDay(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                    />
                  </div>
                )}
              </div>

              {/* Section 3: Target Criteria & Filtering */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#155eef]" />
                    Target Industry & Criteria
                  </h5>
                  <span className="text-[11px] text-slate-400">Refines what companies get discovered</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Industry / Sector
                    </label>
                    <input
                      type="text"
                      value={formCriteria.industry || ''}
                      onChange={(e) => setFormCriteria({ ...formCriteria, industry: e.target.value })}
                      placeholder="e.g. B2B SaaS, FinTech, Cybersecurity, AI/ML"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Decision-Maker Titles
                    </label>
                    <input
                      type="text"
                      value={formCriteria.jobTitle || ''}
                      onChange={(e) => setFormCriteria({ ...formCriteria, jobTitle: e.target.value })}
                      placeholder="e.g. Founder, CEO, VP of Sales, CTO"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Scale & Maturity
                    </label>
                    <select
                      value={formCriteria.companyScale || 'startups'}
                      onChange={(e) => setFormCriteria({ ...formCriteria, companyScale: e.target.value as any })}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef] cursor-pointer"
                    >
                      <option value="startups">Startups & Seed/Series A (High Growth)</option>
                      <option value="smb">SMBs (10-50 Employees)</option>
                      <option value="mid_market">Mid-Market (50-250 Employees)</option>
                      <option value="all">All Scales & Sizes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Active Buying Signal Trigger
                    </label>
                    <select
                      value={formCriteria.buyingSignalFilter || 'any_signal'}
                      onChange={(e) => setFormCriteria({ ...formCriteria, buyingSignalFilter: e.target.value as any })}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef] cursor-pointer"
                    >
                      <option value="any_signal">⚡ Any Signal (Funding, Hiring, Product Launches)</option>
                      <option value="funding">💰 Recent Funding Raised</option>
                      <option value="hiring">👥 Actively Hiring Engineers & Sales</option>
                      <option value="product_launch">🚀 New Product / Major Version Launches</option>
                      <option value="leadership_change">👔 Executive Leadership Changes</option>
                      <option value="all">All (No Signal Restriction)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Prospects per Batch
                    </label>
                    <select
                      value={formTargetCount}
                      onChange={(e) => setFormTargetCount(parseInt(e.target.value, 10))}
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef] cursor-pointer"
                    >
                      <option value="10">10 Fresh Prospects</option>
                      <option value="20">20 Fresh Prospects (Recommended)</option>
                      <option value="25">25 Fresh Prospects</option>
                      <option value="50">50 Fresh Prospects</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Region / Country
                    </label>
                    <input
                      type="text"
                      value={formCriteria.country || ''}
                      onChange={(e) => setFormCriteria({ ...formCriteria, country: e.target.value })}
                      placeholder="e.g. United States, United Kingdom, Canada"
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#155eef]"
                    />
                  </div>
                </div>

                {/* Checkbox Options */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3.5 text-xs border-t border-slate-200/60 dark:border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formCriteria.excludeMegaCaps ?? true}
                      onChange={(e) => setFormCriteria({ ...formCriteria, excludeMegaCaps: e.target.checked })}
                      className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-0 cursor-pointer"
                    />
                    <span>🚫 Exclude Mega-Caps (Salesforce, Stripe, Microsoft, etc.)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={formAutoEnrich}
                      onChange={(e) => setFormAutoEnrich(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-[#155eef] focus:ring-0 cursor-pointer"
                    />
                    <span>✉️ Auto-Extract Decision Makers & Verified Emails</span>
                  </label>
                </div>
              </div>

              {/* Section 4: Google Sheets Destination & Auto-Sync Selector */}
              <GoogleSheetsScheduleSelector
                enabled={googleSheetsEnabled}
                onToggleEnabled={(en) => setGoogleSheetsEnabled(en)}
                spreadsheetId={googleSpreadsheetId}
                spreadsheetName={googleSpreadsheetName}
                sheetId={googleSheetId}
                sheetName={googleSheetName}
                columnMapping={googleSheetsMapping}
                onSelectDestination={(dest) => {
                  setGoogleSpreadsheetId(dest.spreadsheetId);
                  setGoogleSpreadsheetName(dest.spreadsheetName);
                  setGoogleSheetId(dest.sheetId);
                  setGoogleSheetName(dest.sheetName);
                  if (dest.columnMapping) setGoogleSheetsMapping(dest.columnMapping);
                  if (dest.connectedUserEmail) setConnectedUserEmail(dest.connectedUserEmail);
                }}
                onShowToast={onShowToast}
              />

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('schedules')}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save & Activate Schedule</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: RUN LOGS */}
          {activeTab === 'runs' && (
            <div className="space-y-4">
              {/* Cloud Autopilot Banner for Users Wondering Why It Pauses When Laptop Shuts Down */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-blue-50/80 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-blue-950/30 border border-purple-200/80 dark:border-purple-800/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                      <span>Want discovery to run 24/7 even when your laptop is turned off?</span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                        Autonomous Mode
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      In serverless cloud hosting, timers pause when your laptop closes. Connect the free Cloud Webhook so it triggers every hour automatically in the cloud.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('cloud')}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer transition shadow-md shadow-purple-500/20 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Setup 24/7 (1 min)</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {runs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  No automated runs recorded yet. Click &quot;Run Now&quot; on an active schedule to test the pipeline immediately.
                </div>
              ) : (
                runs.map((run) => (
                  <div
                    key={run.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-800/40 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          run.status === 'completed'
                            ? 'bg-emerald-500'
                            : run.status === 'running'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {run.scheduleName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Started: {new Date(run.startedAt).toLocaleString()}
                        </div>
                        {run.googleSheetsSync && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              Sheets Synced:
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              +{run.googleSheetsSync.recordsAdded} added, ~{run.googleSheetsSync.recordsUpdated} updated
                            </span>
                            {run.googleSheetsSync.spreadsheetUrl && (
                              <a
                                href={run.googleSheetsSync.spreadsheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#155eef] hover:underline flex items-center gap-0.5 ml-1"
                              >
                                <span>Open Sheet</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Prospects</span>
                        <b className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          +{run.prospectsFound} fresh leads
                        </b>
                      </div>
                      {run.jobId && onViewJob && (
                        <button
                          onClick={() => {
                            onViewJob(run.jobId!);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>View Batch</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: 24/7 CLOUD AUTOPILOT (LAPTOP OFF) */}
          {activeTab === 'cloud' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Live Autopilot Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  cronJobOrgStatus?.connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                      cronJobOrgStatus?.connected ? 'bg-emerald-600' : 'bg-amber-600'
                    }`}
                  >
                    <Radio className={`w-5 h-5 ${cronJobOrgStatus?.connected ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold">
                        {cronJobOrgStatus?.connected
                          ? '24/7 Cloud Autopilot: ACTIVE'
                          : '24/7 Cloud Autopilot: WAITING FOR PINGER'}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cronJobOrgStatus?.connected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {cronJobOrgStatus?.connected ? 'Online 24/7' : 'Action Needed'}
                      </span>
                    </div>
                    <p className="text-xs opacity-90 mt-0.5">
                      {cronJobOrgStatus?.connected
                        ? `Connected via cron-job.org (Job #${cronJobOrgStatus.jobId}) • Pinging every ${cronJobOrgStatus.cadenceMinutes}m`
                        : 'Google Cloud pauses the container when your laptop shuts down unless an external pinger is connected.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cronJobOrgStatus?.connected && (
                    <div className="text-right text-[11px] font-mono px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-current/10">
                      <div>Total Cloud Pings: <strong>{cronJobOrgStatus.totalPingsReceived || 0}</strong></div>
                      {cronJobOrgStatus.lastIncomingPingAt && (
                        <div className="text-[10px] opacity-75">
                          Last ping: {new Date(cronJobOrgStatus.lastIncomingPingAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Architecture & Autopilot Clarification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-slate-50 to-orange-500/10 dark:from-amber-950/20 dark:via-slate-900/60 dark:to-orange-950/20 border border-amber-500/30 dark:border-amber-500/20 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Oracle Cloud Always-Free VM vs Cloud Run Container</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    Your permanent <strong>Oracle Cloud Always Free VM (161.118.169.117)</strong> never sleeps and has 100% persistent CPU. When accessing this Web UI via the preview link, Google Cloud Run hosts the web container. To ensure uninterrupted 24/7 lead extraction when your laptop is off, our Oracle VM worker or cron-job.org sends automated hourly triggers, keeping jobs running around the clock. You can also host the entire app directly on Oracle Cloud VM at <code className="font-mono text-amber-700 dark:text-amber-300">http://161.118.169.117:3000</code>!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>1-Click 24/7 Autonomous Pinger Setup</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    Connect your free cron-job.org API key from{' '}
                    <a
                      href="https://console.cron-job.org/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#155eef] hover:underline font-semibold"
                    >
                      console.cron-job.org/settings
                    </a>{' '}
                    or run the Oracle VM auto-pinger crontab below. LeadHook will automatically execute scheduled B2B discovery runs every 60 minutes with 0% CPU freezing.
                  </p>
                </div>
              </div>

              {/* SECTION A: 1-Click cron-job.org Auto-Connect */}
              <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-purple-200 dark:border-purple-900/40 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Option 1: 1-Click cron-job.org Auto-Connect (Recommended)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Zero manual setup. Connect your free cron-job.org API Key and LeadHook handles everything.
                      </p>
                    </div>
                  </div>

                  {cronJobOrgStatus?.connected && (
                    <button
                      type="button"
                      onClick={handleDisconnectCronJobOrg}
                      disabled={isDisconnectingCronJobOrg}
                      className="px-2.5 py-1 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-900/40 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    >
                      {isDisconnectingCronJobOrg ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  )}
                </div>

                {cronJobOrgStatus?.connected ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-900 dark:text-emerald-200">
                          Cron Job Active & Pinging Every {cronJobOrgStatus.cadenceMinutes} Minutes
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                        Job ID: #{cronJobOrgStatus.jobId} • Key: {cronJobOrgStatus.maskedApiKey || 'Active'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestCloudTrigger}
                        disabled={isTestingCloud}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingCloud ? 'animate-spin' : ''}`} />
                        <span>Test Cloud Trigger Now</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleConnectCronJobOrg} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>cron-job.org API Key</span>
                          <a
                            href="https://console.cron-job.org/settings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#155eef] hover:underline font-semibold inline-flex items-center gap-0.5 text-[10px]"
                          >
                            Get Free Key at cron-job.org <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={cronJobOrgApiKey}
                            onChange={(e) => setCronJobOrgApiKey(e.target.value)}
                            placeholder="Paste your cron-job.org API key here..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Ping Cadence
                        </label>
                        <select
                          value={cronJobOrgInterval}
                          onChange={(e) => setCronJobOrgInterval(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value={15}>Every 15 Minutes (Fastest)</option>
                          <option value={30}>Every 30 Minutes</option>
                          <option value={60}>Every 1 Hour (Standard)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        💡 Free accounts get 100 requests/day. Pinging every 60m takes only 24 requests/day.
                      </p>
                      <button
                        type="submit"
                        disabled={isConnectingCronJobOrg || !cronJobOrgApiKey.trim()}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-purple-500/20 disabled:opacity-50 shrink-0"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          {isConnectingCronJobOrg ? 'Connecting & Registering...' : 'Connect & Start 24/7 Autopilot'}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION B: Dedicated Webhook URL & Manual Setup */}
              <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-600" />
                    Option 2: Dedicated Cloud Cron Webhook URL (Manual Setup)
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    HTTP GET / POST Ready
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 select-all truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/scheduler/cron-tick` : '/api/scheduler/cron-tick'}
                  </div>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedWebhook ? 'Copied!' : 'Copy Webhook URL'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Recommended frequency: <strong>Every 1 hour</strong> (or every 2-6 hours)
                  </div>
                  <button
                    type="button"
                    onClick={handleTestCloudTrigger}
                    disabled={isTestingCloud}
                    className="px-3.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingCloud ? 'animate-spin' : ''}`} />
                    <span>{isTestingCloud ? 'Executing Cloud Trigger...' : 'Test Cloud Trigger Now'}</span>
                  </button>
                </div>

                {/* Cloud Test Live Output */}
                {cloudTestResult && (
                  <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono space-y-1.5 border border-slate-700">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                      <span>Server Cloud Trigger Response:</span>
                      <span className="text-emerald-400 font-bold">200 OK</span>
                    </div>
                    <p className="text-emerald-300 font-semibold">{cloudTestResult.message}</p>
                    {cloudTestResult.runs && cloudTestResult.runs.length > 0 && (
                      <div className="text-[11px] text-slate-300 pt-1">
                        Executed: {cloudTestResult.runs[0].scheduleName} • Found +{cloudTestResult.runs[0].prospectsFound} fresh leads!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Free Manual Pinger Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manual Method A: Free cron-job.org without API key */}
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#155eef] text-[10px] flex items-center justify-center font-bold">
                        A
                      </span>
                      cron-job.org (Manual Paste)
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Free
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Paste the Webhook URL directly into cron-job.org dashboard without using an API key:
                  </p>

                  <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pl-4 list-decimal">
                    <li>
                      Go to{' '}
                      <a
                        href="https://cron-job.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#155eef] hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        cron-job.org <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </li>
                    <li>Click <strong>&quot;Create Cronjob&quot;</strong>.</li>
                    <li>Paste your Cloud Webhook URL from above.</li>
                    <li>Set Execution Schedule: <strong>&quot;Every 1 hour&quot;</strong>.</li>
                    <li>Click <strong>&quot;Create&quot;</strong>.</li>
                  </ol>
                </div>

                {/* Manual Method B: UptimeRobot */}
                <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 text-[10px] flex items-center justify-center font-bold">
                        B
                      </span>
                      UptimeRobot (Free HTTP Monitor)
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      Alternative
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Use UptimeRobot&apos;s free recurring HTTP monitor to keep the cloud server discovering leads:
                  </p>

                  <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pl-4 list-decimal">
                    <li>
                      Open{' '}
                      <a
                        href="https://uptimerobot.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#155eef] hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        UptimeRobot <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </li>
                    <li>Monitor Type: <strong>HTTP(s)</strong></li>
                    <li>URL: Paste your webhook URL</li>
                    <li>Monitoring Interval: <strong>60 minutes</strong></li>
                    <li>Save to start 24/7 cloud pings.</li>
                  </ol>
                </div>
              </div>

              {/* Option 3: Oracle Cloud Always Free VM */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-purple-500/10 border border-amber-500/30 dark:border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                      OCI
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Option 3: Your Oracle Cloud VM (161.118.169.117)
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Run autonomous scraping 24/7 directly on your permanent Oracle Cloud Always Free Virtual Machine.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Always Free VM
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/60 dark:border-white/5 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Method 1: Oracle VM 24/7 Auto-Pinger</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Zero Setup</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Run this single command inside your Oracle VM terminal to make it ping this app hourly 24/7/365:
                    </p>
                    <div className="p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] select-all overflow-x-auto">
                      (crontab -l 2&gt;/dev/null; echo &quot;0 * * * * curl -s {typeof window !== 'undefined' ? `${window.location.origin}/api/scheduler/cron-tick` : '/api/scheduler/cron-tick'} &gt;/dev/null&quot;) | crontab -
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/60 dark:border-white/5 space-y-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Method 2: Full App on Oracle VM</span>
                      <span className="text-[10px] text-purple-600 font-semibold">Dedicated Host</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Deploy the entire LeadHook app directly on your Oracle VM so it runs at <code>http://161.118.169.117:3000</code>:
                    </p>
                    <div className="p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] select-all overflow-x-auto">
                      curl -fsSL {typeof window !== 'undefined' ? `${window.location.origin}/scripts/deploy-whole-app-oracle.sh` : '/scripts/deploy-whole-app-oracle.sh'} | bash
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
