#!/bin/bash
# ==============================================================================
# LeadHook — Oracle Cloud "Always Free" VM Worker Provisioning Script
# Target: Ubuntu 22.04 / 24.04 LTS (AMD64 or ARM64 Ampere) on Oracle Cloud
# ==============================================================================

set -e

echo "🚀 Starting LeadHook Oracle Cloud Always Free Worker Setup..."

# 1. Update system packages
sudo apt-get update -y
sudo apt-get install -y curl git build-essential ufw

# 2. Install Node.js 20 LTS (NodeSource supports both x86_64 and ARM64)
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "✅ Node version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 3. Create deployment directory
DEPLOY_DIR="/opt/leadhook"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown -R $USER:$USER "$DEPLOY_DIR"

# 4. Setup .env configuration
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "📝 Writing environment configuration..."
  cat <<EOT > "$DEPLOY_DIR/.env"
NODE_ENV=production
WORKER_CONCURRENCY=5
CLOUD_VM_HOST=true
PROVIDER=oracle_cloud_always_free

# Your LeadHook App URL
APP_API_URL=https://ais-dev-puycp3nkzzx4cfa5xngg32-574176551840.asia-southeast1.run.app

# Optional AI Provider API Keys
# GEMINI_API_KEY=
# NVIDIA_API_KEY=
EOT
fi

# 5. Create systemd 24/7 background service
echo "⚙️ Configuring systemd service to run 24/7..."
cat <<EOT | sudo tee /etc/systemd/system/leadhook-worker.service
[Unit]
Description=LeadHook Oracle Cloud Always Free 24/7 Discovery Worker
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=WORKER_CONCURRENCY=5
Environment=CLOUD_VM_HOST=true
EnvironmentFile=-$DEPLOY_DIR/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=leadhook-worker

[Install]
WantedBy=multi-user.target
EOT

sudo systemctl daemon-reload
sudo systemctl enable leadhook-worker

echo "=============================================================================="
echo "🎉 LeadHook Oracle Cloud Worker Installed Successfully!"
echo ""
echo "Next Steps:"
echo "  1. Copy your LeadHook code into $DEPLOY_DIR"
echo "  2. cd $DEPLOY_DIR && npm install"
echo "  3. Start worker:       sudo systemctl start leadhook-worker"
echo "  4. Check status:       sudo systemctl status leadhook-worker"
echo "  5. Live stream logs:   journalctl -u leadhook-worker -f"
echo "=============================================================================="
