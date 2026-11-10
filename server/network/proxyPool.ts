import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyItem, ProxyPoolConfig, ProxyProtocol, ProxyRotationMode } from '../../src/types';

export const DEFAULT_PROXY_CONFIG: ProxyPoolConfig = {
  enabled: false,
  rotationMode: 'round_robin',
  pinnedGeo: undefined,
  maxFailuresBeforeCooldown: 3,
  cooldownDurationMinutes: 10,
  proxies: [],
};

export class ProxyPoolManager {
  private config: ProxyPoolConfig;
  private currentIndex: number = 0;
  private agentCache: Map<string, any> = new Map();

  constructor(config: Partial<ProxyPoolConfig> = {}) {
    this.config = { ...DEFAULT_PROXY_CONFIG, ...config };
  }

  public getConfig(): ProxyPoolConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ProxyPoolConfig>): ProxyPoolConfig {
    this.config = { ...this.config, ...newConfig };
    this.agentCache.clear();
    return this.getConfig();
  }

  public getProxies(): ProxyItem[] {
    return [...this.config.proxies];
  }

  public setProxies(proxies: ProxyItem[]): void {
    this.config.proxies = proxies;
    this.agentCache.clear();
  }

  public addOrUpdateProxy(proxy: Partial<ProxyItem> & { host: string; port: number }): ProxyItem {
    if (proxy.id) {
      const updated = this.updateProxy(proxy.id, proxy);
      if (updated) return updated;
    }
    return this.addProxy(proxy as any);
  }

  public addProxy(proxy: Omit<ProxyItem, 'id' | 'failureCount' | 'successCount' | 'status'> & Partial<ProxyItem>): ProxyItem {
    const item: ProxyItem = {
      id: proxy.id || `proxy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      protocol: proxy.protocol || 'http',
      host: proxy.host.trim(),
      port: Number(proxy.port),
      username: proxy.username?.trim(),
      password: proxy.password?.trim(),
      geolocation: proxy.geolocation?.trim().toUpperCase(),
      enabled: proxy.enabled !== false,
      status: proxy.status || 'untested',
      latencyMs: proxy.latencyMs,
      lastChecked: proxy.lastChecked,
      failureCount: proxy.failureCount || 0,
      successCount: proxy.successCount || 0,
      errorMsg: proxy.errorMsg,
    };

    this.config.proxies.push(item);
    return item;
  }

  public removeProxy(id: string): boolean {
    const prevLen = this.config.proxies.length;
    this.config.proxies = this.config.proxies.filter((p) => p.id !== id);
    this.agentCache.delete(id);
    return this.config.proxies.length < prevLen;
  }

  public updateProxy(id: string, updates: Partial<ProxyItem>): ProxyItem | null {
    const idx = this.config.proxies.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.config.proxies[idx] = { ...this.config.proxies[idx], ...updates };
    this.agentCache.delete(id);
    return this.config.proxies[idx];
  }

  /**
   * Parse a raw proxy string in standard formats:
   *  - host:port
   *  - host:port:username:password
   *  - http://username:password@host:port
   *  - socks5://host:port
   */
  public parseProxyString(raw: string, defaultGeo?: string): ProxyItem | null {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    let protocol: ProxyProtocol = 'http';
    let host = '';
    let port = 8080;
    let username = '';
    let password = '';

    if (trimmed.startsWith('socks5://') || trimmed.startsWith('socks5h://')) {
      protocol = 'socks5';
      const parsed = new URL(trimmed.replace('socks5h://', 'socks5://'));
      host = parsed.hostname;
      port = Number(parsed.port) || 1080;
      username = parsed.username || '';
      password = parsed.password || '';
    } else if (trimmed.startsWith('https://')) {
      protocol = 'https';
      const parsed = new URL(trimmed);
      host = parsed.hostname;
      port = Number(parsed.port) || 443;
      username = parsed.username || '';
      password = parsed.password || '';
    } else if (trimmed.startsWith('http://')) {
      protocol = 'http';
      const parsed = new URL(trimmed);
      host = parsed.hostname;
      port = Number(parsed.port) || 80;
      username = parsed.username || '';
      password = parsed.password || '';
    } else {
      // Formats: host:port or host:port:user:pass
      const parts = trimmed.split(':');
      if (parts.length === 2) {
        host = parts[0];
        port = parseInt(parts[1], 10);
      } else if (parts.length === 4) {
        host = parts[0];
        port = parseInt(parts[1], 10);
        username = parts[2];
        password = parts[3];
      } else {
        return null;
      }
    }

    if (!host || isNaN(port) || port <= 0 || port > 65535) {
      return null;
    }

    return {
      id: `proxy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      protocol,
      host,
      port,
      username: username || undefined,
      password: password || undefined,
      geolocation: defaultGeo ? defaultGeo.toUpperCase() : undefined,
      enabled: true,
      status: 'untested',
      failureCount: 0,
      successCount: 0,
    };
  }

  /**
   * Selects an active, healthy proxy according to the configured rotation mode
   */
  public selectProxy(): ProxyItem | null {
    if (!this.config.enabled || this.config.proxies.length === 0) {
      return null;
    }

    // Refresh cooling-down proxies if timeout expired
    const now = Date.now();
    const cooldownMs = (this.config.cooldownDurationMinutes || 10) * 60 * 1000;

    for (const p of this.config.proxies) {
      if (p.status === 'cooldown' && p.lastChecked) {
        const lastTime = new Date(p.lastChecked).getTime();
        if (now - lastTime > cooldownMs) {
          p.status = 'active';
          p.failureCount = 0;
          p.errorMsg = undefined;
        }
      }
    }

    // Filter eligible proxies
    let candidates = this.config.proxies.filter(
      (p) => p.enabled && p.status !== 'cooldown' && p.status !== 'failed'
    );

    // Apply geolocation pinning if configured
    if (this.config.pinnedGeo && this.config.pinnedGeo.trim().length > 0) {
      const geoFilter = this.config.pinnedGeo.trim().toUpperCase();
      const geoMatched = candidates.filter((p) => p.geolocation === geoFilter);
      if (geoMatched.length > 0) {
        candidates = geoMatched;
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const mode = this.config.rotationMode || 'round_robin';

    if (mode === 'fastest') {
      // Sort by lowest latency, prioritizing tested proxies
      const sorted = [...candidates].sort((a, b) => {
        const latA = a.latencyMs ?? 999999;
        const latB = b.latencyMs ?? 999999;
        return latA - latB;
      });
      return sorted[0];
    }

    if (mode === 'random') {
      const idx = Math.floor(Math.random() * candidates.length);
      return candidates[idx];
    }

    // Default: round_robin
    const selected = candidates[this.currentIndex % candidates.length];
    this.currentIndex++;
    return selected;
  }

  /**
   * Reports a successful request through this proxy
   */
  public recordSuccess(proxyId: string, latencyMs?: number): void {
    const proxy = this.config.proxies.find((p) => p.id === proxyId);
    if (!proxy) return;

    proxy.status = 'active';
    proxy.failureCount = 0;
    proxy.successCount += 1;
    proxy.lastChecked = new Date().toISOString();
    if (latencyMs !== undefined) {
      proxy.latencyMs = Math.round(latencyMs);
    }
  }

  /**
   * Reports a failure/timeout through this proxy
   */
  public recordFailure(proxyId: string, error: string): void {
    const proxy = this.config.proxies.find((p) => p.id === proxyId);
    if (!proxy) return;

    proxy.failureCount += 1;
    proxy.errorMsg = error;
    proxy.lastChecked = new Date().toISOString();

    const maxFails = this.config.maxFailuresBeforeCooldown || 3;
    if (proxy.failureCount >= maxFails) {
      proxy.status = 'cooldown';
    }
  }

  /**
   * Builds the formatted connection URL for agent creation
   */
  public formatProxyUrl(proxy: ProxyItem): string {
    const auth = proxy.username && proxy.password ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : '';
    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
  }

  /**
   * Returns an Agent instance (HTTP, HTTPS, or SOCKS5) for use with fetch
   */
  public getAgentForProxy(proxy: ProxyItem): any {
    const cacheKey = `${proxy.protocol}_${proxy.host}_${proxy.port}_${proxy.username || ''}`;
    if (this.agentCache.has(cacheKey)) {
      return this.agentCache.get(cacheKey);
    }

    const proxyUrl = this.formatProxyUrl(proxy);
    let agent: any;

    if (proxy.protocol === 'socks5') {
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      agent = new HttpsProxyAgent(proxyUrl);
    }

    this.agentCache.set(cacheKey, agent);
    return agent;
  }

  /**
   * Real connection test for a specific proxy
   */
  public async testProxy(proxy: ProxyItem): Promise<{ success: boolean; latencyMs: number; error?: string; ip?: string }> {
    const start = Date.now();
    try {
      const agent = this.getAgentForProxy(proxy);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      // Probe a reliable IP reflection endpoint
      const res = await fetch('https://httpbin.org/ip', {
        signal: controller.signal,
        // @ts-ignore Node fetch agent pass-through
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timer);
      const elapsed = Date.now() - start;

      if (res.ok) {
        const body: any = await res.json().catch(() => ({}));
        this.recordSuccess(proxy.id, elapsed);
        return {
          success: true,
          latencyMs: elapsed,
          ip: body.origin || undefined,
        };
      } else {
        const err = `HTTP ${res.status} ${res.statusText}`;
        this.recordFailure(proxy.id, err);
        return { success: false, latencyMs: elapsed, error: err };
      }
    } catch (err: any) {
      const elapsed = Date.now() - start;
      const errMsg = err.name === 'AbortError' ? 'Connection timed out (>12s)' : err.message;
      this.recordFailure(proxy.id, errMsg);
      return { success: false, latencyMs: elapsed, error: errMsg };
    }
  }
}

export const globalProxyPool = new ProxyPoolManager();
