import React from 'react';
import { useBrowserStore } from '../../store/browser.store';

export function TabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useBrowserStore();

  return (
    <div className="flex items-center h-12 px-2 bg-bg-secondary">
      {/* Tab list */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer
              min-w-[120px] max-w-[200px] group
              ${tab.isActive 
                ? 'bg-bg-primary text-text-primary' 
                : 'bg-bg-panel text-text-secondary hover:bg-bg-secondary'
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

            {/* Close button */}
            <button
              className="w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-border rounded"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}

        {/* New tab button */}
        <button
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-panel rounded text-text-secondary"
          onClick={() => addTab()}
          title="New tab (Cmd+T)"
        >
          +
        </button>
      </div>
    </div>
  );
}
