import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  lastTerminalHeight: number;
  focusMode: boolean;
  showOnboarding: boolean;
  showHistory: boolean;
  showSettings: boolean;
  showFindInPage: boolean;
  showBookmarksBar: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTerminalOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  setFocusMode: (enabled: boolean) => void;
  setShowOnboarding: (show: boolean) => void;
  setShowHistory: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowFindInPage: (show: boolean) => void;
  setShowBookmarksBar: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  terminalOpen: true,
  terminalHeight: 300,
  lastTerminalHeight: 300,
  focusMode: false,
  showOnboarding: false,
  showHistory: false,
  showSettings: false,
  showFindInPage: false,
  showBookmarksBar: true,

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTerminalOpen: (open: boolean) => set({ terminalOpen: open }),
  toggleTerminal: () =>
    set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalHeight: (height: number) =>
    set((s) => ({
      terminalHeight: height,
      lastTerminalHeight: s.terminalOpen ? height : s.lastTerminalHeight
    })),
  setFocusMode: (enabled: boolean) => set({ focusMode: enabled }),
  setShowOnboarding: (show: boolean) => set({ showOnboarding: show }),
  setShowHistory: (show: boolean) => set({ showHistory: show }),
  setShowSettings: (show: boolean) => set({ showSettings: show }),
  setShowFindInPage: (show: boolean) => set({ showFindInPage: show }),
  setShowBookmarksBar: (show: boolean) => set({ showBookmarksBar: show })
}));
