import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import { useBookmarksStore } from '../../store/bookmarks.store';

interface AddressBarProps {
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
}

export function AddressBar({ onHistoryClick, onSettingsClick }: AddressBarProps) {
  const { tabs, activeTabId, updateTab, webviewApi, addTab } = useBrowserStore();
  const { toggleSidebar, toggleTerminal, sidebarOpen, terminalOpen } = useUIStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url || '');
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const bookmarksMenuRef = useRef<HTMLDivElement | null>(null);
  const [bookmarksDropdownPos, setBookmarksDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [bookmarkBump, setBookmarkBump] = useState(false);
  const [bookmarkToast, setBookmarkToast] = useState<{ key: number; text: string } | null>(null);
  const bookmarkBumpTimerRef = useRef<number | null>(null);
  const bookmarkToastTimerRef = useRef<number | null>(null);

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
  const bookmarked = activeTab ? isBookmarked(activeTab.url) : false;

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
      updateTab(activeTabId, { url, isLoading: true });
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
    if (bookmarkBumpTimerRef.current) window.clearTimeout(bookmarkBumpTimerRef.current);
    if (bookmarkToastTimerRef.current) window.clearTimeout(bookmarkToastTimerRef.current);
    setBookmarkBump(false);
    requestAnimationFrame(() => setBookmarkBump(true));
    bookmarkBumpTimerRef.current = window.setTimeout(() => setBookmarkBump(false), 260);

    const key = Date.now();
    setBookmarkToast({ key, text: wasBookmarked ? 'Removed' : 'Saved' });
    bookmarkToastTimerRef.current = window.setTimeout(() => setBookmarkToast(null), 950);
  }, [activeTab, canBookmark, toggleBookmark, isBookmarked]);

  const handleOpenBookmarks = useCallback(() => {
    setBookmarksOpen((v) => {
      const next = !v;
      if (next) {
        const rect = bookmarksMenuRef.current?.getBoundingClientRect();
        if (rect) {
          const width = 360;
          const top = rect.bottom + 12;
          let left = rect.right - width;
          left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
          setBookmarksDropdownPos({ top, left });
        } else {
          setBookmarksDropdownPos({ top: 70, left: window.innerWidth - 380 });
        }
      }
      return next;
    });
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

  useEffect(() => {
    // Cleanup timers on unmount
    return () => {
      if (bookmarkBumpTimerRef.current) window.clearTimeout(bookmarkBumpTimerRef.current);
      if (bookmarkToastTimerRef.current) window.clearTimeout(bookmarkToastTimerRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center h-12 px-4 gap-3 mt-2 lain-glass rounded-xl">
      {/* Back/Forward buttons */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            if (activeTabId) updateTab(activeTabId, { url: 'lain://welcome' });
          }}
          className="w-9 h-9 flex items-center justify-center hover:bg-bg-secondary/40 rounded-xl text-text-secondary transition-colors"
          title="Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 11l9-8 9 8v10a2 2 0 01-2 2h-4a2 2 0 01-2-2v-6H9v6a2 2 0 01-2 2H5a2 2 0 01-2-2V11z" />
          </svg>
        </button>
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

          {/* Bookmark buttons (inside address bar, right side) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={bookmarksOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Bookmarks dropdown */}
          {bookmarksOpen && (
            <div
              className="fixed mt-0 w-[360px] lain-glass rounded-xl overflow-hidden z-[9999]"
              style={{
                top: bookmarksDropdownPos?.top ?? 70,
                left: bookmarksDropdownPos?.left ?? Math.max(10, window.innerWidth - 380)
              }}
            >
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
        {/* History button */}
        <button
          type="button"
          onClick={onHistoryClick}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 text-text-muted transition-colors"
          title="History (Cmd+Y)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-secondary/40 text-text-muted transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={toggleTerminal}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
            terminalOpen
              ? 'bg-bg-secondary/40 text-text-primary'
              : 'hover:bg-bg-secondary/40 text-text-muted'
          }`}
          title={terminalOpen ? 'Hide terminal (Cmd+`)' : 'Show terminal (Cmd+`)'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
            sidebarOpen
              ? 'bg-accent text-white'
              : 'hover:bg-bg-secondary/40 text-text-muted'
          }`}
          title="Toggle AI panel (Cmd+Shift+A)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

    </div>
  );
}
