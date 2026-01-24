import { useEffect, useCallback, useRef } from 'react';
import { TabBar } from './components/Browser/TabBar';
import { AddressBar } from './components/Browser/AddressBar';
import { WebView } from './components/Browser/WebView';
import { BookmarksBar } from './components/Browser/BookmarksBar';
import { HistoryPanel } from './components/Browser/HistoryPanel';
import { SettingsPanel } from './components/Browser/SettingsPanel';
import { DownloadsPanel } from './components/Browser/DownloadsPanel';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { ChatPanel } from './components/Assistant/ChatPanel';
import { OllamaSetup } from './components/Onboarding/OllamaSetup';
import { useUIStore } from './store/ui.store';
import { useBrowserStore } from './store/browser.store';
import { useDownloadsStore } from './store/downloads.store';
import { useHistoryStore } from './store/history.store';
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
    setShowOnboarding,
    showHistory,
    setShowHistory,
    showSettings,
    setShowSettings,
    showFindInPage,
    setShowFindInPage,
    showBookmarksBar
  } = useUIStore();
  
  const { addTab, closeTab, activeTabId } = useBrowserStore();
  const { addDownload, updateDownload } = useDownloadsStore();
  const { addEntry } = useHistoryStore();
  const webviewRef = useRef<Electron.WebviewTag>(null);

  // Listen for download events from main process
  useEffect(() => {
    const unsubStart = window.electron.ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_START, (data: any) => {
      addDownload({
        id: data.id,
        url: data.url,
        filename: data.filename,
        savePath: data.savePath,
        totalBytes: data.totalBytes
      });
    });

    const unsubProgress = window.electron.ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, (data: any) => {
      updateDownload(data.id, {
        receivedBytes: data.receivedBytes,
        totalBytes: data.totalBytes,
        state: data.state === 'progressing' ? 'progressing' : data.state
      });
    });

    const unsubComplete = window.electron.ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_COMPLETE, (data: any) => {
      updateDownload(data.id, {
        state: data.state === 'completed' ? 'completed' : 'interrupted',
        savePath: data.savePath
      });
    });

    return () => {
      unsubStart();
      unsubProgress();
      unsubComplete();
    };
  }, [addDownload, updateDownload]);

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

    // Cmd+W closes current tab
    if (mod && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTabId) {
        closeTab(activeTabId);
      }
    }

    // Cmd+F opens find in page
    if (mod && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowFindInPage(true);
    }

    // Cmd+Y opens history
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      setShowHistory(true);
    }

    // Escape closes modals
    if (e.key === 'Escape') {
      if (showFindInPage) setShowFindInPage(false);
    }
  }, [toggleSidebar, toggleTerminal, addTab, closeTab, activeTabId, setShowFindInPage, setShowHistory, showFindInPage]);

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
        <AddressBar 
          onHistoryClick={() => setShowHistory(true)}
          onSettingsClick={() => setShowSettings(true)}
        />
      </div>

      {/* Bookmarks bar */}
      {showBookmarksBar && <BookmarksBar />}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser + Terminal area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Browser viewport */}
          <div className="flex-1 min-h-0 relative">
            <WebView 
              ref={webviewRef}
              showFindInPage={showFindInPage}
              onCloseFindInPage={() => setShowFindInPage(false)}
              onNavigate={(url, title) => addEntry(url, title)}
            />
          </div>

          {/* Bottom dock (Terminal tab) */}
          <div className="border-t border-border bg-bg-secondary">
            <div className="h-9 flex items-center justify-between px-3">
              <button
                type="button"
                onClick={toggleTerminal}
                className="px-3 h-7 rounded-md text-xs font-medium border border-border bg-bg-panel hover:bg-bg-primary text-text-primary flex items-center gap-2"
                title="Toggle terminal (Cmd+`)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {terminalOpen ? 'Hide Terminal' : 'Show Terminal'}
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

      {/* Modals */}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      
      {/* Downloads panel (floating) */}
      <DownloadsPanel />
    </div>
  );
}
