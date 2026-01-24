import React, { useState, useEffect } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';

export function AddressBar() {
  const { tabs, activeTabId, updateTab, webviewApi } = useBrowserStore();
  const { toggleSidebar, toggleTerminal, sidebarOpen, terminalOpen } = useUIStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url || '');

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab]);

  const handleNavigate = (e: React.FormEvent) => {
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
  };

  return (
    <div className="flex items-center h-12 px-4 gap-3 bg-bg-primary">
      {/* Back/Forward buttons */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => webviewApi?.goBack()}
          disabled={!activeTab?.canGoBack}
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title="Go back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => webviewApi?.goForward()}
          disabled={!activeTab?.canGoForward}
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-secondary rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title="Go forward"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => (activeTab?.isLoading ? webviewApi?.stop() : webviewApi?.reload())}
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
          className="w-full h-9 px-4 rounded-lg bg-bg-secondary border border-border text-text-primary text-sm focus:border-accent"
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
