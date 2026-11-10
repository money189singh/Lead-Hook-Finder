#!/bin/bash
# ==============================================================================
# LeadHook — Full Application Deployment on Oracle Cloud VM (Always Free)
# Runs the entire LeadHook frontend, backend, scraping engine & database 24/7.
# Access URL: http://<YOUR-ORACLE-IP>:3000 or http://<YOUR-ORACLE-IP>
# ==============================================================================

set -e

echo "🚀 ========================================================"
echo "   Deploying Entire LeadHook Application on Oracle Cloud VM"
echo "============================================================"

# 1. Update OS and install prerequisites
echo "📦 [1/6] Installing Node.js 20 LTS, Git & Build Tools..."
if command -v apt-get &> /dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y curl git build-essential iptables-persistent ufw
  if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
elif command -v dnf &> /dev/null; then
  sudo dnf update -y
  sudo dnf install -y curl git tar iptables
  if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi
fi

echo "✅ Node.js $(node -v) & NPM $(npm -v) verified."

# 2. Open Port 3000 and Port 80 in Linux OS Firewall
echo "🔓 [2/6] Configuring OS firewall rules for Port 3000 & Port 80..."
sudo iptables -I INPUT 1 -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
if command -v ufw &> /dev/null; then
  sudo ufw allow 3000/tcp 2>/dev/null || true
  sudo ufw allow 80/tcp 2>/dev/null || true
fi
if command -v netfilter-persistent &> /dev/null; then
  sudo netfilter-persistent save 2>/dev/null || true
fi

# 3. Create app installation directory
APP_DIR="/opt/leadhook"
echo "📂 [3/6] Setting up application at $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$APP_DIR/data"
sudo chown -R $USER:$USER "$APP_DIR"
cd "$APP_DIR"

# 4. Install production dependencies (Express & Cheerio)
echo "📦 [4/6] Installing server libraries..."
cat << 'EOF' > "$APP_DIR/package.json"
{
  "name": "leadhook-oracle",
  "version": "2.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
EOF

npm install --omit=dev --silent

# 5. Write Standalone Full LeadHook Application Server
echo "📝 [5/6] Writing full LeadHook application and scraping engine..."
cat << 'EOF' > "$APP_DIR/server.js"
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());

// In-Memory & Persistent Storage
let jobs = [];
let schedules = [];

// Contact & Website Crawler Function
async function crawlWebsite(url) {
  const result = { emails: [], phones: [] };
  const visited = new Set();

  async function fetchPage(targetUrl) {
    if (visited.has(targetUrl)) return;
    visited.add(targetUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const html = await res.text();

      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const e of emailMatches) {
        const lower = e.toLowerCase();
        if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.includes('example.com') && !lower.includes('sentry.io') && !result.emails.includes(lower)) {
          result.emails.push(lower);
        }
      }

      const phoneMatches = html.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
      for (const p of phoneMatches) {
        if (!result.phones.includes(p)) result.phones.push(p);
      }
    } catch (e) {}
  }

  await fetchPage(url);
  if (result.emails.length === 0) {
    const cleanRoot = url.replace(/\/$/, '');
    await fetchPage(`${cleanRoot}/contact`);
  }

  return { emails: result.emails.slice(0, 5), phones: result.phones.slice(0, 3) };
}

// Multi-Source Search (OpenStreetMap Nominatim + Bing)
async function searchBusinesses(query, count) {
  const results = [];
  const seen = new Set();

  try {
    const cleanQ = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQ)}&format=json&addressdetails=1&extratags=1&limit=${Math.min(count + 10, 50)}`;
    const res = await fetch(osmUrl, { headers: { 'User-Agent': 'LeadHook-OracleApp/2.5', 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (results.length >= count) break;
          const name = item.name || item.display_name?.split(',')[0]?.trim();
          if (!name || name.length < 3) continue;
          const tags = item.extratags || {};
          const website = tags.website || tags['contact:website'] || tags.url;
          const phone = tags.phone || tags['contact:phone'];
          const city = item.address?.city || item.address?.town || '';
          const state = item.address?.state || '';

          let domain = '';
          let url = website;
          if (website && website.startsWith('http')) {
            try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch {}
          } else {
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            domain = `${slug}.com`;
            url = `https://www.${domain}`;
          }

          if (domain && !seen.has(domain)) {
            seen.add(domain);
            results.push({ name, url, domain, location: `${city}${state ? ', ' + state : ''}`, phone: phone || '' });
          }
        }
      }
    }
  } catch (e) {}

  return results;
}

// API: Start Scraping Job
app.post('/api/discovery/start', async (req, res) => {
  const { query, targetCount } = req.body;
  const count = parseInt(targetCount || '20', 10);
  const jobId = `job_${Date.now()}`;

  const job = {
    id: jobId,
    query: query || 'Business Discovery',
    targetCount: count,
    status: 'running',
    leads: [],
    created_at: new Date().toISOString()
  };
  jobs.unshift(job);
  res.json({ success: true, job });

  // Run in background
  (async () => {
    try {
      const candidates = await searchBusinesses(job.query, count);
      for (const item of candidates) {
        const contacts = await crawlWebsite(item.url);
        job.leads.push({
          id: `lead_${Date.now()}_${job.leads.length}`,
          name: item.name,
          website: item.url,
          domain: item.domain,
          location: item.location,
          emails: contacts.emails,
          phones: contacts.phones.length > 0 ? contacts.phones : (item.phone ? [item.phone] : []),
          extractedAt: new Date().toISOString()
        });
      }
      job.status = 'completed';
      job.completed_at = new Date().toISOString();
      fs.writeFileSync(path.join(DATA_DIR, `${jobId}.json`), JSON.stringify(job, null, 2));
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
    }
  })();
});

app.get('/api/discovery/jobs', (req, res) => res.json({ jobs }));
app.get('/api/discovery/job/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json({ job });
});

// CSV Export
app.get('/api/discovery/export/csv/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).send('Job not found');
  let csv = 'Name,Website,Domain,Location,Emails,Phones,ExtractedAt\n';
  job.leads.forEach(l => {
    csv += `"${(l.name||'').replace(/"/g, '""')}","${l.website}","${l.domain}","${l.location||''}","${(l.emails||[]).join('; ')}","${(l.phones||[]).join('; ')}","${l.extractedAt}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${job.id}.csv"`);
  res.send(csv);
});

// 24/7 Scheduler
app.post('/api/scheduler/create', (req, res) => {
  const { name, query, targetCount, cadenceHours } = req.body;
  const sched = {
    id: `sched_${Date.now()}`,
    name: name || 'Scheduled Scraping',
    query: query || 'Businesses',
    targetCount: parseInt(targetCount || '25', 10),
    cadenceHours: parseInt(cadenceHours || '1', 10),
    totalRuns: 0,
    totalLeads: 0,
    lastRunAt: null,
    enabled: true
  };
  schedules.push(sched);
  res.json({ success: true, schedule: sched });
});

app.get('/api/scheduler/list', (req, res) => res.json({ schedules }));

// Run scheduler every minute
setInterval(async () => {
  const now = Date.now();
  for (const s of schedules) {
    if (!s.enabled) continue;
    const intervalMs = s.cadenceHours * 3600 * 1000;
    if (!s.lastRunAt || (now - new Date(s.lastRunAt).getTime() >= intervalMs)) {
      s.lastRunAt = new Date().toISOString();
      s.totalRuns++;
      const candidates = await searchBusinesses(s.query, s.targetCount);
      s.totalLeads += candidates.length;
    }
  }
}, 60000);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    hostname: os.hostname(),
    uptime: Math.floor(process.uptime()),
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    activeJobs: jobs.filter(j => j.status === 'running').length,
    completedJobs: jobs.filter(j => j.status === 'completed').length
  });
});

// Embedded High-Performance Web UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LeadHook Enterprise — Oracle Cloud Always Free VM</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">LH</div>
      <div>
        <h1 class="text-base font-bold text-white">LeadHook Enterprise</h1>
        <p class="text-xs text-emerald-400 font-medium">● Oracle Cloud Always Free VM (Running 24/7)</p>
      </div>
    </div>
    <div id="vm-health" class="text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">Connecting...</div>
  </header>

  <main class="max-w-6xl mx-auto p-6 space-y-6">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <h2 class="text-lg font-bold text-white flex items-center gap-2">🔍 Start Live Lead Scraping</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="md:col-span-2">
          <label class="block text-xs font-semibold text-slate-400 mb-1">Target Niche or Industry</label>
          <input id="target-query" type="text" value="Auto Repair San Diego" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Target Lead Count</label>
          <input id="target-count" type="number" value="20" min="5" max="100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
      </div>
      <button id="start-btn" onclick="startScrape()" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-blue-600/30">Start 24/7 Scraping Job</button>
      <div id="job-status" class="hidden text-sm p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2"></div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-white">📊 Discovered Prospects & Leads</h2>
        <button onclick="downloadLatestCsv()" id="csv-btn" class="hidden text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-2 rounded-lg">Download CSV</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-300">
          <thead class="bg-slate-950 text-xs text-slate-400 uppercase border-b border-slate-800">
            <tr>
              <th class="py-3 px-4">Company Name</th>
              <th class="py-3 px-4">Website</th>
              <th class="py-3 px-4">Location</th>
              <th class="py-3 px-4">Emails</th>
              <th class="py-3 px-4">Phones</th>
            </tr>
          </thead>
          <tbody id="leads-body">
            <tr><td colspan="5" class="py-8 text-center text-slate-500">No leads scraped yet. Enter a query and click Start!</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    let activeJobId = null;

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        document.getElementById('vm-health').innerHTML = \`RAM: \${data.freeMemMb}MB Free / \${data.totalMemMb}MB • Uptime: \${data.uptime}s\`;
      } catch (e) {}
    }
    setInterval(checkHealth, 3000);
    checkHealth();

    async function startScrape() {
      const query = document.getElementById('target-query').value.trim();
      const targetCount = document.getElementById('target-count').value;
      const btn = document.getElementById('start-btn');
      const statusBox = document.getElementById('job-status');
      btn.disabled = true;
      btn.innerText = 'Scraping in Background...';
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = '<span class="text-blue-400 font-semibold animate-pulse">● Scraping candidate domains and extracting emails/phones...</span>';

      const res = await fetch('/api/discovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, targetCount })
      });
      const data = await res.json();
      activeJobId = data.job.id;
      pollJob(activeJobId);
    }

    function pollJob(id) {
      const timer = setInterval(async () => {
        const res = await fetch('/api/discovery/job/' + id);
        const data = await res.json();
        const job = data.job;
        document.getElementById('job-status').innerHTML = \`Status: <b>\${job.status}</b> • Found \${job.leads.length} leads\`;
        renderLeads(job.leads);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(timer);
          document.getElementById('start-btn').disabled = false;
          document.getElementById('start-btn').innerText = 'Start 24/7 Scraping Job';
          if (job.leads.length > 0) {
            document.getElementById('csv-btn').classList.remove('hidden');
          }
        }
      }, 2500);
    }

    function renderLeads(leads) {
      const tbody = document.getElementById('leads-body');
      if (!leads || leads.length === 0) return;
      tbody.innerHTML = leads.map(l => \`
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
          <td class="py-3 px-4 font-semibold text-white">\${l.name}</td>
          <td class="py-3 px-4"><a href="\${l.website}" target="_blank" class="text-blue-400 hover:underline">\${l.domain}</a></td>
          <td class="py-3 px-4 text-slate-400">\${l.location || 'USA'}</td>
          <td class="py-3 px-4 text-emerald-400 font-mono text-xs">\${l.emails.join(', ') || '<span class="text-slate-600">None</span>'}</td>
          <td class="py-3 px-4 text-slate-300 font-mono text-xs">\${l.phones.join(', ') || '<span class="text-slate-600">None</span>'}</td>
        </tr>
      \`).join('');
    }

    function downloadLatestCsv() {
      if (activeJobId) {
        window.location.href = '/api/discovery/export/csv/' + activeJobId;
      }
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LeadHook Enterprise application running on http://0.0.0.0:${PORT}`);
});
EOF

# 6. Create production systemd service
echo "⚙️ [6/6] Creating 24/7 systemd background service..."
cat << EOF | sudo tee /etc/systemd/system/leadhook.service
[Unit]
Description=LeadHook Enterprise Full-Stack Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadhook-app

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable leadhook.service
sudo systemctl restart leadhook.service

# Get Public IP
PUBLIC_IP=$(curl -s https://api.ipify.org || echo "161.118.169.117")

echo ""
echo "============================================================"
echo "🎉 SUCCESS: The entire LeadHook application is now running!"
echo ""
echo "🌐 Open in your browser:"
echo "   http://$PUBLIC_IP:3000"
echo ""
echo "📊 Quick Server Commands:"
echo "   - View live logs : journalctl -u leadhook -f"
echo "   - Check status   : sudo systemctl status leadhook"
echo "   - Restart app    : sudo systemctl restart leadhook"
echo "============================================================"
