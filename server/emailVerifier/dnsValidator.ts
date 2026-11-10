import dns from 'dns';
import { DnsCheckResult } from './types';

export class DnsValidator {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;

  /**
   * Helper to execute a promise with a strict timeout.
   */
  private static async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err: any = new Error('DNS resolution timed out');
        err.code = 'ETIMEOUT';
        reject(err);
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer!);
      return res;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  /**
   * Validate domain existence, MX records, and RFC 5321 A/AAAA fallback.
   */
  public static async validate(domain: string, timeoutMs: number = this.DEFAULT_TIMEOUT_MS): Promise<DnsCheckResult> {
    const startTime = Date.now();
    const cleanDomain = domain.toLowerCase().trim();

    try {
      // 1. Check MX records
      let mxRecords: dns.MxRecord[] = [];
      try {
        mxRecords = await this.withTimeout(dns.promises.resolveMx(cleanDomain), timeoutMs);
      } catch (err: any) {
        // If not ENODATA / ENOTFOUND / ETIMEOUT, catch and evaluate below
        if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
          if (err.code === 'ETIMEOUT' || err.message?.includes('timed out')) {
            return {
              domainStatus: 'timeout',
              mxStatus: 'timeout',
              mxRecords: [],
              hasFallbackA: false,
              aRecords: [],
              error: `DNS resolution for ${cleanDomain} timed out after ${timeoutMs}ms`,
              latencyMs: Date.now() - startTime,
            };
          }
          if (err.code === 'ESERVFAIL') {
            return {
              domainStatus: 'error',
              mxStatus: 'error',
              mxRecords: [],
              hasFallbackA: false,
              aRecords: [],
              error: `DNS server failure (SERVFAIL) querying ${cleanDomain}`,
              latencyMs: Date.now() - startTime,
            };
          }
        }
      }

      if (mxRecords && mxRecords.length > 0) {
        // Sort by priority (lowest number = highest priority)
        const sorted = [...mxRecords].sort((a, b) => a.priority - b.priority);

        // Check if the only MX record is the Null MX (RFC 7505: priority 0, exchange ".")
        const isNullMx = sorted.length === 1 && (sorted[0].exchange === '' || sorted[0].exchange === '.');
        if (isNullMx) {
          return {
            domainStatus: 'valid',
            mxStatus: 'missing',
            mxRecords: [],
            hasFallbackA: false,
            aRecords: [],
            error: `Domain explicitly declares Null MX (RFC 7505 - does not accept email)`,
            latencyMs: Date.now() - startTime,
          };
        }

        const mxList = sorted.map((r) => ({ exchange: r.exchange, priority: r.priority }));
        const exchanges = mxList.map((m) => m.exchange);
        const mxProvider = this.detectProvider(exchanges);

        // Fetch SPF & DMARC in parallel with small timeout
        const [spfInfo, dmarcInfo] = await Promise.all([
          this.resolveSpf(cleanDomain, timeoutMs),
          this.resolveDmarc(cleanDomain, timeoutMs),
        ]);

        return {
          domainStatus: 'valid',
          mxStatus: 'valid',
          mxRecords: mxList,
          hasFallbackA: false,
          aRecords: [],
          hasSpf: spfInfo.hasSpf,
          spfRecord: spfInfo.spfRecord,
          hasDmarc: dmarcInfo.hasDmarc,
          dmarcRecord: dmarcInfo.dmarcRecord,
          mxProvider,
          latencyMs: Date.now() - startTime,
        };
      }

      // 2. Fallback check: RFC 5321 specifies that if no MX record exists,
      // an applicable A / AAAA record of the domain itself serves as the mail exchanger fallback.
      const aRecords: string[] = [];
      try {
        const ipv4 = await this.withTimeout(dns.promises.resolve4(cleanDomain), timeoutMs);
        if (ipv4 && ipv4.length > 0) aRecords.push(...ipv4);
      } catch {}

      try {
        const ipv6 = await this.withTimeout(dns.promises.resolve6(cleanDomain), timeoutMs);
        if (ipv6 && ipv6.length > 0) aRecords.push(...ipv6);
      } catch {}

      if (aRecords.length > 0) {
        const [spfInfo, dmarcInfo] = await Promise.all([
          this.resolveSpf(cleanDomain, timeoutMs),
          this.resolveDmarc(cleanDomain, timeoutMs),
        ]);

        return {
          domainStatus: 'valid',
          mxStatus: 'fallback_a',
          mxRecords: [{ exchange: cleanDomain, priority: 0 }],
          hasFallbackA: true,
          aRecords,
          hasSpf: spfInfo.hasSpf,
          spfRecord: spfInfo.spfRecord,
          hasDmarc: dmarcInfo.hasDmarc,
          dmarcRecord: dmarcInfo.dmarcRecord,
          mxProvider: 'Direct A-Record Host',
          latencyMs: Date.now() - startTime,
        };
      }

      // 3. No MX and no A/AAAA record -> Domain does not exist or has no host records
      return {
        domainStatus: 'invalid',
        mxStatus: 'missing',
        mxRecords: [],
        hasFallbackA: false,
        aRecords: [],
        error: `Domain "${cleanDomain}" does not exist or has no MX or A/AAAA records`,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const isTimeout = err.code === 'ETIMEOUT' || err.message?.includes('timed out');
      const isNotFound = err.code === 'ENOTFOUND' || err.code === 'NODATA';

      return {
        domainStatus: isTimeout ? 'timeout' : isNotFound ? 'invalid' : 'error',
        mxStatus: isTimeout ? 'timeout' : isNotFound ? 'missing' : 'error',
        mxRecords: [],
        hasFallbackA: false,
        aRecords: [],
        error: err.message || 'DNS lookup failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  public static detectProvider(exchanges: string[]): string {
    const joined = exchanges.map((e) => e.toLowerCase()).join(' ');
    if (joined.includes('google.com') || joined.includes('googlemail.com') || joined.includes('aspmx')) {
      return 'Google Workspace / Gmail';
    }
    if (joined.includes('outlook.com') || joined.includes('protection.outlook.com') || joined.includes('microsoft')) {
      return 'Microsoft 365 / Outlook';
    }
    if (joined.includes('zoho.com') || joined.includes('zohomail')) {
      return 'Zoho Mail';
    }
    if (joined.includes('yahoodns') || joined.includes('yahoo.com')) {
      return 'Yahoo Mail';
    }
    if (joined.includes('protonmail') || joined.includes('proton.ch')) {
      return 'ProtonMail';
    }
    if (joined.includes('mimecast')) {
      return 'Mimecast Gateway';
    }
    if (joined.includes('pphosted') || joined.includes('proofpoint')) {
      return 'Proofpoint Gateway';
    }
    if (joined.includes('barracudanetworks')) {
      return 'Barracuda Gateway';
    }
    if (joined.includes('icloud') || joined.includes('apple.com')) {
      return 'Apple iCloud Mail';
    }
    return 'Enterprise Mail Server';
  }

  public static async resolveSpf(
    domain: string,
    timeoutMs: number = 3000
  ): Promise<{ hasSpf: boolean; spfRecord?: string }> {
    try {
      const txt = await this.withTimeout(dns.promises.resolveTxt(domain), Math.min(timeoutMs, 2500));
      for (const t of txt) {
        const str = t.join('');
        if (str.toLowerCase().startsWith('v=spf1')) {
          return { hasSpf: true, spfRecord: str };
        }
      }
    } catch {}
    return { hasSpf: false };
  }

  public static async resolveDmarc(
    domain: string,
    timeoutMs: number = 3000
  ): Promise<{ hasDmarc: boolean; dmarcRecord?: string }> {
    try {
      const dmarcTxt = await this.withTimeout(
        dns.promises.resolveTxt(`_dmarc.${domain}`),
        Math.min(timeoutMs, 2500)
      );
      for (const t of dmarcTxt) {
        const str = t.join('');
        if (str.toLowerCase().startsWith('v=dmarc1')) {
          return { hasDmarc: true, dmarcRecord: str };
        }
      }
    } catch {}
    return { hasDmarc: false };
  }
}
