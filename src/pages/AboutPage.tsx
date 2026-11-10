import React from 'react';
import { AppLogo } from '../components/AppLogo';
import {
  Bot,
  ShieldCheck,
  Cpu,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Lock,
  Terminal,
  Package,
  Play,
} from 'lucide-react';

interface AboutPageProps {
  onReplayLoadingScreen?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onReplayLoadingScreen }) => {
  return (
    <div id="about-page" className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 glass-card rounded-2xl shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <AppLogo size={68} withContainer className="shadow-lg shadow-blue-500/10 shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">LeadHook</h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#155eef] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 text-[10px] font-bold uppercase">
              v1.0 Desktop
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 glass-card rounded-2xl space-y-3 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-[#155eef] dark:text-blue-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Smart Page Discovery</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Crawls websites intelligently by ranking internal links. Prioritizes high-value contact pages (<code className="text-[#155eef] dark:text-blue-300 font-semibold">/contact</code>, <code className="text-[#155eef] dark:text-blue-300 font-semibold">/about</code>, <code className="text-[#155eef] dark:text-blue-300 font-semibold">/team</code>, <code className="text-[#155eef] dark:text-blue-300 font-semibold">/leadership</code>) while avoiding noise like blog feeds and checkout carts.
          </p>
        </div>

        <div className="p-5 glass-card rounded-2xl space-y-3 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
            <Bot className="w-4 h-4" />
            <span>Gemini AI Structured Extraction</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Uses Google Gemini 2.5 with strict JSON schemas to extract and categorize business contacts, ensuring zero hallucinated emails, role-based classifications, and precise executive titles.
          </p>
        </div>

        <div className="p-5 glass-card rounded-2xl space-y-3 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <FileSpreadsheet className="w-4 h-4" />
            <span>3-Sheet Excel Reports</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Outputs structured <code className="text-emerald-600 dark:text-emerald-300 font-semibold">.xlsx</code> workbooks with auto-filters, clickable website links, styled header cells, and 3 dedicated sheets: Contacts, Companies, and Batch Execution Summary.
          </p>
        </div>

        <div className="p-5 glass-card rounded-2xl space-y-3 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
          <div className="flex items-center gap-2 text-[#155eef] dark:text-blue-400 font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>Privacy & Local Security</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            All data and settings are stored locally on your machine. Your Gemini API key is never exposed to scraped websites and runs strictly in backend operations.
          </p>
        </div>
      </div>

      {/* Windows Packaging Details */}
      <div className="p-6 glass-card rounded-2xl space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <Package className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <span>Single-Click Windows Installer (.exe) Architecture</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          The application is engineered to compile directly into a single self-contained Windows executable via <code className="text-[#155eef] dark:text-blue-300 font-mono">electron-builder</code> and NSIS. The user never needs to manually install Python, Node.js, or Chrome.
        </p>
        <div className="p-4 bg-blue-50/50 dark:bg-[#0f1424]/60 rounded-xl border border-blue-100 dark:border-blue-900/30 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
          <p className="text-slate-400">// To package on Windows:</p>
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">installer\build_installer.bat</p>
          <p className="text-slate-400 mt-2">// Artifacts generated:</p>
          <p className="text-[#155eef] dark:text-blue-300">dist_installer\LeadHookSetup.exe</p>
          <p className="text-[#155eef] dark:text-blue-300">dist_installer\LeadHook.exe (Portable)</p>
        </div>
      </div>

      {/* Brand Identity & Official Logo */}
      <div className="p-6 glass-card rounded-2xl space-y-4 shadow-sm border border-blue-100/80 dark:border-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <AppLogo size={20} />
            <span>Official Application Logo</span>
          </div>
          <div className="flex items-center gap-2">
            {onReplayLoadingScreen && (
              <button
                id="about-play-loading-screen-btn"
                onClick={onReplayLoadingScreen}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
                title="Preview the cinematic logo loading animation"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Play Loading Screen</span>
              </button>
            )}
            <a
              href="/logo.svg"
              download="logo.svg"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Download SVG</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/logo.png"
              download="logo.png"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#155eef] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Download PNG</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Light Mode Preview */}
          <div className="p-4 rounded-xl bg-white border border-blue-100 flex flex-col items-center justify-center gap-2 text-center shadow-sm">
            <AppLogo size={56} />
            <span className="text-[11px] font-semibold text-slate-600">Light Canvas</span>
          </div>

          {/* Dark Mode Preview */}
          <div className="p-4 rounded-xl bg-[#080d1a] border border-blue-900/40 flex flex-col items-center justify-center gap-2 text-center shadow-sm">
            <AppLogo size={56} />
            <span className="text-[11px] font-semibold text-slate-400">Dark Canvas</span>
          </div>

          {/* Squircle Card Preview */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-[#101730] border border-blue-100/80 dark:border-blue-900/30 flex flex-col items-center justify-center gap-2 text-center">
            <AppLogo size={56} withContainer />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">App Icon Squircle</span>
          </div>
        </div>
      </div>

      {/* Legal & Compliance Notice */}
      <div className="p-6 bg-blue-50/30 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl space-y-3 text-xs">
        <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-[#155eef] dark:text-blue-400" />
          <span>Responsible Usage & Compliance Notice</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          LeadHook is designed strictly to locate publicly available business contact information openly published by companies on their own websites.
        </p>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
          Users are solely responsible for ensuring their usage complies with all applicable regional and international laws, website terms of service, robots.txt directives, data privacy regulations (e.g., GDPR, CCPA), and anti-spam legislation (e.g., CAN-SPAM, CASL). Always conduct business outreach respectfully and honor opt-out requests promptly.
        </p>
      </div>
    </div>
  );
};
