import React, { useState, useEffect, useCallback } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';

export function AddressBar() {
  const { tabs, activeTabId, updateTab, webviewApi } = useBrowserStore();
  const { toggleSidebar, toggleTerminal, sidebarOpen, terminalOpen } = useUIStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url || '');

  useEffect(() => {
    if (activeTab && activeTab.url !== 'lain://welcome') {
      setUrlInput(activeTab.url);
    }
  }, [activeTab?.url]);

  const handleNavigate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    let url = urlInput.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it looks like a URL or a search query
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        // Search query
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }

    if (activeTabId) {
      updateTab(activeTabId, { url });
    }
  }, [urlInput, activeTabId, updateTab]);

  const handleBack = useCallback(() => {
    webviewApi?.goBack();
  }, [webviewApi]);

  const handleForward = useCallback(() => {
    webviewApi?.goForward();
  }, [webviewApi]);

  const handleReloadOrStop = useCallback(() => {
    if (activeTab?.isLoading) {
      webviewApi?.stop();
    } else {
      webviewApi?.reload();
    }
  }, [activeTab?.isLoading, webviewApi]);

  return (
    <div className="flex items-center h-12 px-4 gap-3 bg-bg-primary">
      {/* Back/Forward buttons */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleBack}
          disabled={!activeTab?.canGoBack}
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title="Go back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={!activeTab?.canGoForward}
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title="Go forward"
        >
          →
        </button>
        <button
          type="button"
          onClick={handleReloadOrStop}
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary"
          title={activeTab?.isLoading ? 'Stop' : 'Reload'}
        >
          {activeTab?.isLoading ? '×' : '↻'}
        </button>
      </div>

      {/* Address bar */}
      <form onSubmit={handleNavigate} className="flex-1">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="w-full h-9 px-4 rounded-lg bg-bg-secondary border border-border text-text-primary text-sm focus:border-accent focus:outline-none"
          placeholder="Search or enter URL"
        />
      </form>

      {/* Actions */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={toggleTerminal}
          className="px-3 h-9 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary text-sm border border-transparent hover:border-border"
          title="Toggle terminal (Cmd+`)"
        >
          Terminal
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className={`px-3 h-9 flex items-center justify-center rounded text-sm border transition-colors ${
            sidebarOpen
              ? 'bg-accent text-white border-accent'
              : 'hover:bg-bg-secondary text-text-secondary border-transparent hover:border-border'
          }`}
          title="Toggle AI panel (Cmd+Shift+A)"
        >
          AI
        </button>
      </div>
    </div>
  );
}
