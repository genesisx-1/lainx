import { create } from 'zustand';
import type { Tab } from '../../shared/types';
import { useUIStore } from './ui.store';

function getHost(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

function matchBlockRule(host: string, rule: string): boolean {
  const r = (rule || '').trim().toLowerCase();
  if (!r) return false;
  if (!host) return false;
  if (host === r) return true;
  if (host.endsWith('.' + r)) return true;
  // fallback substring match for simple patterns
  return host.includes(r);
}

function focusShouldBlock(url: string): { blocked: boolean; rule?: string } {
  const ui = useUIStore.getState();
  if (!ui.focusMode) return { blocked: false };
  const now = Date.now();
  if (ui.breakGlass.until && ui.breakGlass.until > now) return { blocked: false };
  const host = getHost(url);
  if (!host) return { blocked: false };
  for (const rule of ui.focusBlocklist || []) {
    if (matchBlockRule(host, rule)) return { blocked: true, rule };
  }
  return { blocked: false };
}

interface PageContent {
  url: string;
  title: string;
  text: string;
  html: string;
}

interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
  type?: string;
  placeholder?: string;
}

interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
  webviewApi: {
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
    stop: () => void;
    getPageContent: () => Promise<PageContent>;
    getInteractiveElements: () => Promise<InteractiveElement[]>;
    clickElement: (index: number) => Promise<boolean>;
    typeInElement: (index: number, text: string) => Promise<boolean>;
    scrollPage: (direction: 'up' | 'down') => Promise<void>;
    executeScript: (script: string) => Promise<any>;
  } | null;
  setWebviewApi: (api: BrowserState['webviewApi']) => void;
  addTab: (url?: string, options?: { isPrivate?: boolean }) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  replaceTabs: (tabs: Tab[], activeTabId: string | null) => void;
  resetToWelcome: () => void;
}

export const useBrowserStore = create<BrowserState>((set) => ({
  tabs: [
    {
      id: 'tab-1',
      url: 'lain://welcome',
      title: 'Welcome to LAIN',
      isActive: true,
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    }
  ],
  activeTabId: 'tab-1',
  webviewApi: null,
  setWebviewApi: (api) => set({ webviewApi: api }),

  addTab: (url = 'lain://welcome', options) => {
    const ui = useUIStore.getState();
    // Focus mode: lock to a single tab (no new tabs).
    if (ui.focusMode) {
      return;
    }

    const isPrivate = !!options?.isPrivate;
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      url,
      title: 'New Tab',
      isActive: true,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isPrivate
    };

    set((state) => ({
      tabs: [
        ...state.tabs.map((tab) => ({ ...tab, isActive: false })),
        newTab
      ],
      activeTabId: newTab.id
    }));
  },

  closeTab: (id: string) => {
    set((state) => {
      const ui = useUIStore.getState();
      if (ui.focusMode && ui.focusLockedTabId) {
        // Focus mode: don't allow closing any tabs while locked.
        return state;
      }

      const remainingTabs = state.tabs.filter((tab) => tab.id !== id);
      
      if (remainingTabs.length === 0) {
        // Create a new tab if all are closed
        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          url: 'lain://welcome',
          title: 'Welcome to LAIN',
          isActive: true,
          isLoading: false,
          canGoBack: false,
          canGoForward: false
        };
        return { tabs: [newTab], activeTabId: newTab.id };
      }

      // If we closed the active tab, activate another one
      if (id === state.activeTabId) {
        const newActiveTab = remainingTabs[remainingTabs.length - 1];
        return {
          tabs: remainingTabs.map((tab) => ({
            ...tab,
            isActive: tab.id === newActiveTab.id
          })),
          activeTabId: newActiveTab.id
        };
      }

      return { tabs: remainingTabs };
    });
  },

  setActiveTab: (id: string) => {
    const ui = useUIStore.getState();
    if (ui.focusMode && ui.focusLockedTabId && id !== ui.focusLockedTabId) {
      return;
    }
    set((state) => ({
      tabs: state.tabs.map((tab) => ({
        ...tab,
        isActive: tab.id === id
      })),
      activeTabId: id
    }));
  },

  updateTab: (id: string, updates: Partial<Tab>) => {
    if (updates.url && typeof updates.url === 'string') {
      const ui = useUIStore.getState();
      if (ui.focusMode && ui.focusLockedTabId && id !== ui.focusLockedTabId) {
        return;
      }
      const res = focusShouldBlock(updates.url);
      if (res.blocked) {
        useUIStore.getState().showFocusBlocked({ url: updates.url, rule: res.rule || 'blocked' });
        return;
      }
    }
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...updates } : tab
      )
    }));
  },

  replaceTabs: (tabs: Tab[], activeTabId: string | null) => {
    const ui = useUIStore.getState();
    if (ui.focusMode) return;
    const normalizedTabs = (tabs || []).length
      ? tabs.map((t) => ({ ...t, isActive: t.id === activeTabId }))
      : [
          {
            id: `tab-${Date.now()}`,
            url: 'lain://welcome',
            title: 'Welcome to LAIN',
            isActive: true,
            isLoading: false,
            canGoBack: false,
            canGoForward: false
          }
        ];

    const nextActive =
      activeTabId && normalizedTabs.some((t) => t.id === activeTabId)
        ? activeTabId
        : normalizedTabs.find((t) => t.isActive)?.id || normalizedTabs[0].id;

    set({
      tabs: normalizedTabs.map((t) => ({ ...t, isActive: t.id === nextActive })),
      activeTabId: nextActive
    });
  },

  resetToWelcome: () => {
    const ui = useUIStore.getState();
    if (ui.focusMode) return;
    const id = `tab-${Date.now()}`;
    set({
      tabs: [
        {
          id,
          url: 'lain://welcome',
          title: 'Welcome to LAIN',
          isActive: true,
          isLoading: false,
          canGoBack: false,
          canGoForward: false
        }
      ],
      activeTabId: id
    });
  }
}));
