import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
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
  const [showHistorySearch, setShowHistorySearch] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyCacheRef = useRef<any[]>([]);
  const historyInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<TerminalSettingsType>({
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    theme: 'dark',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 1000
  });
  const { addTab } = useBrowserStore();
  const { toggleTerminal, pendingTerminalCommand, clearPendingTerminalCommand, setCurrentTerminalId } = useUIStore();
  const inputBufferRef = useRef('');

  const normalize = (s: string) => (s || '').toLowerCase();

  // Simple fuzzy scorer: higher is better; -Infinity means no match.
  const fuzzyScore = (query: string, text: string) => {
    const q = normalize(query).trim();
    const t = normalize(text);
    if (!q) return 0;
    let ti = 0;
    let score = 0;
    let streak = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const qc = q[qi];
      let found = false;
      while (ti < t.length) {
        if (t[ti] === qc) {
          found = true;
          // reward contiguous matches
          streak += 1;
          score += 5 + streak * 2;
          ti += 1;
          break;
        }
        // reset streak if we skip characters
        streak = 0;
        ti += 1;
      }
      if (!found) return -Infinity;
    }
    // prefer shorter commands when equally matching
    score -= Math.min(20, Math.floor(t.length / 10));
    return score;
  };

  const refreshHistoryResults = (q: string) => {
    const list = historyCacheRef.current || [];
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setHistoryResults(list.slice(0, 50));
      setHistoryIndex(0);
      return;
    }

    const ranked = list
      .map((item) => ({
        item,
        score: fuzzyScore(trimmed, item.command || '')
      }))
      .filter((x) => x.score !== -Infinity)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.item.executed_at || 0) - (a.item.executed_at || 0);
      })
      .slice(0, 50)
      .map((x) => x.item);

    setHistoryResults(ranked);
    setHistoryIndex(0);
  };

  const openHistorySearch = async () => {
    try {
      // Pull a chunk of recent history into a local cache for fuzzy search.
      const recent = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_COMMANDS, 250);
      historyCacheRef.current = Array.isArray(recent) ? recent : [];
      setHistoryQuery('');
      setHistoryResults(historyCacheRef.current.slice(0, 50));
      setHistoryIndex(0);
      setShowHistorySearch(true);
      // focus input next tick
      requestAnimationFrame(() => historyInputRef.current?.focus());
    } catch {
      historyCacheRef.current = [];
      setHistoryResults([]);
      setShowHistorySearch(true);
      requestAnimationFrame(() => historyInputRef.current?.focus());
    }
  };

  const closeHistorySearch = () => {
    setShowHistorySearch(false);
    setHistoryQuery('');
    setHistoryResults([]);
    setHistoryIndex(0);
    // return focus to terminal
    requestAnimationFrame(() => xtermRef.current?.focus());
  };

  const injectCommand = (cmd: string) => {
    const command = (cmd || '').trim();
    if (!command) return;
    // Write the command text into the pty (no Enter).
    window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, terminalId, command);
    inputBufferRef.current += command;
    closeHistorySearch();
  };

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

    // Make URLs clickable (open inside LAIN as new tab)
    const linksAddon = new WebLinksAddon((event, uri) => {
      try {
        event?.preventDefault?.();
      } catch {
        // ignore
      }
      if (uri) addTab(uri);
    });
    xterm.loadAddon(linksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Create terminal session in main process
    window.electron.ipcRenderer
      .invoke(IPC_CHANNELS.TERMINAL_CREATE, { id: terminalId })
      .then(() => {
        console.log('Terminal created:', terminalId);
        setCurrentTerminalId(terminalId);
        
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
      // Slash-triggered history search overlay (only when starting a fresh command).
      if (data === '/' && inputBufferRef.current.length === 0) {
        openHistorySearch();
        return;
      }

      // Handle Enter key
      if (data === '\r') {
        const command = inputBufferRef.current.trim();

        // Record command into history store (best-effort).
        if (command) {
          // Track last command for native handoff.
          window.electron.ipcRenderer
            .invoke(IPC_CHANNELS.TERMINAL_SET_LAST_COMMAND, terminalId, command)
            .catch(() => {
              // ignore
            });

          window.electron.ipcRenderer
            .invoke(
              IPC_CHANNELS.STORAGE_ADD_COMMAND,
              command,
              '',
              0,
              ''
            )
            .catch(() => {
              // ignore
            });
        }
        
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
      setCurrentTerminalId(null);
      xterm.dispose();
    };
  }, [terminalId, settings, addTab]);

  // Allow other UI surfaces (e.g. browser context menu) to send commands into the terminal.
  useEffect(() => {
    if (!pendingTerminalCommand) return;
    const xterm = xtermRef.current;
    if (!xterm) return;

    const text = (pendingTerminalCommand.text || '').replace(/\r?\n/g, '\n');
    if (!text.trim()) {
      clearPendingTerminalCommand();
      return;
    }

    // Ensure terminal is focused before injection.
    requestAnimationFrame(() => xterm.focus());

    if (pendingTerminalCommand.run) {
      // Run immediately.
      window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, terminalId, text + '\r');
      inputBufferRef.current = '';
    } else {
      // Paste only (no Enter).
      window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_WRITE, terminalId, text);
      inputBufferRef.current += text;
    }

    clearPendingTerminalCommand();
  }, [pendingTerminalCommand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openInNativeTerminal = () => {
    window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_OPEN_NATIVE, {
      cwd: undefined,
      preferredApp: availableTerminals[0]
    });
  };

  const continueInNativeTerminal = () => {
    if (!availableTerminals[0]) return;
    window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_SYNC_NATIVE, {
      terminalId,
      preferredApp: availableTerminals[0]
    });
  };

  const handleSettingsSave = (newSettings: TerminalSettingsType) => {
    setSettings(newSettings);
    // Recreate terminal with new settings
    // This will trigger the useEffect
  };

  return (
    <div className="h-full flex flex-col bg-terminal-bg relative">
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
            <>
              <button
                onClick={openInNativeTerminal}
                className="px-3 py-1 text-xs bg-bg-panel hover:bg-accent text-text-secondary hover:text-white rounded transition-colors"
                title={`Open in ${availableTerminals[0]}`}
              >
                Open in {availableTerminals[0]}
              </button>
              <button
                onClick={continueInNativeTerminal}
                className="px-3 py-1 text-xs bg-bg-panel hover:bg-accent text-text-secondary hover:text-white rounded transition-colors"
                title={`Continue in ${availableTerminals[0]} (same folder + last command)`}
              >
                Continue in {availableTerminals[0]}
              </button>
            </>
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

      {/* Command history search overlay */}
      {showHistorySearch && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-10 bg-black/40">
          <div className="w-[720px] max-w-[95vw] lain-glass rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
              <div className="text-xs tracking-[0.25em] text-text-muted">HISTORY SEARCH</div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => injectCommand('/summarize ')}
                  className="px-2 h-7 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
                >
                  /summarize
                </button>
                <button
                  type="button"
                  onClick={() => injectCommand('/extract ')}
                  className="px-2 h-7 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
                >
                  /extract
                </button>
                <button
                  type="button"
                  onClick={() => injectCommand('/ai ')}
                  className="px-2 h-7 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
                >
                  /ai
                </button>
                <button
                  type="button"
                  onClick={closeHistorySearch}
                  className="px-2 h-7 rounded-md text-xs bg-bg-panel hover:bg-bg-primary text-text-secondary border border-border/40"
                  title="Close (Esc)"
                >
                  Esc
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-border/40">
              <input
                ref={historyInputRef}
                value={historyQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setHistoryQuery(v);
                  refreshHistoryResults(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeHistorySearch();
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHistoryIndex((i) => Math.min(i + 1, Math.max(0, historyResults.length - 1)));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHistoryIndex((i) => Math.max(0, i - 1));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const selected = historyResults[historyIndex];
                    if (selected?.command) injectCommand(selected.command);
                    return;
                  }
                }}
                placeholder="Type to fuzzy-search your command history…"
                className="w-full h-11 px-4 rounded-xl bg-bg-secondary/40 border border-border/50 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              <div className="mt-2 text-xs text-text-muted">
                Use ↑/↓ and Enter. Type <span className="text-text-primary">/</span> in the terminal to open.
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto">
              {historyResults.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">No matching commands.</div>
              ) : (
                historyResults.map((row, idx) => (
                  <button
                    key={row.id ?? `${row.command}-${idx}`}
                    type="button"
                    onClick={() => injectCommand(row.command)}
                    onMouseEnter={() => setHistoryIndex(idx)}
                    className={`w-full text-left px-4 py-2 font-mono text-xs border-b border-border/20 last:border-0 transition-colors ${
                      idx === historyIndex ? 'bg-bg-secondary/50 text-text-primary' : 'hover:bg-bg-secondary/30 text-text-secondary'
                    }`}
                    title="Insert into terminal"
                  >
                    {row.command}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
