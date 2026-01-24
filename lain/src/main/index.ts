import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { TerminalService } from './services/terminal.service';
import { EmbeddedAIService } from './services/embedded-ai.service';
import { StorageService } from './services/storage.service';
import { registerIPCHandlers } from './ipc-handlers';
import { IPC_CHANNELS } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;

// Initialize services
const terminalService = new TerminalService();
const aiService = new EmbeddedAIService();
const storageService = new StorageService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
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

async function initializeAI() {
  try {
    const isDownloaded = await aiService.isModelDownloaded();
    
    if (!isDownloaded) {
      // Model not downloaded yet
      console.log('AI model not downloaded. User can download from onboarding.');
    } else {
      // Initialize AI in background (non-blocking)
      aiService.initialize((status, progress) => {
        console.log(`AI init: ${status} ${progress}%`);
        mainWindow?.webContents.send('ai:init-progress', { status, progress });
      }).catch(error => {
        console.error('Failed to initialize AI:', error);
      });
    }
  } catch (error) {
    console.error('Error checking AI model:', error);
  }
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
registerIPCHandlers(terminalService, aiService, storageService);

// App lifecycle
app.whenReady().then(() => {
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
