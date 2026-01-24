import React, { useMemo, useState, FormEvent } from 'react';
import { useBrowserStore } from '../../store/browser.store';

export function WelcomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { activeTabId, updateTab, addTab } = useBrowserStore();

  const modes = useMemo(
    () => [
      { name: 'Browse', icon: 'compass' as const },
      { name: 'Focus', icon: 'target' as const },
      { name: 'Build', icon: 'wrench' as const },
      { name: 'Automate', icon: 'settings' as const }
    ],
    []
  );

  const capsules = useMemo(
    () => [
      { name: 'Research', icon: 'search' as const },
      { name: 'Dev Session', icon: 'command' as const },
      { name: 'Invoices', icon: 'receipt' as const },
      { name: 'Custom +', icon: 'plus' as const }
    ],
    []
  );

  const Glyph = ({ name }: { name: typeof modes[number]['icon'] | typeof capsules[number]['icon'] }) => {
    switch (name) {
      case 'compass':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.5 9.5l-3 7 7-3 3-7-7 3z" />
          </svg>
        );
      case 'target':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2v3m0 14v3m10-10h-3M5 12H2m17.07-7.07l-2.12 2.12M7.05 16.95l-2.12 2.12m0-14.14l2.12 2.12m12.02 12.02l2.12 2.12" />
          </svg>
        );
      case 'wrench':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.7 6.3a4 4 0 01-5.4 5.4l-6.3 6.3a2 2 0 102.8 2.8l6.3-6.3a4 4 0 005.4-5.4z" />
          </svg>
        );
      case 'settings':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'search':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19a8 8 0 100-16 8 8 0 000 16z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35" />
          </svg>
        );
      case 'command':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9a2 2 0 11-4 0 2 2 0 014 0zm0 0h6m0 0a2 2 0 114 0 2 2 0 01-4 0zm0 0v6m0 0a2 2 0 11-4 0 2 2 0 014 0zm0 0h6m0 0a2 2 0 114 0 2 2 0 01-4 0z" />
          </svg>
        );
      case 'receipt':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m-6 4h6m-6 4h6M7 3h10a2 2 0 012 2v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 012-2z" />
          </svg>
        );
      case 'plus':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
          </svg>
        );
    }
  };

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
              <span className="text-text-muted"><Glyph name={m.icon} /></span>
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
                <span className="text-text-muted"><Glyph name={c.icon} /></span>
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
