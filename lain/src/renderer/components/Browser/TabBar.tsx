import React, { useCallback } from 'react';
import { useBrowserStore } from '../../store/browser.store';

export function TabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useBrowserStore();

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const handleAddTab = useCallback(() => {
    addTab();
  }, [addTab]);

  const handleAddPrivateTab = useCallback(() => {
    addTab('lain://welcome', { isPrivate: true });
  }, [addTab]);

  return (
    <div className="flex items-center h-11 px-2 lain-glass rounded-xl">
      {/* Tab list */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 h-9 rounded-xl cursor-pointer
              min-w-[120px] max-w-[220px] group transition-colors
              ${tab.isActive 
                ? 'bg-bg-primary/40 text-text-primary lain-glow' 
                : 'bg-bg-panel/30 text-text-secondary hover:bg-bg-secondary/40'
              }
            `}
            onClick={() => setActiveTab(tab.id)}
          >
            {/* Favicon / loading */}
            <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
              {tab.isLoading ? (
                <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              ) : tab.favicon ? (
                <img
                  src={tab.favicon}
                  alt=""
                  className="w-4 h-4 rounded-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-4 h-4 rounded bg-border" />
              )}
            </div>
            
            {/* Title */}
            <span className="flex-1 truncate text-sm">
              {tab.title}
            </span>

            {/* Private indicator */}
            {tab.isPrivate && (
              <span className="text-text-muted" title="Private tab">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 9.5h.01M14.5 9.5h.01" />
                </svg>
              </span>
            )}

            {/* Close button */}
            <button
              type="button"
              className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-bg-secondary/60 rounded"
              onClick={(e) => handleCloseTab(e, tab.id)}
            >
              ×
            </button>
          </div>
        ))}

        {/* New tab button */}
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary border border-transparent hover:border-border/40 transition-colors"
          onClick={handleAddTab}
          title="New tab (Cmd+T)"
        >
          +
        </button>

        {/* New private tab button */}
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary border border-transparent hover:border-border/40 transition-colors"
          onClick={handleAddPrivateTab}
          title="New private tab"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 9.5h.01M14.5 9.5h.01" />
          </svg>
        </button>
      </div>
    </div>
  );
}
