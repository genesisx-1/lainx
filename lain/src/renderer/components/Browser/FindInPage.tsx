import React, { useState, useEffect, useRef, useCallback } from 'react';

interface FindInPageProps {
  webviewRef: React.RefObject<Electron.WebviewTag>;
  onClose: () => void;
}

export function FindInPage({ webviewRef, onClose }: FindInPageProps) {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFind = useCallback((forward: boolean = true) => {
    const webview = webviewRef.current;
    if (!webview || !query.trim()) return;

    webview.findInPage(query, {
      forward,
      findNext: true
    });
  }, [query, webviewRef]);

  const handleStopFind = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.stopFindInPage('clearSelection');
    }
    setMatchCount(0);
    setActiveMatch(0);
  }, [webviewRef]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleFoundInPage = (event: any) => {
      if (event.result) {
        setMatchCount(event.result.matches || 0);
        setActiveMatch(event.result.activeMatchOrdinal || 0);
      }
    };

    webview.addEventListener('found-in-page', handleFoundInPage);
    return () => {
      webview.removeEventListener('found-in-page', handleFoundInPage);
      handleStopFind();
    };
  }, [webviewRef, handleStopFind]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !query.trim()) {
      handleStopFind();
      return;
    }

    const timeout = setTimeout(() => {
      webview.findInPage(query);
    }, 150);

    return () => clearTimeout(timeout);
  }, [query, webviewRef, handleStopFind]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleFind(!e.shiftKey);
    }
  };

  return (
    <div className="absolute top-0 right-4 z-50 flex items-center gap-2 p-2 bg-bg-primary border border-border rounded-b-lg shadow-lg">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className="w-48 px-2 py-1 text-sm bg-bg-secondary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
      />
      
      <span className="text-xs text-text-muted min-w-[60px]">
        {query && matchCount > 0 ? `${activeMatch}/${matchCount}` : query ? '0/0' : ''}
      </span>

      <button
        onClick={() => handleFind(false)}
        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-50"
        disabled={matchCount === 0}
        title="Previous (Shift+Enter)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      <button
        onClick={() => handleFind(true)}
        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-50"
        disabled={matchCount === 0}
        title="Next (Enter)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <button
        onClick={onClose}
        className="p-1 text-text-muted hover:text-text-primary"
        title="Close (Esc)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
