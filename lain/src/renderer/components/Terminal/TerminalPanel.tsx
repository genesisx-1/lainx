import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { TerminalSettings } from './TerminalSettings';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import 'xterm/css/xterm.css';

interface TerminalSettingsType {
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light' | 'custom';
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  customColors?: {
    background: string;
    foreground: string;
    cursor: string;
  };
}

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TerminalSettingsType>({
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    theme: 'dark',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 1000
  });
  const { addTab } = useBrowserStore();
  const { toggleTerminal } = useUIStore();
  const inputBufferRef = useRef('');

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: settings.cursorBlink,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      cursorStyle: settings.cursorStyle as any,
      scrollback: settings.scrollback,
      theme: settings.customColors || {
        background: '#0f0f0f',
        foreground: '#d4d4d4',
        cursor: '#8b5cf6',
        black: '#000000',
        brightBlack: '#666666',
        red: '#e06c75',
        brightRed: '#e06c75',
        green: '#98c379',
        brightGreen: '#98c379',
        yellow: '#d19a66',
        brightYellow: '#d19a66',
        blue: '#61afef',
        brightBlue: '#61afef',
        magenta: '#c678dd',
        brightMagenta: '#c678dd',
        cyan: '#56b6c2',
        brightCyan: '#56b6c2',
        white: '#d4d4d4',
        brightWhite: '#ffffff'
      }
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Create terminal session in main process
    window.electron.ipcRenderer
      .invoke(IPC_CHANNELS.TERMINAL_CREATE, { id: terminalId })
      .then(() => {
        console.log('Terminal created:', terminalId);
        
        // Show welcome message
        xterm.writeln('\x1b[1;35m╔═══════════════════════════════════════╗');
        xterm.writeln('║      Welcome to LAIN Terminal        ║');
        xterm.writeln('╚═══════════════════════════════════════╝\x1b[0m');
        xterm.writeln('');
        xterm.writeln('Special commands:');
        xterm.writeln('  \x1b[1;36msearch <query>\x1b[0m   - Search web');
        xterm.writeln('  \x1b[1;36mopen <url>\x1b[0m      - Open URL in browser');
        xterm.writeln('  \x1b[1;36m/help\x1b[0m           - Show all commands');
        xterm.writeln('');
      });

    // Listen for terminal output
    const unsubscribe = window.electron.ipcRenderer.on(
      IPC_CHANNELS.TERMINAL_DATA,
      (id: string, data: string) => {
        if (id === terminalId) {
          xterm.write(data);
        }
      }
    );

    // Send input to terminal with special command handling
    xterm.onData((data) => {
      // Handle Enter key
      if (data === '\r') {
        const command = inputBufferRef.current.trim();
        
        // Check for special commands
        if (command.startsWith('search ')) {
          const query = command.substring(7).trim();
          if (query) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            addTab(searchUrl);
            xterm.writeln('');
            xterm.writeln(`\x1b[32m→ Opening search results in browser...\x1b[0m`);
          }
          inputBufferRef.current = '';
          return;
        } else if (command.startsWith('open ')) {
          const url = command.substring(5).trim();
          if (url) {
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            addTab(fullUrl);
            xterm.writeln('');
            xterm.writeln(`\x1b[32m→ Opening ${fullUrl} in browser...\x1b[0m`);
          }
          inputBufferRef.current = '';
          return;
        } else if (command === '/help') {
          xterm.writeln('');
          xterm.writeln('\x1b[1;35mLAIN Terminal Commands:\x1b[0m');
          xterm.writeln('');
          xterm.writeln('  \x1b[1;36msearch <query>\x1b[0m        Search Google');
          xterm.writeln('  \x1b[1;36mopen <url>\x1b[0m           Open URL in browser');
          xterm.writeln('  \x1b[1;36m/help\x1b[0m                Show this help');
          xterm.writeln('  \x1b[1;36m/clear\x1b[0m               Clear terminal');
          xterm.writeln('');
          xterm.writeln('Plus all standard shell commands!');
          xterm.writeln('');
          inputBufferRef.current = '';
          return;
        } else if (command === '/clear') {
          xterm.clear();
          inputBufferRef.current = '';
          return;
        }
        
        inputBufferRef.current = '';
      } else if (data === '\x7f') {
        // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        }
      } else if (data >= ' ' && data <= '~') {
        // Printable characters
        inputBufferRef.current += data;
      }
      
      // Send to shell
      window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, terminalId, data);
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.TERMINAL_RESIZE,
        terminalId,
        xterm.cols,
        xterm.rows
      );
    };

    window.addEventListener('resize', handleResize);

    // Get available native terminals
    window.electron.ipcRenderer
      .invoke(IPC_CHANNELS.TERMINAL_GET_AVAILABLE)
      .then(setAvailableTerminals);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
      window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_DESTROY, terminalId);
      xterm.dispose();
    };
  }, [terminalId, settings, addTab]);

  const openInNativeTerminal = () => {
    window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_OPEN_NATIVE, {
      cwd: process.env.HOME,
      preferredApp: availableTerminals[0]
    });
  };

  const handleSettingsSave = (newSettings: TerminalSettingsType) => {
    setSettings(newSettings);
    // Recreate terminal with new settings
    // This will trigger the useEffect
  };

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Terminal toolbar */}
      <div className="flex items-center justify-between h-10 px-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary font-medium">TERMINAL</span>
          <span className="text-xs text-text-muted">
            Type "search" or "open" for web commands
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTerminal}
            className="px-3 py-1 text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary hover:text-text-primary rounded transition-colors border border-border"
            title="Hide terminal"
          >
            Hide
          </button>
          {availableTerminals.length > 0 && (
            <button
              onClick={openInNativeTerminal}
              className="px-3 py-1 text-xs bg-bg-panel hover:bg-accent text-text-secondary hover:text-white rounded transition-colors"
              title={`Open in ${availableTerminals[0]}`}
            >
              Open in {availableTerminals[0]}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1 text-xs bg-bg-panel hover:bg-accent text-text-secondary hover:text-white rounded transition-colors"
            title="Terminal Settings"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Terminal viewport */}
      <div ref={terminalRef} className="flex-1 overflow-hidden" />

      {/* Settings Modal */}
      {showSettings && (
        <TerminalSettings
          currentSettings={settings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
