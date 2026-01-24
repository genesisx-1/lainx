import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import { useBookmarksStore } from '../../store/bookmarks.store';

export function AddressBar() {
  const { tabs, activeTabId, updateTab, webviewApi, addTab } = useBrowserStore();
  const { toggleSidebar, toggleTerminal, sidebarOpen, terminalOpen } = useUIStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url || '');
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const bookmarksMenuRef = useRef<HTMLDivElement | null>(null);
  const [bookmarkBump, setBookmarkBump] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState<{ key: number; text: string } | null>(null);

  const bookmarks = useBookmarksStore((s) => s.bookmarks);
  const isBookmarked = useBookmarksStore((s) => s.isBookmarked);
  const toggleBookmark = useBookmarksStore((s) => s.toggleBookmark);
  const removeBookmark = useBookmarksStore((s) => s.removeBookmark);

  useEffect(() => {
    if (activeTab && activeTab.url !== 'lain://welcome') {
      setUrlInput(activeTab.url);
    }
  }, [activeTab?.url]);

  const canBookmark = !!activeTab && activeTab.url !== 'lain://welcome';
  const bookmarked = useMemo(() => {
    if (!activeTab) return false;
    return isBookmarked(activeTab.url);
  }, [activeTab?.url, isBookmarked]);

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

  const handleToggleBookmark = useCallback(() => {
    if (!activeTab || !canBookmark) return;
    const wasBookmarked = isBookmarked(activeTab.url);
    toggleBookmark(activeTab.url, activeTab.title || activeTab.url);

    // Micro-animation + toast so the user knows it worked.
    // Restart animation even if clicked quickly.
    setBookmarkBump(false);
    requestAnimationFrame(() => setBookmarkBump(true));
    const bumpTimer = window.setTimeout(() => setBookmarkBump(false), 260);

    const key = Date.now();
    setBookmarkToast({ key, text: wasBookmarked ? 'Removed' : 'Saved' });
    const toastTimer = window.setTimeout(() => setBookmarkToast(null), 950);

    return () => {
      window.clearTimeout(bumpTimer);
      window.clearTimeout(toastTimer);
    };
  }, [activeTab, canBookmark, toggleBookmark, isBookmarked]);

  const handleOpenBookmarks = useCallback(() => {
    setBookmarksOpen((v) => !v);
  }, []);

  const handleOpenBookmarkUrl = useCallback(
    (url: string) => {
      addTab(url);
      setBookmarksOpen(false);
    },
    [addTab]
  );

  const handleRemoveBookmarkUrl = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.preventDefault();
      e.stopPropagation();
      removeBookmark(url);
    },
    [removeBookmark]
  );

  // Close bookmarks on outside click / escape.
  useEffect(() => {
    if (!bookmarksOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBookmarksOpen(false);
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // Treat the dropdown + toggle buttons as "inside" so clicking the icon
      // doesn't close + immediately reopen (which looks like it's broken).
      if (bookmarksMenuRef.current?.contains(target)) return;
      setBookmarksOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [bookmarksOpen]);

  return (
    <div className="relative flex items-center h-12 px-4 gap-3 mt-2 lain-glass rounded-xl">
      {/* Back/Forward buttons */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleBack}
          disabled={!activeTab?.canGoBack}
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Go back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={!activeTab?.canGoForward}
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Go forward"
        >
          →
        </button>
        <button
          type="button"
          onClick={handleReloadOrStop}
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary transition-colors"
          title={activeTab?.isLoading ? 'Stop' : 'Reload'}
        >
          {activeTab?.isLoading ? '×' : '↻'}
        </button>
      </div>

      {/* Address bar */}
      <form onSubmit={handleNavigate} className="flex-1">
        <div ref={bookmarksMenuRef} className="relative">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full h-10 pl-4 pr-20 lain-pill bg-bg-secondary/40 border border-border/40 text-text-primary text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            placeholder="Search or enter URL"
          />

          {/* Bookmark buttons (Comet-like: inside address bar, right side) */}
          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                disabled={!canBookmark}
                onClick={handleToggleBookmark}
                className={`w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  bookmarked ? 'text-accent' : 'text-text-muted'
                }`}
                title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                <span className={bookmarkBump ? 'lain-bookmark-pop inline-flex' : 'inline-flex'}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {bookmarkToast && (
                <div
                  key={bookmarkToast.key}
                  className="pointer-events-none absolute -top-7 right-0 lain-bookmark-toast"
                >
                  <div className="px-2 py-1 rounded-md text-[11px] font-medium bg-bg-panel border border-border text-text-secondary shadow">
                    {bookmarkToast.text}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenBookmarks}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 text-text-muted transition-colors"
              title="Bookmarks"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M8 6h11M8 12h11M8 18h11M5 6h.01M5 12h.01M5 18h.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Bookmarks dropdown */}
          {bookmarksOpen && (
            <div className="absolute top-full right-0 mt-3 w-[360px] lain-glass rounded-xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="text-sm font-medium text-text-primary">Bookmarks</div>
                <button
                  type="button"
                  onClick={() => setBookmarksOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 text-text-muted transition-colors"
                  title="Close"
                >
                  ×
                </button>
              </div>

              {bookmarks.length === 0 ? (
                <div className="px-3 py-3 text-sm text-text-muted">
                  No bookmarks yet. Click the star to save the current page.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto">
                  {bookmarks.slice(0, 50).map((b) => (
                    <div
                      key={b.id}
                      className="w-full px-3 py-2 hover:bg-bg-secondary/40 flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenBookmarkUrl(b.url)}
                        className="flex-1 min-w-0 text-left"
                        title={b.url}
                      >
                        <div className="text-sm text-text-primary truncate">{b.title}</div>
                        <div className="text-xs text-text-muted truncate">{b.url}</div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveBookmarkUrl(e, b.url)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 text-text-muted transition-colors"
                        title="Remove bookmark"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Actions */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={toggleTerminal}
          className={`px-3 h-9 flex items-center justify-center rounded text-sm border transition-colors ${
            terminalOpen
              ? 'bg-bg-secondary/40 text-text-primary border-border/40'
              : 'hover:bg-bg-secondary/40 text-text-secondary border-transparent hover:border-border/40'
          }`}
          title={terminalOpen ? 'Hide terminal (Cmd+`)' : 'Show terminal (Cmd+`)'}
        >
          {terminalOpen ? 'Hide Terminal' : 'Show Terminal'}
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className={`px-3 h-9 flex items-center justify-center rounded text-sm border transition-colors ${
            sidebarOpen
              ? 'bg-accent text-white border-accent'
              : 'hover:bg-bg-secondary/40 text-text-secondary border-transparent hover:border-border/40'
          }`}
          title="Toggle AI panel (Cmd+Shift+A)"
        >
          AI
        </button>
      </div>

    </div>
  );
}
