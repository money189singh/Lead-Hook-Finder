import fs from 'fs';
import path from 'path';

export interface CronJobOrgConfig {
  connected: boolean;
  apiKey?: string;
  jobId?: number;
  title?: string;
  webhookUrl?: string;
  cadenceMinutes?: number;
  connectedAt?: string;
  lastIncomingPingAt?: string;
  lastIncomingUserAgent?: string;
  totalPingsReceived: number;
}

const CONFIG_DIR = path.join(process.cwd(), 'data', 'recurring_schedules');
const CONFIG_FILE = path.join(CONFIG_DIR, 'cronjob_org_config.json');

export class CronjobOrgService {
  private config: CronJobOrgConfig = {
    connected: false,
    totalPingsReceived: 0,
  };

  constructor() {
    this.ensureDirs();
    this.load();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[CronjobOrgService] Failed to create config dir:', err);
    }
  }

  private load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.config = { ...this.config, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('[CronjobOrgService] Failed to load config:', err);
    }
  }

  private save() {
    try {
      this.ensureDirs();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CronjobOrgService] Failed to save config:', err);
    }
  }

  public getStatus(defaultWebhookUrl?: string) {
    return {
      connected: this.config.connected,
      jobId: this.config.jobId,
      title: this.config.title || 'LeadHook 24/7 Autopilot Scraper',
      webhookUrl: this.config.webhookUrl || defaultWebhookUrl,
      cadenceMinutes: this.config.cadenceMinutes || 60,
      connectedAt: this.config.connectedAt,
      lastIncomingPingAt: this.config.lastIncomingPingAt,
      lastIncomingUserAgent: this.config.lastIncomingUserAgent,
      totalPingsReceived: this.config.totalPingsReceived || 0,
      hasApiKey: Boolean(this.config.apiKey),
      maskedApiKey: this.config.apiKey
        ? `${this.config.apiKey.substring(0, 4)}••••••••${this.config.apiKey.substring(this.config.apiKey.length - 4)}`
        : undefined,
    };
  }

  public recordPing(userAgent?: string) {
    this.config.lastIncomingPingAt = new Date().toISOString();
    this.config.lastIncomingUserAgent = userAgent || 'Unknown';
    this.config.totalPingsReceived = (this.config.totalPingsReceived || 0) + 1;
    this.save();
  }

  /**
   * Validates an API key with cron-job.org
   */
  public async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch('https://api.cron-job.org/jobs', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      });

      if (res.status === 401) {
        return { valid: false, error: 'Invalid API key. Please check your token at console.cron-job.org/settings.' };
      }

      if (!res.ok) {
        const text = await res.text();
        return { valid: false, error: `cron-job.org returned HTTP ${res.status}: ${text || res.statusText}` };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `Connection failed: ${err.message}` };
    }
  }

  /**
   * Connects and schedules the job via cron-job.org REST API
   */
  public async connectWithApiKey(params: {
    apiKey: string;
    webhookUrl: string;
    cadenceMinutes?: number;
    title?: string;
  }): Promise<{ success: boolean; jobId?: number; message: string; error?: string }> {
    const { apiKey, webhookUrl, cadenceMinutes = 60, title = 'LeadHook 24/7 Autopilot Scraper' } = params;
    const cleanKey = apiKey.trim();

    let targetWebhookUrl = webhookUrl;
    if (!targetWebhookUrl || targetWebhookUrl.includes('localhost') || targetWebhookUrl.includes('127.0.0.1')) {
      targetWebhookUrl = 'https://ais-dev-puycp3nkzzx4cfa5xngg32-574176551840.asia-southeast1.run.app/api/scheduler/cron-tick';
    }

    // 1. Verify key
    const val = await this.validateApiKey(cleanKey);
    if (!val.valid) {
      return { success: false, error: val.error || 'Failed to authenticate with cron-job.org', message: '' };
    }

    // 2. Compute minute array for cron schedule
    let minutes: number[] = [0];
    if (cadenceMinutes === 15) {
      minutes = [0, 15, 30, 45];
    } else if (cadenceMinutes === 30) {
      minutes = [0, 30];
    } else {
      minutes = [0];
    }

    // 3. Check if existing job is already listed
    let existingJobId: number | undefined;
    try {
      const listRes = await fetch('https://api.cron-job.org/jobs', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const jobs = listData?.jobs || [];
        const match = jobs.find((j: any) => j.url === targetWebhookUrl || j.title === title);
        if (match) {
          existingJobId = match.jobId;
        }
      }
    } catch {
      // ignore list failures
    }

    // 4. Create or update job
    const jobPayload = {
      job: {
        url: targetWebhookUrl,
        title,
        enabled: true,
        saveResponses: true,
        schedule: {
          timezone: 'UTC',
          expiresAt: 0,
          hours: [-1],
          minutes,
          mdays: [-1],
          months: [-1],
          wdays: [-1],
        },
        requestMethod: 0, // 0 = GET
        extendedData: {
          headers: {
            'User-Agent': 'cron-job.org/leadhook-autopilot',
          },
        },
      },
    };

    let createdJobId: number | undefined = existingJobId;

    try {
      if (existingJobId) {
        // Update existing job
        const patchRes = await fetch(`https://api.cron-job.org/jobs/${existingJobId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobPayload),
        });

        if (!patchRes.ok) {
          // If patch fails, attempt PUT to create fresh
          const putRes = await fetch('https://api.cron-job.org/jobs', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(jobPayload),
          });
          if (putRes.ok) {
            const data = await putRes.json();
            createdJobId = data.jobId;
          }
        }
      } else {
        // Create new job via PUT
        const putRes = await fetch('https://api.cron-job.org/jobs', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobPayload),
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          return {
            success: false,
            message: '',
            error: `Failed to create job on cron-job.org: ${errText || putRes.statusText}`,
          };
        }

        const data = await putRes.json();
        createdJobId = data.jobId;
      }

      this.config = {
        ...this.config,
        connected: true,
        apiKey: cleanKey,
        jobId: createdJobId,
        title,
        webhookUrl: targetWebhookUrl,
        cadenceMinutes,
        connectedAt: new Date().toISOString(),
      };
      this.save();

      return {
        success: true,
        jobId: createdJobId,
        message: `Successfully connected 24/7 Cloud Autopilot to cron-job.org! Pinging every ${cadenceMinutes} minutes.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: '',
        error: `cron-job.org registration error: ${err.message}`,
      };
    }
  }

  /**
   * Disconnects cron-job.org
   */
  public async disconnect(): Promise<{ success: boolean; message: string }> {
    if (this.config.jobId && this.config.apiKey) {
      try {
        await fetch(`https://api.cron-job.org/jobs/${this.config.jobId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        });
      } catch (err) {
        console.warn('[CronjobOrgService] Failed to delete job from cron-job.org:', err);
      }
    }

    this.config.connected = false;
    this.config.apiKey = undefined;
    this.config.jobId = undefined;
    this.save();

    return {
      success: true,
      message: 'Disconnected from cron-job.org.',
    };
  }
}

export const globalCronjobOrgService = new CronjobOrgService();
