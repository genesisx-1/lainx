import * as pty from 'node-pty';
import { spawn } from 'child_process';
import { app } from 'electron';
import * as fs from 'fs';

export class TerminalService {
  private terminals = new Map<string, pty.IPty>();
  private lastCommands = new Map<string, string>();

  createTerminal(id: string, cwd?: string) {
    const shell = this.getDefaultShell();
    const resolvedCwd =
      cwd ||
      process.env.HOME ||
      (app.isReady() ? app.getPath('home') : undefined) ||
      process.cwd();

    // node-pty expects env values to be strings.
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') env[key] = value;
    }

    // Ensure basics exist.
    env.TERM = env.TERM || 'xterm-256color';

    // Helpful preflight checks (avoid cryptic posix_spawnp failures).
    if (!fs.existsSync(shell)) {
      throw new Error(`Shell not found: ${shell}`);
    }
    if (!fs.existsSync(resolvedCwd)) {
      throw new Error(`CWD not found: ${resolvedCwd}`);
    }

    const terminal = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: resolvedCwd,
      env
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

  getTerminal(id: string) {
    return this.terminals.get(id);
  }

  destroyTerminal(id: string) {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.kill();
      this.terminals.delete(id);
    }
    this.lastCommands.delete(id);
  }

  setLastCommand(id: string, command: string) {
    const trimmed = (command || '').trim();
    if (!trimmed) return;
    this.lastCommands.set(id, trimmed);
  }

  getLastCommand(id: string): string | null {
    return this.lastCommands.get(id) || null;
  }

  async getTerminalCwd(id: string): Promise<string | null> {
    const terminal = this.terminals.get(id);
    if (!terminal) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pidCwd = require('pid-cwd');
      const cwd = await pidCwd(terminal.pid);
      return typeof cwd === 'string' && cwd.trim() ? cwd.trim() : null;
    } catch {
      return null;
    }
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') return 'powershell.exe';

    // Prefer the user's configured login shell.
    const envShell = process.env.SHELL;
    if (envShell && envShell.startsWith('/')) return envShell;

    // Fall back to common absolute paths on Unix.
    if (process.platform === 'darwin') return '/bin/zsh';
    return '/bin/bash';
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
      { name: 'iTerm2', bundle: 'com.googlecode.iterm2' },
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
    const escapeAppleScriptString = (s: string) =>
      (s || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ');

    const cdCommand = `cd "${escapeAppleScriptString(cwd)}"`;
    const safeCommand = escapeAppleScriptString(command || '');
    const fullCommand = safeCommand ? `${cdCommand} && ${safeCommand}` : cdCommand;

    if (appName === 'iTerm' || appName === 'iTerm2') {
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
  async syncToNativeTerminal(terminalId: string, preferredApp?: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    // Get current working directory from PTY pid (best-effort).
    let cwd = process.env.HOME || (app.isReady() ? app.getPath('home') : process.cwd());
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pidCwd = require('pid-cwd');
      const next = await pidCwd(terminal.pid);
      if (typeof next === 'string' && next.trim()) cwd = next.trim();
    } catch {
      // ignore
    }

    const lastCommand = this.lastCommands.get(terminalId);
    await this.openNativeTerminal({ cwd, command: lastCommand, preferredApp });
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
