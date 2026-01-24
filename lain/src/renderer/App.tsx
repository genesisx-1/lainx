import React, { useEffect, useCallback } from 'react';
import { TabBar } from './components/Browser/TabBar';
import { AddressBar } from './components/Browser/AddressBar';
import { WebView } from './components/Browser/WebView';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { ChatPanel } from './components/Assistant/ChatPanel';
import { OllamaSetup } from './components/Onboarding/OllamaSetup';
import { useUIStore } from './store/ui.store';
import { useBrowserStore } from './store/browser.store';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import './styles/globals.css';

export function App() {
  const {
    sidebarOpen,
    terminalOpen,
    terminalHeight,
    toggleTerminal,
    toggleSidebar,
    showOnboarding,
    setShowOnboarding
  } = useUIStore();
  
  const { addTab } = useBrowserStore();

  useEffect(() => {
    // Listen for onboarding event
    const unsubscribe = window.electron.ipcRenderer.on(IPC_CHANNELS.SHOW_ONBOARDING, () => {
      setShowOnboarding(true);
    });

    return unsubscribe;
  }, [setShowOnboarding]);

  // First launch behavior: if Ollama isn't installed, show onboarding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const installed = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
        );
        if (!cancelled && !installed) {
          setShowOnboarding(true);
        }
      } catch {
        // If we can't check, don't block the app; user can open setup manually.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setShowOnboarding]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Cmd+` toggles terminal
    if (mod && e.key === '`') {
      e.preventDefault();
      toggleTerminal();
    }

    // Cmd+Shift+A toggles AI panel
    if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      toggleSidebar();
    }

    // Cmd+T opens new tab
    if (mod && e.key.toLowerCase() === 't') {
      e.preventDefault();
      addTab();
    }
  }, [toggleSidebar, toggleTerminal, addTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (showOnboarding) {
    return <OllamaSetup />;
  }

  return (
    <div className="h-screen flex flex-col text-text-primary lain-cosmic">
      {/* Top bar with tabs and address bar */}
      <div className="px-3 pt-3">
        <TabBar />
        <AddressBar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser + Terminal area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Browser viewport */}
          <div className="flex-1 min-h-0">
            <WebView />
          </div>

          {/* Bottom dock (Terminal tab) */}
          <div className="border-t border-border bg-bg-secondary">
            <div className="h-9 flex items-center justify-between px-3">
              <button
                type="button"
                onClick={toggleTerminal}
                className="px-3 h-7 rounded-md text-xs font-medium border border-border bg-bg-panel hover:bg-bg-primary text-text-primary"
                title="Toggle terminal (Cmd+`)"
              >
                {terminalOpen ? 'Hide Terminal' : 'Show Terminal'} {terminalOpen ? '▾' : '▴'}
              </button>
              <div className="text-xs text-text-muted">
                {terminalOpen ? 'Terminal open' : 'Terminal hidden'}
              </div>
            </div>
          </div>

          {/* Terminal panel */}
          {terminalOpen && (
            <div className="border-t border-border" style={{ height: terminalHeight }}>
              <TerminalPanel />
            </div>
          )}
        </div>

        {/* AI sidebar on right */}
        {sidebarOpen && (
          <div className="w-[400px] border-l border-border flex-shrink-0">
            <ChatPanel />
          </div>
        )}
      </div>
    </div>
  );
}
