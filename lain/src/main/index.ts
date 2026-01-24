import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { TerminalService } from './services/terminal.service';
import { AIService } from './services/ai.service';
import { OllamaManagerService } from './services/ollama-manager.service';
import { StorageService } from './services/storage.service';
import { registerIPCHandlers } from './ipc-handlers';
import { IPC_CHANNELS } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;

// Initialize services
const terminalService = new TerminalService();
const aiService = new AIService();
const ollamaManagerService = new OllamaManagerService();
const storageService = new StorageService();

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
registerIPCHandlers(terminalService, aiService, ollamaManagerService, storageService);

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
  createWindow();

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
