import React, { useMemo, useState, FormEvent } from 'react';
import { useBrowserStore } from '../../store/browser.store';

export function WelcomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { activeTabId, updateTab, addTab } = useBrowserStore();

  const quickLinks = useMemo(
    () => [
      { name: 'GitHub', url: 'https://github.com', icon: '💻' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '📚' },
      { name: 'MDN Docs', url: 'https://developer.mozilla.org', icon: '📖' }
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-bg-primary to-bg-secondary px-4">
      {/* LAIN Logo */}
      <div className="mb-12 text-center">
        <h1 className="text-8xl font-bold mb-4">
          <span className="bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
            LAIN
          </span>
        </h1>
        <p className="text-text-secondary text-lg">
          Your Intelligent Browser Shell
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-2xl mb-8">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the web or enter URL..."
            className="w-full px-6 py-4 pr-12 bg-bg-secondary border border-border rounded-full text-text-primary text-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-accent transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full mb-12">
        {quickLinks.map((link) => (
          <button
            key={link.name}
            type="button"
            onClick={() => navigateInApp(link.url, 'current')}
            className="flex flex-col items-center gap-2 p-4 bg-bg-secondary hover:bg-bg-panel border border-border hover:border-accent rounded-lg transition-all group"
          >
            <span className="text-3xl">{link.icon}</span>
            <span className="text-sm text-text-secondary group-hover:text-text-primary">{link.name}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => navigateInApp('https://www.google.com', 'current')}
          className="flex flex-col items-center gap-2 p-4 bg-bg-secondary hover:bg-bg-panel border border-border hover:border-accent rounded-lg transition-all group"
        >
          <span className="text-3xl">🔎</span>
          <span className="text-sm text-text-secondary group-hover:text-text-primary">Google</span>
        </button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-1">Integrated Terminal</h3>
            <p className="text-sm text-text-secondary">Real shell access with web search commands</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-1">Local AI Assistant</h3>
            <p className="text-sm text-text-secondary">Private, offline models on your machine</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-text-primary mb-1">Productivity Focus</h3>
            <p className="text-sm text-text-secondary">Built for developers and power users</p>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-8 text-center text-sm text-text-muted">
        <p>Press <kbd className="px-2 py-1 bg-bg-panel border border-border rounded">Cmd+K</kbd> for commands • <kbd className="px-2 py-1 bg-bg-panel border border-border rounded">Cmd+`</kbd> for terminal</p>
      </div>
    </div>
  );
}
