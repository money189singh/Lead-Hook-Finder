import { AntiBotConfig } from '../../src/types';

export interface BrowserProfile {
  name: string;
  userAgent: string;
  platform: string;
  platformVersion: string;
  brands: { brand: string; version: string }[];
  mobile: boolean;
  acceptLanguage: string;
}

export const MODERN_PROFILES: BrowserProfile[] = [
  {
    name: 'Chrome 122 on Windows 11',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform: '"Windows"',
    platformVersion: '"15.0.0"',
    brands: [
      { brand: 'Chromium', version: '122' },
      { brand: 'Not(A:Brand', version: '24' },
      { brand: 'Google Chrome', version: '122' },
    ],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    name: 'Chrome 123 on macOS Sonoma',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    platform: '"macOS"',
    platformVersion: '"14.3.1"',
    brands: [
      { brand: 'Google Chrome', version: '123' },
      { brand: 'Not:A-Brand', version: '8' },
      { brand: 'Chromium', version: '123' },
    ],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.9,fr;q=0.7',
  },
  {
    name: 'Edge 122 on Windows 11',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92',
    platform: '"Windows"',
    platformVersion: '"15.0.0"',
    brands: [
      { brand: 'Chromium', version: '122' },
      { brand: 'Microsoft Edge', version: '122' },
      { brand: 'Not:A-Brand', version: '24' },
    ],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    name: 'Safari 17.3 on macOS Sonoma',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    platform: '"macOS"',
    platformVersion: '"14.3.0"',
    brands: [],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    name: 'Firefox 123 on Windows 10',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    platform: '"Windows"',
    platformVersion: '"10.0.0"',
    brands: [],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.8,de;q=0.6',
  },
  {
    name: 'Chrome 122 on Linux Ubuntu',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform: '"Linux"',
    platformVersion: '"6.5.0"',
    brands: [
      { brand: 'Chromium', version: '122' },
      { brand: 'Google Chrome', version: '122' },
      { brand: 'Not-A.Brand', version: '99' },
    ],
    mobile: false,
    acceptLanguage: 'en-US,en;q=0.9',
  },
];

export const DEFAULT_ANTI_BOT_CONFIG: AntiBotConfig = {
  enabled: true,
  rotateUserAgents: true,
  randomizeClientHints: true,
  humanizedJitter: true,
  minJitterMs: 600,
  maxJitterMs: 2200,
  randomizeHeadersOrder: true,
};

export class AntiBotEngine {
  private config: AntiBotConfig;
  private currentProfileIndex: number = 0;

  constructor(config: Partial<AntiBotConfig> = {}) {
    this.config = { ...DEFAULT_ANTI_BOT_CONFIG, ...config };
  }

  public updateConfig(newConfig: Partial<AntiBotConfig>): AntiBotConfig {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }

  public getConfig(): AntiBotConfig {
    return { ...this.config };
  }

  public getRandomProfile(): BrowserProfile {
    if (!this.config.rotateUserAgents) {
      return MODERN_PROFILES[0];
    }
    const idx = Math.floor(Math.random() * MODERN_PROFILES.length);
    return MODERN_PROFILES[idx];
  }

  public getNextProfile(): BrowserProfile {
    if (!this.config.rotateUserAgents) {
      return MODERN_PROFILES[0];
    }
    const profile = MODERN_PROFILES[this.currentProfileIndex % MODERN_PROFILES.length];
    this.currentProfileIndex++;
    return profile;
  }

  /**
   * Generates realistic browser HTTP headers with Client Hints and realistic navigation metadata
   */
  public generateHeaders(targetUrl?: string, customProfile?: BrowserProfile): Record<string, string> {
    const profile = customProfile || this.getRandomProfile();
    const headers: Record<string, string> = {};

    headers['User-Agent'] = profile.userAgent;
    headers['Accept'] =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    headers['Accept-Language'] = profile.acceptLanguage;
    headers['Upgrade-Insecure-Requests'] = '1';

    // Client Hints if Chromium-based
    if (this.config.randomizeClientHints && profile.brands.length > 0) {
      const brandsFormatted = profile.brands
        .map((b) => `"${b.brand}";v="${b.version}"`)
        .join(', ');
      headers['Sec-CH-UA'] = brandsFormatted;
      headers['Sec-CH-UA-Mobile'] = profile.mobile ? '?1' : '?0';
      headers['Sec-CH-UA-Platform'] = profile.platform;
      headers['Sec-CH-UA-Platform-Version'] = profile.platformVersion;
    }

    // Navigation fetch metadata
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
    headers['Cache-Control'] = 'max-age=0';

    if (targetUrl) {
      try {
        const u = new URL(targetUrl);
        headers['Host'] = u.host;
      } catch {
        // ignore invalid URL host formatting
      }
    }

    // Header order randomization if configured
    if (this.config.randomizeHeadersOrder) {
      const entries = Object.entries(headers);
      // Pseudo-shuffle preserving Host first if present
      for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = entries[i];
        entries[i] = entries[j];
        entries[j] = temp;
      }
      return Object.fromEntries(entries);
    }

    return headers;
  }

  /**
   * Calculates a humanized randomized jitter delay (normal distribution)
   */
  public calculateJitterDelay(): number {
    if (!this.config.humanizedJitter) {
      return 0;
    }
    const min = Math.max(100, this.config.minJitterMs || 500);
    const max = Math.max(min + 100, this.config.maxJitterMs || 2000);

    // Box-Muller transform for normal distribution centered between min and max
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random() || 0.0001;
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    const mean = (min + max) / 2;
    const stdDev = (max - min) / 4; // 95% falls within [min, max]
    const sample = Math.round(mean + z * stdDev);

    return Math.max(min, Math.min(max, sample));
  }
}

export const globalAntiBotEngine = new AntiBotEngine();
