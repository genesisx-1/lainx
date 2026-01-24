# LAIN - Desktop Browser Shell
## Complete Build Plan & Implementation Guide

### Core Identity
**LAIN = Productivity Browser + Terminal + Local AI Assistant**

A desktop application that fuses browsing, terminal execution, and AI automation into a unified workspace for operators who want to browse → execute → automate.

---

## Tech Stack Decision: Electron

### Why Electron (not Tauri)
- **Real browser tabs** with full Chromium capabilities
- **Better extension patterns** for future customization
- **Easier WebView integration** for AI panels
- **Node.js ecosystem** for terminal, file ops, browser automation
- **Faster MVP** without Rust learning curve

### Core Technologies
```
Frontend:
- React 18 + TypeScript
- TailwindCSS (for that clean black/graphite UI)
- xterm.js (terminal emulation)
- Zustand (state management)

Backend/Desktop:
- Electron 28+
- node-pty (real shell access)
- Playwright (browser automation)
- Ollama API client (local AI)

Storage:
- SQLite (better-sqlite3)
- electron-store (settings/preferences)
```

---

## Exact Repo Structure

```
lain/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tailwind.config.js
│
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # App entry point
│   │   ├── window.ts              # Window management
│   │   ├── ipc-handlers.ts        # IPC communication
│   │   ├── services/
│   │   │   ├── terminal.service.ts    # node-pty wrapper
│   │   │   ├── ai.service.ts          # Ollama client
│   │   │   ├── browser.service.ts     # Playwright automation
│   │   │   ├── storage.service.ts     # SQLite + electron-store
│   │   │   └── permissions.service.ts # Permission prompts
│   │   └── security/
│   │       ├── command-validator.ts   # Terminal command safety
│   │       └── tool-permissions.ts    # AI tool access control
│   │
│   ├── renderer/                  # React frontend
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Browser/
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── AddressBar.tsx
│   │   │   │   ├── WebView.tsx
│   │   │   │   └── FocusMode.tsx
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalPanel.tsx
│   │   │   │   ├── CommandSearch.tsx  # Your terminal search feature
│   │   │   │   └── TerminalChat.tsx   # AI in terminal context
│   │   │   ├── Assistant/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── ToolSuggestions.tsx
│   │   │   │   ├── TaskHistory.tsx
│   │   │   │   └── PermissionDialog.tsx
│   │   │   ├── Capsules/
│   │   │   │   ├── CapsuleManager.tsx
│   │   │   │   ├── CapsuleEditor.tsx
│   │   │   │   └── WorkspaceLayout.tsx
│   │   │   └── UI/
│   │   │       ├── Sidebar.tsx
│   │   │       ├── TopBar.tsx
│   │   │       └── ContextMenu.tsx
│   │   ├── hooks/
│   │   │   ├── useTerminal.ts
│   │   │   ├── useAI.ts
│   │   │   ├── useBrowser.ts
│   │   │   └── useCapsules.ts
│   │   ├── store/
│   │   │   ├── browser.store.ts
│   │   │   ├── terminal.store.ts
│   │   │   ├── ai.store.ts
│   │   │   └── ui.store.ts
│   │   └── styles/
│   │       └── globals.css
│   │
│   └── shared/
│       ├── types.ts               # Shared TypeScript types
│       ├── constants.ts
│       └── ipc-channels.ts        # IPC event names
│
├── resources/                     # App icons, assets
├── database/
│   └── schema.sql                 # SQLite schema
└── docs/
    ├── ARCHITECTURE.md
    ├── PERMISSIONS.md
    └── API.md
```

---

## Database Schema (SQLite)

```sql
-- Capsules (saved workspaces)
CREATE TABLE capsules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    layout_config TEXT, -- JSON: panel positions, sizes
    pinned_tabs TEXT,   -- JSON: array of URLs
    ai_role TEXT,       -- AI personality/role for this capsule
    tool_permissions TEXT, -- JSON: allowed tools
    hotkeys TEXT,       -- JSON: custom shortcuts
    created_at INTEGER,
    last_used INTEGER
);

-- Browser history
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    visit_count INTEGER DEFAULT 1,
    last_visit INTEGER,
    favicon TEXT
);

-- Bookmarks
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    folder TEXT,
    tags TEXT, -- JSON array
    created_at INTEGER
);

-- AI task history
CREATE TABLE ai_tasks (
    id TEXT PRIMARY KEY,
    type TEXT, -- 'summarize', 'extract', 'automate', etc.
    input TEXT,
    output TEXT,
    page_url TEXT,
    created_at INTEGER,
    capsule_id TEXT,
    FOREIGN KEY (capsule_id) REFERENCES capsules(id)
);

-- Command history (terminal)
CREATE TABLE command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    output TEXT,
    exit_code INTEGER,
    working_dir TEXT,
    executed_at INTEGER,
    capsule_id TEXT,
    FOREIGN KEY (capsule_id) REFERENCES capsules(id)
);

-- Permission grants
CREATE TABLE permission_grants (
    id TEXT PRIMARY KEY,
    tool_name TEXT NOT NULL, -- 'terminal', 'clipboard', 'download', etc.
    scope TEXT,              -- specific command, URL pattern, etc.
    granted BOOLEAN,
    granted_at INTEGER,
    expires_at INTEGER
);
```

---

## Phase 1: MVP (Weeks 1-4)

### Week 1: Project Setup + Browser Shell
**Goal: Get a working Electron app with basic browsing**

```bash
# Initialize project
npm create electron-vite@latest lain -- --template react-ts
cd lain
npm install

# Add dependencies
npm install better-sqlite3 electron-store xterm xterm-addon-fit zustand
npm install -D @types/better-sqlite3 tailwindcss postcss autoprefixer
```

**Deliverables:**
- Electron window launches
- Tab bar with add/close tabs
- Address bar with URL navigation
- WebView displays websites
- Basic keyboard shortcuts (Cmd+T, Cmd+W)

### Week 2: Terminal Integration + Native Terminal Bridge
**Goal: Real terminal in bottom panel + Open user's native terminal apps**

```typescript
// src/main/services/terminal.service.ts
import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { app, shell } from 'electron';

export class TerminalService {
  private terminals = new Map<string, pty.IPty>();

  createTerminal(id: string, cwd?: string) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: cwd || process.env.HOME,
      env: process.env
    });

    this.terminals.set(id, terminal);
    return terminal;
  }

  writeToTerminal(id: string, data: string) {
    this.terminals.get(id)?.write(data);
  }

  resizeTerminal(id: string, cols: number, rows: number) {
    this.terminals.get(id)?.resize(cols, rows);
  }

  /**
   * Open user's native terminal application
   * Supports: iTerm2, Warp, Hyper, Windows Terminal, GNOME Terminal, etc.
   */
  async openNativeTerminal(options: {
    cwd?: string;
    command?: string;
    preferredApp?: string;
  }): Promise<void> {
    const { cwd = process.cwd(), command, preferredApp } = options;
    const platform = process.platform;

    if (platform === 'darwin') {
      await this.openMacTerminal(cwd, command, preferredApp);
    } else if (platform === 'win32') {
      await this.openWindowsTerminal(cwd, command, preferredApp);
    } else if (platform === 'linux') {
      await this.openLinuxTerminal(cwd, command, preferredApp);
    }
  }

  /**
   * Mac: Open iTerm2, Warp, Terminal.app, or Hyper
   */
  private async openMacTerminal(
    cwd: string,
    command?: string,
    preferredApp?: string
  ): Promise<void> {
    // Detect available terminal apps
    const terminalApps = [
      { name: 'iTerm', bundle: 'com.googlecode.iterm2' },
      { name: 'Warp', bundle: 'dev.warp.Warp-Stable' },
      { name: 'Hyper', bundle: 'co.zeit.hyper' },
      { name: 'Terminal', bundle: 'com.apple.Terminal' }
    ];

    let selectedApp = terminalApps.find((app) => app.name === preferredApp);
    
    if (!selectedApp) {
      // Use first available terminal
      for (const app of terminalApps) {
        const exists = await this.checkMacAppExists(app.bundle);
        if (exists) {
          selectedApp = app;
          break;
        }
      }
    }

    if (!selectedApp) {
      throw new Error('No terminal application found');
    }

    // Build AppleScript to open terminal with command
    const script = this.buildMacTerminalScript(
      selectedApp.name,
      cwd,
      command
    );

    return new Promise((resolve, reject) => {
      const osascript = spawn('osascript', ['-e', script]);
      osascript.on('close', (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }

  private buildMacTerminalScript(
    appName: string,
    cwd: string,
    command?: string
  ): string {
    const cdCommand = `cd "${cwd}"`;
    const fullCommand = command ? `${cdCommand} && ${command}` : cdCommand;

    if (appName === 'iTerm') {
      return `
        tell application "iTerm"
          create window with default profile
          tell current session of current window
            write text "${fullCommand}"
          end tell
        end tell
      `;
    }

    if (appName === 'Warp') {
      // Warp uses different AppleScript API
      return `
        tell application "Warp"
          activate
          tell application "System Events"
            keystroke "t" using command down
            delay 0.5
            keystroke "${fullCommand}"
            keystroke return
          end tell
        end tell
      `;
    }

    // Default Terminal.app
    return `
      tell application "Terminal"
        do script "${fullCommand}"
        activate
      end tell
    `;
  }

  /**
   * Windows: Open Windows Terminal, ConEmu, or cmd
   */
  private async openWindowsTerminal(
    cwd: string,
    command?: string,
    preferredApp?: string
  ): Promise<void> {
    // Try Windows Terminal first (most modern)
    try {
      const wtCommand = command
        ? `wt.exe -d "${cwd}" cmd /k "${command}"`
        : `wt.exe -d "${cwd}"`;
      
      spawn('cmd', ['/c', wtCommand], { detached: true });
      return;
    } catch (e) {
      // Fallback to regular cmd
      const cmdCommand = command
        ? `start cmd /K "cd /d ${cwd} && ${command}"`
        : `start cmd /K "cd /d ${cwd}"`;
      
      spawn('cmd', ['/c', cmdCommand], {
        detached: true,
        shell: true
      });
    }
  }

  /**
   * Linux: Open GNOME Terminal, Konsole, xterm, etc.
   */
  private async openLinuxTerminal(
    cwd: string,
    command?: string,
    preferredApp?: string
  ): Promise<void> {
    const terminals = [
      'gnome-terminal',
      'konsole',
      'xfce4-terminal',
      'xterm',
      'terminator',
      'alacritty'
    ];

    let terminalCmd = preferredApp || terminals[0];

    // Find first available terminal
    if (!preferredApp) {
      for (const term of terminals) {
        try {
          spawn('which', [term]).on('close', (code) => {
            if (code === 0) {
              terminalCmd = term;
              return;
            }
          });
        } catch (e) {
          continue;
        }
      }
    }

    const fullCommand = command ? `bash -c "cd ${cwd} && ${command}"` : '';
    
    spawn(terminalCmd, ['--working-directory', cwd, '-e', fullCommand], {
      detached: true
    });
  }

  private async checkMacAppExists(bundleId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const check = spawn('mdfind', [
        `kMDItemCFBundleIdentifier == "${bundleId}"`
      ]);
      
      let output = '';
      check.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      check.on('close', () => {
        resolve(output.trim().length > 0);
      });
    });
  }

  /**
   * Sync current terminal session to native app
   * This sends the current working directory + last command
   */
  async syncToNativeTerminal(terminalId: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    // Get current working directory from terminal
    // This is a simplified approach - you'd need to parse the prompt
    const cwd = process.cwd(); // Placeholder

    await this.openNativeTerminal({ cwd });
  }

  /**
   * Get list of available terminal applications
   */
  async getAvailableTerminals(): Promise<string[]> {
    const platform = process.platform;
    const available: string[] = [];

    if (platform === 'darwin') {
      const macTerminals = [
        { name: 'iTerm2', bundle: 'com.googlecode.iterm2' },
        { name: 'Warp', bundle: 'dev.warp.Warp-Stable' },
        { name: 'Hyper', bundle: 'co.zeit.hyper' },
        { name: 'Terminal', bundle: 'com.apple.Terminal' }
      ];

      for (const term of macTerminals) {
        const exists = await this.checkMacAppExists(term.bundle);
        if (exists) available.push(term.name);
      }
    } else if (platform === 'win32') {
      available.push('Windows Terminal', 'Command Prompt');
    } else {
      available.push(
        'GNOME Terminal',
        'Konsole',
        'xterm',
        'Alacritty',
        'Terminator'
      );
    }

    return available;
  }
}

// IPC Handler for terminal commands
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';

export function registerTerminalHandlers(terminalService: TerminalService) {
  // Open native terminal with current context
  ipcMain.handle('terminal:open-native', async (event, options) => {
    return terminalService.openNativeTerminal(options);
  });

  // Sync current terminal to native app
  ipcMain.handle('terminal:sync-to-native', async (event, terminalId) => {
    return terminalService.syncToNativeTerminal(terminalId);
  });

  // Get available terminal apps
  ipcMain.handle('terminal:get-available', async () => {
    return terminalService.getAvailableTerminals();
  });

  // Send command to external terminal
  ipcMain.handle('terminal:send-command', async (event, command, cwd) => {
    return terminalService.openNativeTerminal({ cwd, command });
  });
}
```

**React Component - Terminal with Native App Integration:**

```typescript
// src/renderer/components/Terminal/TerminalPanel.tsx
import React, { useState, useEffect } from 'react';
import { Terminal as XTerm } from 'xterm';
import 'xterm/css/xterm.css';

export function TerminalPanel() {
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [currentCwd, setCurrentCwd] = useState<string>('');

  useEffect(() => {
    // Get available native terminal apps
    window.electron.ipcRenderer
      .invoke('terminal:get-available')
      .then(setAvailableTerminals);
  }, []);

  const openInNativeTerminal = async () => {
    await window.electron.ipcRenderer.invoke('terminal:open-native', {
      cwd: currentCwd,
      preferredApp: selectedTerminal
    });
  };

  const syncToNativeTerminal = async () => {
    await window.electron.ipcRenderer.invoke(
      'terminal:sync-to-native',
      'terminal-1'
    );
  };

  return (
    <div className="terminal-panel">
      {/* Terminal toolbar */}
      <div className="terminal-toolbar">
        <select
          value={selectedTerminal}
          onChange={(e) => setSelectedTerminal(e.target.value)}
          className="terminal-selector"
        >
          <option value="">Use LAIN Terminal</option>
          {availableTerminals.map((term) => (
            <option key={term} value={term}>
              Open in {term}
            </option>
          ))}
        </select>

        <button onClick={openInNativeTerminal} title="Open in native app">
          <ExternalLinkIcon /> Open External
        </button>

        <button onClick={syncToNativeTerminal} title="Sync to native terminal">
          <SyncIcon /> Sync
        </button>
      </div>

      {/* Embedded xterm.js terminal */}
      <div id="terminal-container" />

      {/* Context menu actions */}
      <ContextMenu>
        <MenuItem onClick={openInNativeTerminal}>
          Open in {selectedTerminal || 'Native Terminal'}
        </MenuItem>
        <MenuItem onClick={() => copyCurrentDirectory()}>
          Copy Current Directory
        </MenuItem>
        <MenuItem onClick={() => sendToAI()}>Send Output to AI</MenuItem>
      </ContextMenu>
    </div>
  );
}
```

**Deliverables:**
- Terminal panel toggles (Cmd+`)
- Real shell integration (bash/zsh/powershell)
- Terminal resizing
- Multiple terminal instances per capsule
- **"Open in Native Terminal" button (iTerm2, Warp, Windows Terminal, etc.)**
- **"Sync to Native Terminal" - sends current working directory and context**
- **Terminal app selector dropdown**
- **Right-click context menu: "Continue in [iTerm2/Warp/etc]"**
- **Smart detection of installed terminal apps**

### Week 3: AI Assistant Panel + Ollama Management
**Goal: Chat with local AI about current page + Auto-install Ollama**

```typescript
// src/main/services/ollama-manager.service.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export class OllamaManagerService {
  private ollamaProcess: ChildProcess | null = null;
  private ollamaPath: string;
  private isInstalled = false;
  private baseUrl = 'http://localhost:11434';

  constructor() {
    // Store Ollama in app data directory
    this.ollamaPath = path.join(app.getPath('userData'), 'ollama');
  }

  /**
   * Check if Ollama is installed
   */
  async checkInstallation(): Promise<boolean> {
    try {
      // First check if user has Ollama installed globally
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        this.isInstalled = true;
        return true;
      }
    } catch (error) {
      // Not running, check if we have local binary
    }

    // Check for bundled Ollama binary
    const binaryPath = this.getOllamaBinaryPath();
    this.isInstalled = fs.existsSync(binaryPath);
    return this.isInstalled;
  }

  /**
   * Download and install Ollama automatically
   */
  async downloadAndInstall(
    onProgress: (progress: number, status: string) => void
  ): Promise<void> {
    const platform = process.platform;
    let downloadUrl = '';

    // Official Ollama download URLs
    if (platform === 'darwin') {
      downloadUrl = 'https://ollama.com/download/Ollama-darwin.zip';
    } else if (platform === 'win32') {
      downloadUrl = 'https://ollama.com/download/OllamaSetup.exe';
    } else if (platform === 'linux') {
      // For Linux, we'll use the install script approach
      await this.installOllamaLinux(onProgress);
      return;
    }

    onProgress(0, 'Downloading Ollama...');

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Download failed');

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    let downloadedSize = 0;

    const fileStream = fs.createWriteStream(
      path.join(this.ollamaPath, 'ollama-installer')
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Cannot read download stream');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedSize += value.length;
      fileStream.write(value);

      const progress = (downloadedSize / totalSize) * 100;
      onProgress(progress, `Downloading... ${Math.round(progress)}%`);
    }

    fileStream.close();
    onProgress(100, 'Installing Ollama...');

    // Extract/install based on platform
    if (platform === 'darwin') {
      await this.extractAndInstallMac();
    } else if (platform === 'win32') {
      await this.runWindowsInstaller();
    }

    this.isInstalled = true;
    onProgress(100, 'Ollama installed successfully!');
  }

  /**
   * Install Ollama on Linux using official script
   */
  private async installOllamaLinux(
    onProgress: (progress: number, status: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress(50, 'Installing Ollama for Linux...');

      const installProcess = spawn('bash', [
        '-c',
        'curl -fsSL https://ollama.com/install.sh | sh'
      ]);

      installProcess.on('close', (code) => {
        if (code === 0) {
          onProgress(100, 'Ollama installed!');
          resolve();
        } else {
          reject(new Error('Installation failed'));
        }
      });
    });
  }

  /**
   * Start Ollama server
   */
  async startServer(): Promise<void> {
    if (this.ollamaProcess) {
      return; // Already running
    }

    const binaryPath = this.getOllamaBinaryPath();

    this.ollamaProcess = spawn(binaryPath, ['serve'], {
      detached: false,
      stdio: 'pipe'
    });

    // Wait for server to be ready
    await this.waitForServer();
  }

  /**
   * Stop Ollama server
   */
  async stopServer(): Promise<void> {
    if (this.ollamaProcess) {
      this.ollamaProcess.kill();
      this.ollamaProcess = null;
    }
  }

  /**
   * Download a specific model
   */
  async downloadModel(
    modelName: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: true })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const progress = (data.completed / data.total) * 100;
            onProgress(progress);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * List downloaded models
   */
  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  }

  private getOllamaBinaryPath(): string {
    const platform = process.platform;
    if (platform === 'darwin') {
      return path.join(this.ollamaPath, 'Ollama.app/Contents/MacOS/ollama');
    } else if (platform === 'win32') {
      return path.join(this.ollamaPath, 'ollama.exe');
    } else {
      return '/usr/local/bin/ollama'; // Linux global install
    }
  }

  private async waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/version`);
        if (response.ok) return;
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Ollama server failed to start');
  }

  private async extractAndInstallMac(): Promise<void> {
    // Use unzip to extract .zip file on Mac
    return new Promise((resolve, reject) => {
      const process = spawn('unzip', [
        '-o',
        path.join(this.ollamaPath, 'ollama-installer'),
        '-d',
        this.ollamaPath
      ]);
      process.on('close', (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }

  private async runWindowsInstaller(): Promise<void> {
    // Run Windows installer silently
    return new Promise((resolve, reject) => {
      const process = spawn(
        path.join(this.ollamaPath, 'ollama-installer'),
        ['/S', `/D=${this.ollamaPath}`]
      );
      process.on('close', (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }
}

// src/main/services/ai.service.ts
export class AIService {
  private ollamaBaseUrl = 'http://localhost:11434';

  async chat(messages: Message[], model = 'llama3.2', stream = false) {
    const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages,
        stream
      })
    });

    if (stream) {
      return response.body; // Return readable stream
    }

    return response.json();
  }

  async getPageContext(url: string, html: string) {
    // Strip HTML to readable text
    const text = this.htmlToText(html);
    return {
      url,
      content: text.slice(0, 4000) // Token limit
    };
  }

  private htmlToText(html: string): string {
    // Remove scripts, styles
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }
}
```

**Deliverables:**
- Right sidebar AI chat panel
- "Send page to AI" button
- Basic tools: copy page, open URL, create note
- **Ollama auto-installer with progress UI**
- **Model downloader (llama3.2, codellama, etc.)**
- Ollama status indicator (running/stopped)
- One-click "Install AI Models" onboarding

### Week 4: Basic Storage + Polish
**Goal: Persist tabs, history, settings**

**Deliverables:**
- SQLite database initialized
- Tab restore on app launch
- Browser history saved
- Settings panel (theme, default search)
- Clean UI matching your design (black/graphite)

---

## Phase 2: Agent Tools + Automation (Weeks 5-8)

### Week 5-6: Tool System Architecture

```typescript
// Shared type definitions
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiresPermission: boolean;
  execute: (params: any) => Promise<any>;
}

// Example tools
const CORE_TOOLS: Tool[] = [
  {
    name: 'extract_tables',
    description: 'Extract all tables from current page as CSV',
    requiresPermission: false,
    execute: async () => {
      // Use Playwright to parse tables
    }
  },
  {
    name: 'run_terminal_command',
    description: 'Execute a shell command',
    requiresPermission: true,
    execute: async ({ command }) => {
      // Ask permission, then run via terminal service
    }
  },
  {
    name: 'fill_form',
    description: 'Auto-fill form fields on page',
    requiresPermission: true,
    execute: async ({ selectors, values }) => {
      // Browser automation
    }
  }
];
```

**Deliverables:**
- Tool calling system with permission checks
- Browser automation via Playwright
- Form filling, data extraction
- Permission dialog UI

### Week 7: Terminal Search + AI Integration

Based on your concept image:

```typescript
// Terminal search feature
// User can type "/" in terminal to search commands or talk to AI

interface TerminalMode {
  type: 'command' | 'search' | 'ai-chat';
  prompt: string;
}

// When user types "/"
if (input.startsWith('/')) {
  if (input === '/search') {
    // Show command history search
    showCommandSearch();
  } else if (input.startsWith('/ai') || input.startsWith('/ask')) {
    // Switch to AI chat mode in terminal
    switchToAIChatMode();
  } else {
    // Quick commands like your UI shows
    // "/summarize this page"
    // "/extract all tables"
    executeQuickCommand(input);
  }
}
```

**Deliverables:**
- Terminal command search (fuzzy find)
- AI chat mode in terminal
- Quick commands (/, /summarize, /extract, etc.)
- Command suggestions as you type

### Week 8: Focus Mode

```typescript
// Focus Mode implementation
interface FocusSession {
  duration: number; // minutes
  allowedDomains: string[];
  blockedDomains: string[];
  goal?: string;
  breakGlassCooldown: number; // seconds
}

// Hard blocking mechanism
function shouldBlockNavigation(url: string, session: FocusSession): boolean {
  const domain = new URL(url).hostname;
  
  if (session.blockedDomains.some(d => domain.includes(d))) {
    return true;
  }
  
  if (session.allowedDomains.length > 0) {
    return !session.allowedDomains.some(d => domain.includes(d));
  }
  
  return false;
}
```

**Deliverables:**
- Focus mode toggle with timer
- Domain allow/block lists
- "Break glass" override with 30s cooldown
- Session goals and completion tracking

---

## Phase 3: Capsules + Advanced Features (Weeks 9-12)

### Week 9-10: Capsule System

```typescript
interface Capsule {
  id: string;
  name: string;
  layout: {
    browserWidth: number; // percentage
    terminalHeight: number;
    sidebarVisible: boolean;
  };
  pinnedTabs: string[];
  aiRole: string;
  toolPermissions: {
    [toolName: string]: 'always' | 'ask' | 'never';
  };
  hotkeys: Record<string, string>;
}

// Quick capsule switching (Cmd+1, Cmd+2, etc.)
```

**Deliverables:**
- Capsule creation UI
- Layout saving/restoring
- Quick switch between capsules
- Per-capsule AI roles

### Week 11: Page Monitoring & Web Tasks

```typescript
// Local page monitoring (no external services)
interface PageMonitor {
  url: string;
  selector: string; // CSS selector to watch
  interval: number; // check frequency in minutes
  lastContent: string;
  onChangeAction: 'notify' | 'extract' | 'run-task';
}

// Example: Monitor pricing page
monitorPage({
  url: 'https://competitor.com/pricing',
  selector: '.price-value',
  interval: 60,
  onChangeAction: 'notify'
});
```

**Deliverables:**
- Page change monitoring
- Local diffing (no external API)
- Automated extraction tasks
- Scheduled tasks

### Week 12: Polish & Testing

**Deliverables:**
- Keyboard shortcuts documentation
- Onboarding flow
- Settings migration
- Performance optimization
- Security audit

---

## UI/UX Guidelines (Matching Your Design)

### Color Palette
```css
:root {
  --bg-primary: #0a0a0a;      /* Deep black */
  --bg-secondary: #1a1a1a;    /* Graphite */
  --bg-panel: #151515;
  --border: #2a2a2a;
  
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  
  --accent: #8b5cf6;          /* Purple - configurable */
  --accent-hover: #7c3aed;
  
  --terminal-bg: #0f0f0f;
  --terminal-fg: #d4d4d4;
}
```

### Layout Specifications
```
Top Bar: 48px height
- Logo (left)
- Tab bar (center, scrollable)
- Focus mode toggle (right)

Browser Area: Dynamic height
- Full width when sidebar closed
- 70% width when sidebar open

Sidebar (Right): 400px width
- AI chat interface
- Collapsible

Terminal (Bottom): 200-400px height
- Resizable
- Tabs: TERMINAL | NOTES
- Search overlay on "/"

Bottom Bar: 32px
- Status indicators
- Capsule selector
- Tools menu
```

### Typography
```css
font-family: 'Inter', -apple-system, system-ui, sans-serif;

/* Headings */
.heading-lg { font-size: 24px; font-weight: 600; }
.heading-md { font-size: 18px; font-weight: 600; }
.heading-sm { font-size: 14px; font-weight: 600; }

/* Body */
.body { font-size: 14px; font-weight: 400; }
.body-sm { font-size: 12px; font-weight: 400; }

/* Terminal */
.terminal { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
```

---

## Permission Model (Critical for Safety)

### Permission Types
1. **Terminal Commands**
   - Commands in allowlist run without prompt
   - Dangerous patterns (rm -rf, curl | sh) always prompt
   - Per-session "trust this command" option

2. **Browser Automation**
   - Form filling requires permission
   - Data extraction allowed
   - Navigation/clicking requires permission

3. **File Operations**
   - Downloads to default folder allowed
   - Uploads require permission
   - Arbitrary file reads require permission

4. **Clipboard Access**
   - Reading clipboard requires permission
   - Writing to clipboard allowed

### Permission Dialog
```typescript
interface PermissionRequest {
  tool: string;
  action: string;
  scope: string;
  reason: string; // AI explains why it needs this
}

// User sees:
// "LAIN wants to run terminal command"
// Command: npm install express
// Reason: To install the web server you requested
// [Allow Once] [Allow Always for this Capsule] [Deny]
```

---

## Terminal Search Implementation (Your Feature)

Based on your concept, here's the exact implementation:

```typescript
// Terminal modes
enum TerminalMode {
  SHELL = 'shell',           // Normal terminal
  SEARCH = 'search',         // Command history search
  AI_CHAT = 'ai-chat',      // Talk to AI
  QUICK_COMMAND = 'quick'    // /summarize, /extract, etc.
}

// Terminal state
interface TerminalState {
  mode: TerminalMode;
  searchQuery: string;
  searchResults: CommandHistoryEntry[];
  aiMessages: Message[];
}

// When user types "/"
function handleTerminalInput(input: string) {
  if (input === '/') {
    // Show command search overlay
    return {
      mode: TerminalMode.SEARCH,
      placeholder: 'Search command history...'
    };
  }
  
  if (input.startsWith('/summarize')) {
    // Quick command: summarize current page
    executeQuickCommand('summarize', currentPageUrl);
  }
  
  if (input.startsWith('/extract')) {
    // Quick command: extract tables/data
    executeQuickCommand('extract', currentPageUrl);
  }
  
  if (input.startsWith('/ai ') || input.startsWith('/ask ')) {
    // Switch to AI chat mode
    const query = input.replace(/^\/(ai|ask)\s+/, '');
    return {
      mode: TerminalMode.AI_CHAT,
      initialMessage: query
    };
  }
}

// Search UI overlay
function CommandSearchOverlay() {
  const [query, setQuery] = useState('');
  const results = useFuzzySearch(query, commandHistory);
  
  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur">
      <input 
        autoFocus
        placeholder="Search commands..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="results">
        {results.map(cmd => (
          <div key={cmd.id} onClick={() => runCommand(cmd.command)}>
            <code>{cmd.command}</code>
            <span>{cmd.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Quick Commands System

```typescript
// Quick commands available from terminal or AI panel
const QUICK_COMMANDS = {
  '/summarize': {
    name: 'Summarize Page',
    execute: async (pageUrl: string) => {
      const content = await getPageContent(pageUrl);
      const summary = await ai.summarize(content);
      return summary;
    }
  },
  
  '/extract tables': {
    name: 'Extract All Tables',
    execute: async (pageUrl: string) => {
      const tables = await browserAutomation.extractTables(pageUrl);
      const csv = convertToCSV(tables);
      await saveFile('tables.csv', csv);
      return `Extracted ${tables.length} tables to tables.csv`;
    }
  },
  
  '/fill form': {
    name: 'Fill Out Form',
    execute: async (pageUrl: string, formData: any) => {
      await browserAutomation.fillForm(pageUrl, formData);
      return 'Form filled successfully';
    }
  },
  
  '/monitor changes': {
    name: 'Monitor Page Changes',
    execute: async (pageUrl: string, selector: string) => {
      await createPageMonitor(pageUrl, selector);
      return `Now monitoring ${pageUrl}`;
    }
  }
};
```

---

## Minimal Package.json

```json
{
  "name": "lain",
  "version": "0.1.0",
  "main": "dist-electron/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  },
  "dependencies": {
    "better-sqlite3": "^9.2.2",
    "electron-store": "^8.1.0",
    "node-pty": "^1.0.0",
    "playwright-core": "^1.40.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "zustand": "^4.4.7",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "electron": "^28.1.0",
    "electron-vite": "^2.0.0",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.10"
  }
}
```

---

## Security Checklist

- [ ] Content Security Policy enabled
- [ ] Node integration disabled in renderer
- [ ] Context isolation enabled
- [ ] Sanitize all terminal input
- [ ] Validate all file paths
- [ ] Rate limit AI requests
- [ ] Sandboxed terminal execution
- [ ] Command allowlist/denylist
- [ ] Permission timeout (auto-deny)
- [ ] Secure IPC channels

---

## Terminal ↔ Browser Deep Integration

### The Two-Way Connection System

LAIN's killer feature is the seamless connection between your browser and terminal. Here's how it works:

### 1. Browser → Terminal Flow

```typescript
// Send webpage code directly to terminal
interface BrowserToTerminalAction {
  type: 'run-code' | 'copy-command' | 'open-in-terminal';
  content: string;
  language?: string;
  cwd?: string;
}

// Example: User finds a code snippet on a webpage
// Right-click → "Run in Terminal"
async function sendCodeToTerminal(code: string, language: string) {
  // Show confirmation dialog with preview
  const confirmed = await showConfirmationDialog({
    title: 'Run code in terminal?',
    code,
    language,
    warning: 'Review this code before running'
  });

  if (confirmed) {
    // Send to active terminal
    await window.electron.ipcRenderer.invoke('terminal:execute', {
      command: code,
      requireConfirmation: true
    });
  }
}

// Browser context menu additions
const browserContextMenu = [
  {
    label: 'Send to Terminal',
    submenu: [
      { label: 'Run Command', action: 'run' },
      { label: 'Copy to Terminal', action: 'copy' },
      { label: 'Open in iTerm2', action: 'open-native' }
    ]
  },
  {
    label: 'Extract curl Command',
    action: () => {
      // Parse network request from DevTools
      const curlCommand = extractCurlFromRequest(selectedRequest);
      sendToTerminal(curlCommand);
    }
  }
];
```

### 2. Terminal → Browser Flow

```typescript
// Send terminal output to browser for visualization or AI analysis
interface TerminalToBrowserAction {
  type: 'visualize' | 'explain' | 'search' | 'open-url';
  content: string;
}

// Example: User runs a command, wants AI to explain the output
async function explainTerminalOutput(output: string) {
  // Send to AI assistant
  await window.electron.ipcRenderer.invoke('ai:analyze', {
    context: 'terminal-output',
    content: output,
    task: 'explain'
  });

  // AI response appears in sidebar
}

// Terminal keyboard shortcuts
const terminalShortcuts = {
  'Cmd+E': 'Send output to AI for explanation',
  'Cmd+Shift+B': 'Open last URL mentioned in terminal',
  'Cmd+Shift+S': 'Search current output in browser',
  'Cmd+O': 'Open file path under cursor in browser'
};
```

### 3. Unified Command Palette

```typescript
// Cmd+K opens command palette that works across browser and terminal
interface CommandPaletteAction {
  id: string;
  title: string;
  description: string;
  category: 'browser' | 'terminal' | 'ai' | 'system';
  execute: () => Promise<void>;
}

const unifiedCommands: CommandPaletteAction[] = [
  // Browser commands
  {
    id: 'browser.send-to-terminal',
    title: 'Send Selected Text to Terminal',
    category: 'browser',
    execute: async () => {
      const selection = await getCurrentPageSelection();
      await sendToTerminal(selection);
    }
  },
  
  // Terminal commands
  {
    id: 'terminal.explain-output',
    title: 'Explain Last Terminal Output',
    category: 'terminal',
    execute: async () => {
      const output = getLastTerminalOutput();
      await explainWithAI(output);
    }
  },
  
  // AI commands
  {
    id: 'ai.build-curl',
    title: 'Build curl from Current Page',
    category: 'ai',
    execute: async () => {
      const pageData = await getCurrentPageAPIData();
      const curl = await generateCurl(pageData);
      await sendToTerminal(curl);
    }
  }
];
```

### 4. Smart URL Detection in Terminal

```typescript
// Automatically detect URLs and file paths in terminal output
class TerminalOutputParser {
  private urlRegex = /https?:\/\/[^\s]+/g;
  private filePathRegex = /(?:\/[^\s]+|[A-Z]:\\[^\s]+)/g;

  parseOutput(output: string): ParsedOutput {
    return {
      urls: output.match(this.urlRegex) || [],
      filePaths: output.match(this.filePathRegex) || [],
      commands: this.extractCommands(output)
    };
  }

  // Make URLs clickable in terminal
  renderClickableOutput(output: string): JSX.Element {
    const parsed = this.parseOutput(output);
    
    return (
      <div className="terminal-output">
        {parsed.urls.map(url => (
          <a
            key={url}
            onClick={() => openInBrowser(url)}
            className="terminal-link"
          >
            {url}
          </a>
        ))}
      </div>
    );
  }
}
```

### 5. Context Bridge - The Core Connection

```typescript
// src/main/context-bridge.ts
// This is the heart of browser ↔ terminal integration

export class ContextBridge {
  private browserState: BrowserState;
  private terminalState: TerminalState;

  // Share browser context with terminal
  async shareContextToTerminal(terminalId: string) {
    const context = {
      currentUrl: this.browserState.activeTab.url,
      pageTitle: this.browserState.activeTab.title,
      selectedText: await this.getPageSelection(),
      visibleCode: await this.extractCodeBlocks(),
      apiRequests: await this.getNetworkRequests()
    };

    // Make this available in terminal as environment variables
    await this.terminalService.setEnvironment(terminalId, {
      LAIN_CURRENT_URL: context.currentUrl,
      LAIN_PAGE_TITLE: context.pageTitle,
      LAIN_SELECTED_TEXT: context.selectedText
    });
  }

  // Share terminal context with browser
  async shareContextToBrowser() {
    const context = {
      currentDirectory: await this.getTerminalCwd(),
      lastCommand: this.terminalState.lastCommand,
      lastOutput: this.terminalState.lastOutput,
      runningProcesses: await this.getRunningProcesses()
    };

    // Make this available to browser-side JavaScript
    return context;
  }

  // Bi-directional commands
  async executeUnifiedCommand(command: UnifiedCommand) {
    switch (command.type) {
      case 'open-url-in-terminal':
        // Browser → Terminal: Open URL's domain/API in terminal
        const curl = await this.buildCurlFromUrl(command.url);
        await this.terminalService.execute(curl);
        break;

      case 'open-path-in-browser':
        // Terminal → Browser: Open file/URL in browser
        if (this.isUrl(command.path)) {
          await this.browserService.navigate(command.path);
        } else {
          await this.browserService.openFile(command.path);
        }
        break;

      case 'visualize-data':
        // Terminal → Browser: Visualize JSON/CSV data
        const data = await this.parseTerminalOutput(command.output);
        await this.browserService.openVisualization(data);
        break;
    }
  }
}
```

### 6. Example Workflows

**Workflow 1: API Testing**
```
1. User finds API documentation in browser
2. Right-click on endpoint → "Build curl command"
3. LAIN generates curl with headers, auth
4. User clicks "Run in terminal"
5. Terminal executes, shows response
6. User clicks "Visualize JSON"
7. Browser opens response in formatted view
```

**Workflow 2: Code Execution**
```
1. User finds Python script on GitHub in browser
2. Right-click code block → "Run in terminal"
3. LAIN shows preview with security warning
4. User confirms
5. Terminal creates temp file, executes script
6. Output appears with "Explain this output" button
7. AI explains what the script did
```

**Workflow 3: File Navigation**
```
1. Terminal shows file path in output: /Users/harish/project/config.json
2. Path is automatically clickable
3. User clicks path
4. Browser opens file in built-in JSON viewer
5. User edits in browser
6. "Save and reload terminal" button
7. Terminal automatically refreshes
```

### 7. Native Terminal Integration Architecture

```typescript
// Bridge between LAIN's terminal and native apps (iTerm2, Warp, etc.)

class NativeTerminalBridge {
  // Export current session to native terminal
  async exportToNative(terminalId: string, nativeApp: string) {
    const session = await this.captureSession(terminalId);
    
    // Create shell script that recreates the session
    const script = this.buildSessionScript(session);
    
    // Open native terminal with script
    await this.terminalService.openNativeTerminal({
      cwd: session.cwd,
      command: `source ${script}`,
      preferredApp: nativeApp
    });
  }

  // Import session from native terminal (if possible)
  async importFromNative(nativeApp: string) {
    // For apps that expose session data (iTerm2, Warp)
    const sessionData = await this.readNativeSession(nativeApp);
    
    // Create new terminal in LAIN with same state
    await this.terminalService.createTerminal({
      cwd: sessionData.cwd,
      history: sessionData.history,
      env: sessionData.env
    });
  }

  private buildSessionScript(session: TerminalSession): string {
    return `
      cd "${session.cwd}"
      export LAIN_SESSION=1
      ${session.env.map(e => `export ${e.key}="${e.value}"`).join('\n')}
      # History
      ${session.history.join('\n# ')}
    `;
  }
}
```

## Next Steps

1. **Set up the repo** using the structure above
2. **Build Phase 1 MVP** (4 weeks)
3. **Internal testing** with real workflows
4. **Add Phase 2 features** based on usage
5. **Polish for public beta**

Would you like me to:
1. Generate the exact starter code for any component?
2. Create the complete IPC handler setup?
3. Design the permission dialog system?
4. Build the terminal search overlay?

Let's ship this. 🚀
