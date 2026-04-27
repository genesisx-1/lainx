import React, { useCallback } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';

export function TabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useBrowserStore();
  const { focusMode, focusLockedTabId } = useUIStore();

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const handleAddTab = useCallback(() => {
    if (focusMode) return;
    addTab();
  }, [addTab]);

  const handleAddPrivateTab = useCallback(() => {
    if (focusMode) return;
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

            {/* Audio indicator */}
            {tab.isAudioPlaying && (
              <span className="text-text-muted" title="Audio playing">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 8.5a4 4 0 010 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 6a7 7 0 010 12" />
                </svg>
              </span>
            )}

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
              disabled={focusMode || (focusLockedTabId && tab.id === focusLockedTabId)}
            >
              ×
            </button>
          </div>
        ))}

        {/* New tab button */}
        {!focusMode && (
          <button
            type="button"
            className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary border border-transparent hover:border-border/40 transition-colors"
            onClick={handleAddTab}
            title="New tab (Cmd+T)"
          >
            +
          </button>
        )}

        {/* New private tab button */}
        {!focusMode && (
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
        )}
      </div>
    </div>
  );
}
