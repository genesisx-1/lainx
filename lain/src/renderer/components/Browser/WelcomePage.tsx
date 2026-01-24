import React, { useMemo, useState, FormEvent } from 'react';
import { useBrowserStore } from '../../store/browser.store';

export function WelcomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { activeTabId, updateTab, addTab } = useBrowserStore();

  const modes = useMemo(
    () => [
      { name: 'Browse', icon: '🧭' },
      { name: 'Focus', icon: '⦿' },
      { name: 'Build', icon: '⚒' },
      { name: 'Automate', icon: '⚙' }
    ],
    []
  );

  const capsules = useMemo(
    () => [
      { name: 'Research', icon: '🔎' },
      { name: 'Dev Session', icon: '⌘' },
      { name: 'Invoices', icon: '🧾' },
      { name: 'Custom +', icon: '+' }
    ],
    []
  );

  const navigateInApp = (url: string, mode: 'current' | 'new' = 'current') => {
    const clean = url.trim();
    if (!clean) return;

    if (mode === 'new') {
      addTab(clean);
      return;
    }

    if (activeTabId) {
      updateTab(activeTabId, { url: clean, title: 'Loading…' });
      return;
    }

    addTab(clean);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // If it looks like a URL, treat it like navigation. Otherwise Google search.
    let url = q;
    const looksLikeUrl = q.includes('.') && !q.includes(' ');
    if (looksLikeUrl && !q.startsWith('http://') && !q.startsWith('https://')) {
      url = `https://${q}`;
    } else if (!looksLikeUrl && !q.startsWith('http://') && !q.startsWith('https://')) {
      url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }

    navigateInApp(url, 'current');
  };

  return (
    <div className="w-full h-full flex items-center justify-center px-6">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <div className="text-sm tracking-[0.35em] text-accent/90 font-semibold">
            LAIN
          </div>
          <div className="mt-4 text-4xl md:text-5xl font-semibold text-text-primary/95">
            What do you want to do?
          </div>
        </div>

        {/* Command/Search bar */}
        <form onSubmit={handleSearch} className="w-full max-w-3xl">
          <div className="relative lain-glass lain-glow lain-pill">
            <div className="absolute inset-y-0 left-4 flex items-center text-accent/90">
              <span className="text-lg">{'>'}</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="summarize this site..."
              className="w-full h-12 md:h-14 pl-11 pr-12 bg-transparent border-0 text-text-primary text-base md:text-lg focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="absolute inset-y-0 right-3 flex items-center justify-center w-10 text-text-muted hover:text-accent transition-colors"
              title="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </form>

        {/* Mode buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          {modes.map((m) => (
            <button
              key={m.name}
              type="button"
              className="lain-glass rounded-xl px-5 h-11 flex items-center gap-3 text-text-secondary hover:text-text-primary hover:bg-bg-secondary/40 transition-colors"
              title={m.name}
            >
              <span className="text-text-muted">{m.icon}</span>
              <span className="text-sm font-medium">{m.name}</span>
            </button>
          ))}
        </div>

        {/* Capsules */}
        <div className="mt-10">
          <div className="text-xs tracking-[0.25em] text-text-muted mb-3">
            SESSION CAPSULES
          </div>
          <div className="flex flex-wrap gap-3">
            {capsules.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`lain-glass rounded-xl px-5 h-11 flex items-center gap-3 text-sm transition-colors ${
                  c.name === 'Custom +'
                    ? 'text-text-primary hover:bg-bg-secondary/40 border border-border/40'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/40'
                }`}
                title={c.name}
              >
                <span className="text-text-muted">{c.icon}</span>
                <span className="font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-10 text-sm text-text-muted flex items-center gap-2">
          <span>Press</span>
          <kbd className="px-2 py-1 lain-glass rounded-md">⌘ K</kbd>
          <span>to begin</span>
        </div>

        <div className="mt-8 text-xs text-text-muted/80 flex items-center gap-3">
          <button type="button" className="hover:text-text-primary transition-colors">Settings</button>
          <span>•</span>
          <button type="button" className="hover:text-text-primary transition-colors">Theme</button>
          <span>•</span>
          <button type="button" className="hover:text-text-primary transition-colors">Shortcuts</button>
          <span>•</span>
          <button type="button" className="hover:text-text-primary transition-colors">About</button>
        </div>
      </div>
    </div>
  );
}
