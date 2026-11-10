/**
 * Fix 2: Authenticated Browser Session Bridge Service
 *
 * This service runs directly inside the authenticated web browser session.
 * Because all requests originate from the user's browser, they carry Google OAuth
 * session cookies, completely bypassing the __cookie_check.html gateway.
 *
 * It sends periodic keep-alive pulses and pumps discovery/scraping queues
 * to ensure background tasks proceed continuously without interruption.
 */

type BridgeListener = (status: BridgeState) => void;

export interface BridgeState {
  isActive: boolean;
  lastPulseAt: string | null;
  pulsesCount: number;
  currentAction: string;
  activeJob: any | null;
  error: string | null;
}

class SessionBridgeManager {
  private timer: NodeJS.Timeout | null = null;
  private isPumping = false;
  private listeners: Set<BridgeListener> = new Set();
  private state: BridgeState = {
    isActive: false,
    lastPulseAt: null,
    pulsesCount: 0,
    currentAction: 'idle',
    activeJob: null,
    error: null,
  };

  constructor() {
    // Auto-start on load in browser
    if (typeof window !== 'undefined') {
      this.start();
    }
  }

  public getState(): BridgeState {
    return { ...this.state };
  }

  public subscribe(listener: BridgeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public start() {
    if (this.timer) return;
    this.state.isActive = true;
    this.notify();

    // Pulse immediately
    this.pump();

    // Pulse every 3 seconds to keep server tasks pumped and warm
    this.timer = setInterval(() => {
      this.pump();
    }, 3000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isActive = false;
    this.notify();
  }

  public async pump(activeJobId?: string, jobType?: string): Promise<void> {
    if (this.isPumping) return;
    this.isPumping = true;

    try {
      const res = await fetch('/api/bridge/pump', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ activeJobId, jobType }),
      });

      if (res.ok) {
        const data = await res.json();
        this.state.lastPulseAt = new Date().toISOString();
        this.state.pulsesCount++;
        this.state.currentAction = data.currentAction || 'idle';
        this.state.activeJob = data.job || null;
        this.state.error = null;
        this.state.isActive = true;
      } else {
        this.state.error = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      this.state.error = err.message || 'Network error';
    } finally {
      this.isPumping = false;
      this.notify();
    }
  }
}

export const sessionBridge = new SessionBridgeManager();
