import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron';
import type { Session } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { TerminalService } from './services/terminal.service';
import { AIService } from './services/ai.service';
import { OllamaManagerService } from './services/ollama-manager.service';
import { StorageService } from './services/storage.service';
import { SecureStoreService } from './services/secure-store.service';
import { ProviderManager } from './services/providers/manager';
import { AgentOrchestrator } from './agent/orchestrator';
import { registerIPCHandlers } from './ipc-handlers';
import { IPC_CHANNELS } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;
const activeDownloads = new Map<string, Electron.DownloadItem>();
const downloadSessions = new WeakSet<Session>();

// Initialize services
const terminalService = new TerminalService();
const secureStore = new SecureStoreService();
const providerManager = new ProviderManager(secureStore);
const aiService = new AIService(providerManager);
const ollamaManagerService = new OllamaManagerService();
const storageService = new StorageService();
const orchestrator = new AgentOrchestrator(providerManager, () => mainWindow);

function getAppIconPath(): string {
  // In packaged builds, we bundle project `resources/` into `process.resourcesPath/resources`.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'icon.png');
  }
  // In dev, Electron runs from the project root; use project `resources/`.
  return path.join(process.cwd(), 'resources', 'icon.png');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    // Affects window icon on Windows/Linux; on macOS the app icon is from the bundle.
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset',
    frame: true
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools are useful while developing, but should not pop open by default.
    // To open automatically, set OPEN_DEVTOOLS=true in your environment.
    if (process.env.OPEN_DEVTOOLS === 'true') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Don't auto-initialize AI - let user trigger it from onboarding
  // This avoids blocking the app startup

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Download handling
function setupDownloadHandling() {
  setupDownloadHandlingForSession(session.defaultSession);
}

function setupDownloadHandlingForSession(s: Session) {
  if (downloadSessions.has(s)) return;
  downloadSessions.add(s);

  s.on('will-download', (_event, item, _webContents) => {
    const downloadId = `download-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const filename = item.getFilename();
    const downloadPath = path.join(os.homedir(), 'Downloads', filename);
    
    item.setSavePath(downloadPath);
    activeDownloads.set(downloadId, item);
    
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_START, {
        id: downloadId,
        url: item.getURL(),
        filename: filename,
        savePath: downloadPath,
        totalBytes: item.getTotalBytes(),
      });
    }
    
    item.on('updated', (_event, state) => {
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
          id: downloadId,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          state: state,
        });
      }
    });
    
    item.once('done', (_event, state) => {
      activeDownloads.delete(downloadId);
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETE, {
          id: downloadId,
          state: state,
          savePath: item.getSavePath(),
        });
      }
    });
  });
}

// Download IPC handlers
ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CANCEL, (_event, downloadId: string) => {
  const item = activeDownloads.get(downloadId);
  if (item) {
    item.cancel();
    activeDownloads.delete(downloadId);
  }
  return { success: true };
});

ipcMain.handle(IPC_CHANNELS.DOWNLOAD_PAUSE, (_event, downloadId: string) => {
  const item = activeDownloads.get(downloadId);
  if (item && item.canResume()) {
    item.pause();
  }
  return { success: true };
});

ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RESUME, (_event, downloadId: string) => {
  const item = activeDownloads.get(downloadId);
  if (item && item.isPaused()) {
    item.resume();
  }
  return { success: true };
});

// Shell handlers
ipcMain.handle('shell:open-path', async (_event, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Handle onboarding events
ipcMain.on(IPC_CHANNELS.ONBOARDING_COMPLETE, () => {
  if (mainWindow) {
    mainWindow.reload();
  }
});

ipcMain.on(IPC_CHANNELS.ONBOARDING_SKIP, () => {
  // Continue without AI
  if (mainWindow) {
    mainWindow.reload();
  }
});

// Register all IPC handlers
registerIPCHandlers(
  terminalService,
  aiService,
  ollamaManagerService,
  storageService,
  secureStore,
  providerManager,
  orchestrator
);

// App lifecycle
app.whenReady().then(() => {
  // In dev on macOS, Electron shows the default icon unless we set it explicitly.
  if (process.platform === 'darwin') {
    try {
      const img = nativeImage.createFromPath(getAppIconPath());
      if (!img.isEmpty()) {
        app.dock.setIcon(img);
      }
    } catch {
      // ignore
    }
  }

  setupDownloadHandling();
  createWindow();

  // Handle downloads for webview sessions
  app.on('web-contents-created', (_event, contents) => {
    try {
      setupDownloadHandlingForSession(contents.session);
    } catch {
      // ignore
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    storageService.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  storageService.close();
});
