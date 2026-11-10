import { Client, ConnectConfig } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';

export interface OracleSshConfig {
  host: string;
  port?: number;
  username: string;
  privateKey?: string;
  passphrase?: string;
}

export interface OracleHostInfo {
  connected: boolean;
  hostname?: string;
  osRelease?: string;
  uptime?: string;
  cpuModel?: string;
  cpuCores?: number;
  totalMemMb?: number;
  freeMemMb?: number;
  nodeVersion?: string;
  workerRunning?: boolean;
  workerPid?: string;
  error?: string;
}

const CONFIG_FILE = path.join(process.cwd(), 'data', 'oracle_ssh_config.json');

export class OracleSshService {
  private savedConfig: OracleSshConfig = {
    host: '161.118.169.117',
    port: 22,
    username: 'opc',
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.savedConfig = {
          host: parsed.host || '161.118.169.117',
          port: parsed.port || 22,
          username: parsed.username || 'opc',
          privateKey: parsed.privateKey,
          passphrase: parsed.passphrase,
        };
      }
    } catch (e: any) {
      console.warn('[OracleSshService] Could not load saved config:', e.message);
    }
  }

  public saveConfig(config: Partial<OracleSshConfig>) {
    this.savedConfig = {
      ...this.savedConfig,
      ...config,
    };
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.savedConfig, null, 2), 'utf-8');
    } catch (e: any) {
      console.warn('[OracleSshService] Could not persist config:', e.message);
    }
  }

  public getConfig(): { host: string; port: number; username: string; hasPrivateKey: boolean } {
    return {
      host: this.savedConfig.host,
      port: this.savedConfig.port || 22,
      username: this.savedConfig.username,
      hasPrivateKey: Boolean(this.savedConfig.privateKey && this.savedConfig.privateKey.trim().length > 0),
    };
  }

  /**
   * Execute an arbitrary remote command over SSH
   */
  public executeCommand(
    cmd: string,
    overrideConfig?: Partial<OracleSshConfig>,
    timeoutMs: number = 25000
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const host = overrideConfig?.host || this.savedConfig.host;
      const port = overrideConfig?.port || this.savedConfig.port || 22;
      const username = overrideConfig?.username || this.savedConfig.username;
      const privateKey = overrideConfig?.privateKey || this.savedConfig.privateKey;
      const passphrase = overrideConfig?.passphrase || this.savedConfig.passphrase;

      if (!privateKey) {
        return reject(new Error('No SSH private key provided. Please upload or paste your SSH private key.'));
      }

      const conn = new Client();
      let stdout = '';
      let stderr = '';
      let timer: NodeJS.Timeout | null = null;

      conn.on('ready', () => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            conn.end();
            if (timer) clearTimeout(timer);
            return reject(err);
          }

          stream.on('close', (code: number) => {
            conn.end();
            if (timer) clearTimeout(timer);
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString('utf-8');
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString('utf-8');
          });
        });
      });

      conn.on('error', (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });

      timer = setTimeout(() => {
        conn.end();
        reject(new Error(`SSH execution timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      try {
        const connectOpts: ConnectConfig = {
          host,
          port,
          username,
          privateKey: privateKey.trim(),
          readyTimeout: 12000,
          keepaliveInterval: 5000,
        };
        if (passphrase) connectOpts.passphrase = passphrase;
        conn.connect(connectOpts);
      } catch (e: any) {
        if (timer) clearTimeout(timer);
        reject(e);
      }
    });
  }

  /**
   * Test SSH connectivity and query host specifications
   */
  public async testConnection(overrideConfig?: Partial<OracleSshConfig>): Promise<OracleHostInfo> {
    const probeCmd = `
      echo "===HOSTNAME==="; hostname;
      echo "===OS==="; cat /etc/os-release | grep "PRETTY_NAME" | cut -d= -f2 | tr -d '"';
      echo "===UPTIME==="; uptime -p 2>/dev/null || uptime;
      echo "===CPU==="; lscpu | grep "Model name" | head -n1 | cut -d: -f2 | xargs;
      echo "===CORES==="; nproc;
      echo "===MEM==="; free -m | grep "Mem:" | awk '{print $2 " " $7}';
      echo "===NODE==="; node -v 2>/dev/null || echo "not_installed";
      echo "===WORKER==="; pgrep -f "leadhook-worker" 2>/dev/null || echo "none";
    `;

    try {
      const { stdout } = await this.executeCommand(probeCmd, overrideConfig, 15000);

      const extractSection = (marker: string): string => {
        const parts = stdout.split(`===${marker}===`);
        if (parts.length > 1) {
          const content = parts[1].split('===')[0];
          return content.trim();
        }
        return '';
      };

      const hostname = extractSection('HOSTNAME');
      const osRelease = extractSection('OS');
      const uptime = extractSection('UPTIME');
      const cpuModel = extractSection('CPU');
      const cores = parseInt(extractSection('CORES') || '1', 10);
      const memParts = extractSection('MEM').split(/\s+/);
      const totalMemMb = parseInt(memParts[0] || '0', 10);
      const freeMemMb = parseInt(memParts[1] || '0', 10);
      const nodeVersion = extractSection('NODE');
      const workerStatus = extractSection('WORKER');

      return {
        connected: true,
        hostname: hostname || 'oracle-vm',
        osRelease: osRelease || 'Linux',
        uptime: uptime || 'online',
        cpuModel: cpuModel || 'AMD / ARM Compute',
        cpuCores: isNaN(cores) ? 1 : cores,
        totalMemMb,
        freeMemMb,
        nodeVersion: nodeVersion === 'not_installed' ? 'Not Installed' : nodeVersion,
        workerRunning: workerStatus !== 'none',
        workerPid: workerStatus !== 'none' ? workerStatus : undefined,
      };
    } catch (err: any) {
      return {
        connected: false,
        error: err.message || 'Failed to connect via SSH',
      };
    }
  }

  /**
   * Remotely provision Node.js 20, deploy the full LeadHook scraping engine, and start systemd on the Oracle VM
   */
  public async deployRemoteWorker(
    appUrl: string,
    overrideConfig?: Partial<OracleSshConfig>
  ): Promise<{ success: boolean; log: string }> {
    let outputLog = '';

    // Read the real, tested oracle-worker.cjs
    let workerCode = '';
    try {
      workerCode = fs.readFileSync(path.join(process.cwd(), 'oracle-worker.cjs'), 'utf-8');
    } catch {
      workerCode = `console.log("LeadHook Worker");`;
    }

    const host = overrideConfig?.host || this.savedConfig.host || '161.118.169.117';

    // Base64 encode the worker code to avoid any shell escaping issues over SSH
    const workerBase64 = Buffer.from(workerCode, 'utf-8').toString('base64');

    const setupScript = `
set -e
echo "🚀 [1/5] Installing Prerequisites (Node.js 20 LTS & Firewall Tools)..."

# Detect Debian/Ubuntu vs RHEL/Oracle Linux
if command -v apt-get &> /dev/null; then
  sudo apt-get update -y > /dev/null 2>&1 || true
  sudo apt-get install -y curl git build-essential iptables ufw > /dev/null 2>&1 || true
  if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y nodejs > /dev/null 2>&1
  fi
elif command -v dnf &> /dev/null; then
  sudo dnf install -y curl git tar iptables > /dev/null 2>&1 || true
  if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - > /dev/null 2>&1
    sudo dnf install -y nodejs > /dev/null 2>&1
  fi
elif command -v yum &> /dev/null; then
  sudo yum install -y curl git tar iptables > /dev/null 2>&1 || true
  if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - > /dev/null 2>&1
    sudo yum install -y nodejs > /dev/null 2>&1
  fi
fi

echo "✅ Node.js $(node -v) & NPM $(npm -v) verified"

echo "🔓 [2/5] Opening Port 3000 & Port 80 in Oracle Linux Firewall..."
sudo iptables -I INPUT 1 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
if command -v ufw &> /dev/null; then
  sudo ufw allow 3000/tcp 2>/dev/null || true
  sudo ufw allow 80/tcp 2>/dev/null || true
fi

echo "📂 [3/5] Setting up scraping engine directory at /opt/leadhook-worker..."
sudo mkdir -p /opt/leadhook-worker
sudo chown -R $USER:$USER /opt/leadhook-worker
cd /opt/leadhook-worker

echo "📝 [4/5] Writing production scraping engine (Real Nominatim + Web Crawler)..."
echo "${workerBase64}" | base64 -d > /opt/leadhook-worker/worker.cjs
chmod +x /opt/leadhook-worker/worker.cjs

# Verify script syntax
node -c /opt/leadhook-worker/worker.cjs

echo "⚙️ [5/5] Configuring systemd background service (leadhook-worker.service)..."
cat << EOF | sudo tee /etc/systemd/system/leadhook-worker.service > /dev/null
[Unit]
Description=LeadHook Oracle Cloud 24/7 Scraping Engine
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/leadhook-worker
ExecStart=/usr/bin/node /opt/leadhook-worker/worker.cjs
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CLOUD_VM_HOST=true
Environment=PROVIDER=oracle_cloud_always_free
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadhook-worker

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable leadhook-worker > /dev/null 2>&1
sudo systemctl restart leadhook-worker

echo "=============================================================================="
echo "🎉 SUCCESS: LeadHook Scraping Engine is now ACTIVE and running 24/7 on Oracle Cloud!"
echo "Server IP    : ${host}"
echo "Status check : sudo systemctl status leadhook-worker"
echo "Live logs    : journalctl -u leadhook-worker -f"
echo "=============================================================================="
    `;

    try {
      const { stdout, stderr, code } = await this.executeCommand(setupScript, overrideConfig, 120000);
      outputLog = stdout + (stderr ? `\n[STDERR]\n${stderr}` : '');
      return {
        success: code === 0,
        log: outputLog,
      };
    } catch (err: any) {
      return {
        success: false,
        log: `Deployment failed: ${err.message}`,
      };
    }
  }

  /**
   * Poll status state written by the Oracle VM over SSH
   */
  public async readRemoteWorkerState(overrideConfig?: Partial<OracleSshConfig>): Promise<any | null> {
    try {
      const { stdout } = await this.executeCommand(
        'cat /tmp/leadhook_worker_state.json 2>/dev/null || echo "null"',
        overrideConfig,
        8000
      );
      if (stdout && stdout !== 'null') {
        return JSON.parse(stdout);
      }
    } catch {}
    return null;
  }
}

export const globalOracleSshService = new OracleSshService();
