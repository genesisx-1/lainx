import React, { useState, useMemo } from 'react';
import { useHistoryStore, HistoryEntry } from '../../store/history.store';
import { useBrowserStore } from '../../store/browser.store';

interface HistoryPanelProps {
  onClose: () => void;
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const { entries, removeEntry, clearHistory } = useHistoryStore();
  const { updateTab, activeTabId } = useBrowserStore();
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      e => e.url.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: HistoryEntry[] } = {};
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.visitedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    
    return groups;
  }, [filteredEntries]);

  const navigateTo = (url: string) => {
    if (activeTabId) {
      updateTab(activeTabId, { url, isLoading: true });
    }
    onClose();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-primary border border-border rounded-lg w-[600px] max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearHistory}
              className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Search history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-bg-secondary border border-border rounded text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.keys(groupedByDate).length === 0 ? (
            <div className="text-center text-text-muted py-8">
              {search ? 'No results found' : 'No browsing history'}
            </div>
          ) : (
            Object.entries(groupedByDate).map(([date, items]) => (
              <div key={date} className="mb-4">
                <h3 className="text-xs font-medium text-text-muted px-2 py-1 sticky top-0 bg-bg-primary">
                  {date}
                </h3>
                {items.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-2 py-2 hover:bg-bg-secondary rounded group cursor-pointer"
                    onClick={() => navigateTo(entry.url)}
                  >
                    <div className="w-4 h-4 flex items-center justify-center text-text-muted">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{entry.title}</div>
                      <div className="text-xs text-text-muted truncate">{entry.url}</div>
                    </div>
                    <span className="text-xs text-text-muted">{formatTime(entry.visitedAt)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEntry(entry.id);
                      }}
                      className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
