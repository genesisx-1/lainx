import { create } from 'zustand';
import type { Tab } from '../../shared/types';

interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
  webviewApi: {
    goBack: () => void;
    goForward: () => void;
    reload: () => void;
    stop: () => void;
  } | null;
  setWebviewApi: (api: BrowserState['webviewApi']) => void;
  addTab: (url?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
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

  addTab: (url = 'lain://welcome') => {
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      url,
      title: 'New Tab',
      isActive: true,
      isLoading: false,
      canGoBack: false,
      canGoForward: false
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
    set((state) => ({
      tabs: state.tabs.map((tab) => ({
        ...tab,
        isActive: tab.id === id
      })),
      activeTabId: id
    }));
  },

  updateTab: (id: string, updates: Partial<Tab>) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...updates } : tab
      )
    }));
  }
}));
