import React from 'react';
import { useBookmarksStore } from '../../store/bookmarks.store';
import { useBrowserStore } from '../../store/browser.store';

export function BookmarksBar() {
  const { bookmarks } = useBookmarksStore();
  const { updateTab, activeTabId } = useBrowserStore();

  if (bookmarks.length === 0) return null;

  const navigateTo = (url: string) => {
    if (activeTabId) {
      updateTab(activeTabId, { url, isLoading: true });
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`;
    } catch {
      return null;
    }
  };

  const getDisplayName = (title: string, url: string) => {
    if (title && title !== url) {
      return title.length > 20 ? title.slice(0, 20) + '...' : title;
    }
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url.slice(0, 20);
    }
  };

  return (
    <div className="h-8 flex items-center gap-1 px-3 bg-bg-secondary border-b border-border overflow-x-auto scrollbar-hide">
      <span className="text-xs text-text-muted mr-2 flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </span>
      {bookmarks.slice(0, 20).map((bookmark) => (
        <button
          key={bookmark.id}
          onClick={() => navigateTo(bookmark.url)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-primary hover:bg-bg-primary rounded transition-colors flex-shrink-0"
          title={bookmark.url}
        >
          {getFaviconUrl(bookmark.url) && (
            <img
              src={getFaviconUrl(bookmark.url)!}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span>{getDisplayName(bookmark.title, bookmark.url)}</span>
        </button>
      ))}
    </div>
  );
}
