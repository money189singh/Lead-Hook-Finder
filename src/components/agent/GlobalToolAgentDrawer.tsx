import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Trash2,
  Mic,
  MicOff,
  Command,
} from 'lucide-react';
import { NavTab } from '../Sidebar';

export interface AgentClientAction {
  type:
    | 'NAVIGATE'
    | 'EXPORT'
    | 'REFRESH_JOB'
    | 'REFRESH_SETTINGS'
    | 'REFRESH_HISTORY'
    | 'SHOW_TOAST';
  tab?: string;
  format?: 'csv' | 'xlsx';
  message?: string;
  toastType?: 'success' | 'info' | 'warning' | 'error';
}

export interface ExecutedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'error';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  executedTools?: ExecutedToolCall[];
}

interface GlobalToolAgentDrawerProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onNavigate: (tab: NavTab) => void;
  onRefreshJob: () => Promise<void>;
  onRefreshSettings: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
  onExportXlsx: () => void;
  onExportCsv: () => void;
  onShowToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

const QUICK_COMMANDS = [
  { label: 'Generate CRM API Key', prompt: 'Generate a new API key for my CRM integration' },
  { label: 'Sync Leads to CRM', prompt: 'Sync all extracted leads to my connected CRM now' },
  { label: 'Enable Apollo Auto-Sync', prompt: 'Connect Apollo CRM and enable auto sync for all leads' },
  { label: 'Scrape stripe.com & linear.app', prompt: 'Scrape stripe.com and linear.app now' },
  { label: 'Lookalikes for brex.com + Scrape', prompt: 'Find lookalike domains for brex.com and start scraping them immediately' },
  { label: 'Job & System Status', prompt: 'Get current system and scraping job status' },
  { label: 'Concurrency 5 • Max Pages 20', prompt: 'Set concurrency to 5 and max pages to 20' },
  { label: 'Qualify High ICP Leads (≥80%)', prompt: 'Update all leads with ICP score >= 80 to Qualified stage and tag them Priority' },
  { label: 'Export Leads (XLSX)', prompt: 'Export extracted leads to XLSX' },
  { label: 'Open Settings', prompt: 'Navigate to settings page' },
];

export const GlobalToolAgentDrawer: React.FC<GlobalToolAgentDrawerProps> = ({
  isOpen,
  onToggle,
  onNavigate,
  onRefreshJob,
  onRefreshSettings,
  onRefreshHistory,
  onExportXlsx,
  onExportCsv,
  onShowToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'model',
      text: 'LeadHook AI Controller active. Issue any command to scrape domains, find lookalikes, adjust settings, qualify leads, block domains, export data, or navigate.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Global Cmd/Ctrl + K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggle(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const executeClientActions = async (actions: AgentClientAction[]) => {
    for (const act of actions) {
      if (act.type === 'NAVIGATE' && act.tab) {
        onNavigate(act.tab as NavTab);
      } else if (act.type === 'REFRESH_JOB') {
        await onRefreshJob();
      } else if (act.type === 'REFRESH_SETTINGS') {
        await onRefreshSettings();
      } else if (act.type === 'REFRESH_HISTORY') {
        await onRefreshHistory();
      } else if (act.type === 'EXPORT') {
        if (act.format === 'csv') onExportCsv();
        else onExportXlsx();
      } else if (act.type === 'SHOW_TOAST' && act.message) {
        onShowToast(act.message, act.toastType || 'info');
      }
    }
  };

  const handleSendCommand = async (rawPrompt?: string) => {
    const textToSend = (rawPrompt !== undefined ? rawPrompt : input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (rawPrompt === undefined) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages
            .filter((m) => m.id !== 'welcome_msg')
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Agent execution error');
      }

      if (Array.isArray(data.clientActions) && data.clientActions.length > 0) {
        await executeClientActions(data.clientActions);
      }

      const modelMsg: ChatMessage = {
        id: `m_${Date.now()}`,
        role: 'model',
        text: data.reply || 'Command executed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executedTools: data.executedTools || [],
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'model',
          text: `Error: ${err.message || 'Could not execute command.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onShowToast('Speech recognition is not supported in this browser.', 'warning');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInput(transcript);
        handleSendCommand(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          id="global-ai-agent-fab"
          type="button"
          onClick={() => onToggle(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#155eef] via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white text-xs font-bold shadow-xl shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-white/20"
          title="Open LeadHook AI Controller (Ctrl+K)"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Agent</span>
          <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">⌘K</span>
        </button>
      )}

      {/* Slide-Over AI Agent Controller Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          <div
            id="global-ai-agent-drawer"
            className="w-full max-w-md bg-white dark:bg-[#0c101d] border-l border-blue-100 dark:border-blue-900/40 shadow-2xl flex flex-col h-full"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between bg-gradient-to-r from-[#155eef]/10 via-indigo-500/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#155eef] to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    LeadHook AI Controller
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                    Full Access
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMessages([
                      {
                        id: 'welcome_msg',
                        role: 'model',
                        text: 'LeadHook AI Controller active. Issue any command to scrape domains, find lookalikes, adjust settings, qualify leads, block domains, export data, or navigate.',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      },
                    ])
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Clear History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  id="global-ai-agent-close-btn"
                  type="button"
                  onClick={() => onToggle(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Command Chips */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#101629]/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_COMMANDS.map((cmd, idx) => (
                <button
                  key={`quick-agent-cmd-${idx}`}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendCommand(cmd.prompt)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#151d36] hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-200 border border-blue-100 dark:border-blue-900/40 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  {cmd.label}
                </button>
              ))}
            </div>

            {/* Conversation Stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 space-y-2.5 ${
                      m.role === 'user'
                        ? 'bg-[#155eef] text-white rounded-br-xs shadow-xs'
                        : 'bg-slate-100 dark:bg-[#141b30] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-blue-900/30 rounded-bl-xs'
                    }`}
                  >
                    {/* Executed Tool Calls */}
                    {m.executedTools && m.executedTools.length > 0 && (
                      <div className="space-y-1.5 pb-1">
                        {m.executedTools.map((tool, tIdx) => (
                          <div
                            key={`${tool.id}_${tIdx}`}
                            className="p-2.5 rounded-xl bg-white/90 dark:bg-[#0b0f1c] border border-blue-200/70 dark:border-blue-900/50 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-mono font-bold text-[#155eef] dark:text-blue-400">
                                <Terminal className="w-3 h-3" />
                                <span>{tool.name}</span>
                              </div>
                              {tool.status === 'success' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Executed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                  <AlertCircle className="w-3 h-3" />
                                  Error
                                </span>
                              )}
                            </div>
                            {Object.keys(tool.args || {}).length > 0 && (
                              <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all">
                                {JSON.stringify(tool.args)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#155eef] dark:text-blue-400 font-semibold px-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Executing tool actions...</span>
                </div>
              )}
            </div>

            {/* Command Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCommand();
              }}
              className="p-3.5 border-t border-blue-100 dark:border-blue-900/30 bg-white dark:bg-[#0c101d] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  listening
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'bg-slate-50 dark:bg-[#141b30] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-[#155eef]'
                }`}
                title="Voice Command"
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                id="global-ai-agent-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder="Ask AI Agent to scrape, find lookalikes, filter, export..."
                className="flex-1 px-3.5 py-2.5 glass-input rounded-xl text-xs placeholder-slate-400"
              />

              <button
                id="global-ai-agent-send-btn"
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#155eef] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Run</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
