// Electron Main Process for Website Contact Scraper
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 3000;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#090d16',
    title: 'Website Contact Scraper',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load the web application
  const appUrl = `http://127.0.0.1:${BACKEND_PORT}`;
  mainWindow.loadURL(appUrl).catch(() => {
    // Retry if backend isn't quite ready yet
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(appUrl);
    }, 1500);
  });
}

// Start backend automatically
function startBackend() {
  if (isDev && process.env.VITE_DEV_SERVER) {
    // Dev server already started externally
    createWindow();
    return;
  }

  // Determine path to bundled backend executable or node server
  const resourcesPath = process.resourcesPath || __dirname;
  const pythonExePath = path.join(resourcesPath, 'backend', 'dist', 'main.exe');
  const nodeServerPath = path.join(__dirname, '../dist/server.cjs');

  const fs = require('fs');

  if (fs.existsSync(pythonExePath)) {
    console.log('Spawning bundled Python backend:', pythonExePath);
    backendProcess = spawn(pythonExePath, [], {
      stdio: 'pipe',
      detached: false,
    });
  } else if (fs.existsSync(nodeServerPath)) {
    console.log('Spawning bundled Node backend:', nodeServerPath);
    backendProcess = spawn(process.execPath || 'node', [nodeServerPath], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
    });
  } else {
    // In local non-packaged runs, fall back to npm start or direct connection
    console.log('Connecting to existing server at port', BACKEND_PORT);
  }

  if (backendProcess) {
    backendProcess.stdout?.on('data', (d) => console.log(`[Backend] ${d.toString().trim()}`));
    backendProcess.stderr?.on('data', (d) => console.error(`[Backend Err] ${d.toString().trim()}`));
    backendProcess.on('exit', (code) => console.log(`Backend process exited with code ${code}`));
  }

  // Wait for backend to be healthy before displaying window
  waitForBackend(`http://127.0.0.1:${BACKEND_PORT}/api/health`, 15000)
    .then(() => createWindow())
    .catch((err) => {
      console.warn('Backend readiness timeout, launching window anyway:', err);
      createWindow();
    });
}

function waitForBackend(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else if (Date.now() - start > timeoutMs) reject(new Error('Timeout waiting for backend'));
          else setTimeout(check, 400);
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) resolve(); // Continue anyway
          else setTimeout(check, 400);
        });
    };
    check();
  });
}

// Graceful cleanup of backend and child processes on quit
function cleanupBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      console.log('Terminating backend process...');
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error stopping backend process:', e);
    }
    backendProcess = null;
  }
}

app.on('ready', startBackend);

app.on('window-all-closed', () => {
  cleanupBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', cleanupBackend);
app.on('will-quit', cleanupBackend);

// IPC Handlers
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:open-external', (_, url) => shell.openExternal(url));
