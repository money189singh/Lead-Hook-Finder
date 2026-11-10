#!/bin/bash
# ==============================================================================
# LeadHook — Google Cloud / Firebase VM Worker Provisioning Script
# Target: Ubuntu 22.04 / 24.04 LTS or Debian 11 / 12 on Google Compute Engine
# ==============================================================================

set -e

echo "🚀 Starting LeadHook Cloud VM Background Worker Provisioning..."

# 1. Update OS packages
sudo apt-get update -y
sudo apt-get install -y curl git build-essential ufw

# 2. Install Node.js 20 LTS (NodeSource)
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

# 4. Prompt / configure environment variables if not present
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "📝 Creating $DEPLOY_DIR/.env configuration..."
  cat <<EOT > "$DEPLOY_DIR/.env"
NODE_ENV=production
WORKER_CONCURRENCY=5
CLOUD_VM_HOST=true
# Set your web app URL (Cloud Run or custom domain)
# APP_API_URL=https://ais-dev-puycp3nkzzx4cfa5xngg32-574176551840.asia-southeast1.run.app

# AI Provider Keys
# GEMINI_API_KEY=
# NVIDIA_API_KEY=
EOT
  echo "⚠️ Please edit $DEPLOY_DIR/.env with your APP_API_URL and API keys."
fi

# 5. Install systemd service
echo "⚙️ Installing systemd worker service..."
sudo cp "$DEPLOY_DIR/scripts/systemd/leadhook-worker.service" /etc/systemd/system/ 2>/dev/null || cat <<EOT | sudo tee /etc/systemd/system/leadhook-worker.service
[Unit]
Description=LeadHook Firebase / Cloud VM Background Discovery Worker
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
echo "🎉 LeadHook Cloud VM Worker is ready!"
echo ""
echo "Quick Commands:"
echo "  1. Start worker:        sudo systemctl start leadhook-worker"
echo "  2. Check live status:   sudo systemctl status leadhook-worker"
echo "  3. Stream live logs:    journalctl -u leadhook-worker -f"
echo "  4. Restart worker:      sudo systemctl restart leadhook-worker"
echo "=============================================================================="
