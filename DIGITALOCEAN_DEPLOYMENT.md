# LeadHook — DigitalOcean Cloud Background Prospect Discovery

This document details the production architecture and deployment steps for running LeadHook's **always-on Background Prospect Discovery layer on DigitalOcean**.

---

## 1. Architectural Overview

```text
                    ┌────────────────────────┐
                    │   LeadHook Frontend    │
                    │ (Browser / Desktop UI) │
                    └───────────┬────────────┘
                                │ HTTP API / WebSockets
                                ▼
                    ┌────────────────────────┐
                    │   LeadHook API Server  │
                    │   (Express / Node.js)  │
                    └───────────┬────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
      ┌─────────────────┐             ┌─────────────────────┐
      │ Persistent Job  │             │ Persistent Database │
      │ Queue & State   │             │ (Firestore / Disk)  │
      └────────┬────────┘             └──────────▲──────────┘
               │                                 │
               ▼                                 │
    ┌──────────────────────┐                     │
    │ DigitalOcean Worker  │─────────────────────┘
    │  (Always-On Process) │  Discovered Prospects, Decision
    │                      │  Makers, Checkpoints & Heartbeats
    │ • Google Maps Search │
    │ • Domain Detector    │
    │ • Web Crawler Engine │
    │ • Decision Makers    │
    │ • Buying Signals     │
    │ • AI Firmographics   │
    │ • Deduplication      │
    └──────────────────────┘
```

### Key Principles
1. **The browser is never the worker**: The browser only creates, monitors, pauses, stops, and views jobs.
2. **Offline resilience**: The user can start a 100-prospect discovery, close their browser, turn off their computer, and return hours later. The worker executes independently in the background and saves progress immediately.
3. **Frequent checkpoints**: If a worker or container restarts, discovery resumes from the last query and prospect index without restarting from zero.
4. **Idempotency & Deduplication**: Existing companies and domains are merged rather than duplicated across jobs.
5. **Real Worker Heartbeat**: The UI queries `/api/cloud-worker/health` to reflect true worker health (Online/Offline, last heartbeat seconds ago).

---

## 2. Deployment Option A: DigitalOcean App Platform (Recommended)

DigitalOcean App Platform deploys both the **Web UI** and the **Background Execution Worker** directly from your repository with automatic SSL and zero server maintenance.

### Steps:
1. Push your repository to GitHub or GitLab.
2. In DigitalOcean Console, go to **Apps** → **Create App**.
3. Select your repository and branch.
4. DigitalOcean will automatically detect `.do/app.yaml`:
   - **`leadhook-web`**: Web UI and Express API (`npm run start`)
   - **`leadhook-discovery-worker`**: Background Execution Worker (`npm run start:worker`)
5. Configure Environment Variables under **Settings** → **App-Level Environment Variables**:
   - `GEMINI_API_KEY`: Your Gemini API Key
   - `GOOGLE_MAPS_API_KEY`: (Optional) Google Maps API key
   - `SEARCH_API_KEY`: (Optional) Search API key
   - `DIGITALOCEAN_WORKER_ID`: `do-worker-ams3-01`
   - `WORKER_CONCURRENCY`: `5`
6. Click **Save** and deploy.

---

## 3. Deployment Option B: DigitalOcean Droplet (Docker & Compose)

Deploy directly to an Ubuntu Droplet with Docker.

### 1. Provision a Droplet
- OS: Ubuntu 24.04 LTS
- Size: Basic (2GB RAM / 1 vCPU or 4GB RAM recommended for heavy crawling)
- Region: AMS3, NYC1, or your preferred region

### 2. Connect & Clone
```bash
ssh root@<DROPLET_IP>
apt-get update && apt-get install -y docker.io docker-compose git
git clone <YOUR_REPO_URL> /opt/leadhook
cd /opt/leadhook
```

### 3. Configure Environment
```bash
cp .env.example .env
nano .env
```
Ensure `GEMINI_API_KEY`, `WORKER_CONCURRENCY=5`, and `DIGITALOCEAN_WORKER_ID` are set.

### 4. Build and Start
```bash
docker-compose up -d --build
```

### 5. Verify Running Services
```bash
docker-compose ps
docker-compose logs -f leadhook-worker
```

---

## 4. Environment Variables Reference

| Variable | Default | Purpose |
|---|---|---|
| `DIGITALOCEAN_WORKER_ID` | `leadhook-worker-01` | Unique identifier reported in heartbeats |
| `WORKER_CONCURRENCY` | `5` | Maximum simultaneous prospect crawls |
| `WORKER_POLL_INTERVAL_MS` | `2500` | Milliseconds between queue checks |
| `HEARTBEAT_INTERVAL_MS` | `5000` | Milliseconds between worker heartbeat writes |
| `DISABLE_EMBEDDED_WORKER`| `false` | Set to `true` when running standalone worker container |
| `GEMINI_API_KEY` | — | Gemini AI key for decision-maker & signal reasoning |
| `GOOGLE_MAPS_API_KEY` | — | (Optional) Maps place and business extractor |
| `SEARCH_API_KEY` | — | (Optional) Search provider key |

---

## 5. Health & Verification Endpoints

- **Worker Health**: `GET /api/cloud-worker/health`
  ```json
  {
    "status": "online",
    "workerId": "leadhook-worker-01",
    "lastHeartbeat": "2026-10-04T10:20:00.000Z",
    "secondsSinceHeartbeat": 2,
    "activeJobs": 1,
    "queuedJobs": 0,
    "completedJobs": 4,
    "failedTasks": 0,
    "concurrency": 5,
    "uptimeSeconds": 3600
  }
  ```
- **Jobs API**: `GET /api/discovery/jobs`
- **Single Job**: `GET /api/discovery/jobs/:id`
- **Pause Job**: `POST /api/discovery/jobs/:id/pause`
- **Resume Job**: `POST /api/discovery/jobs/:id/resume`
- **Stop Job**: `POST /api/discovery/jobs/:id/stop`
- **Retry Job**: `POST /api/discovery/jobs/:id/retry`
