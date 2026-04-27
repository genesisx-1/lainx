import { create } from 'zustand';

type FocusTimerState = {
  running: boolean;
  startedAt: number | null;
  durationSec: number | null; // null = no countdown, just “on”
};

type BreakGlassState = {
  until: number | null; // ms epoch
  cooldownUntil: number | null; // ms epoch
  allowMinutes: number; // config
  cooldownMinutes: number; // config
};

type FocusBlockOverlay = {
  url: string;
  rule: string;
  at: number;
} | null;

interface UIState {
  sidebarOpen: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
  lastTerminalHeight: number;
  focusMode: boolean;
  focusLockedTabId: string | null;
  focusBlocklist: string[];
  focusTimer: FocusTimerState;
  breakGlass: BreakGlassState;
  focusBlockOverlay: FocusBlockOverlay;
  showOnboarding: boolean;
  showHistory: boolean;
  showSettings: boolean;
  showFindInPage: boolean;
  showBookmarksBar: boolean;
  showCommandPalette: boolean;
  showCapsuleManager: boolean;
  showCapsuleEditorForId: string | null;
  pendingTerminalCommand: { id: string; text: string; run: boolean } | null;
  currentTerminalId: string | null;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTerminalOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  setFocusMode: (enabled: boolean) => void;
  startFocusMode: (options: { lockedTabId: string; durationMinutes?: number }) => void;
  stopFocusMode: () => void;
  setFocusBlocklist: (list: string[]) => void;
  showFocusBlocked: (payload: { url: string; rule: string }) => void;
  clearFocusBlocked: () => void;
  breakGlassNow: () => void;
  setShowOnboarding: (show: boolean) => void;
  setShowHistory: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowFindInPage: (show: boolean) => void;
  setShowBookmarksBar: (show: boolean) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowCapsuleManager: (show: boolean) => void;
  setShowCapsuleEditorForId: (id: string | null) => void;
  setCurrentTerminalId: (id: string | null) => void;
  queueTerminalCommand: (text: string, options?: { run?: boolean }) => void;
  clearPendingTerminalCommand: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  terminalOpen: true,
  terminalHeight: 300,
  lastTerminalHeight: 300,
  focusMode: false,
  focusLockedTabId: null,
  focusBlocklist: [
    'youtube.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'news.ycombinator.com'
  ],
  focusTimer: { running: false, startedAt: null, durationSec: 25 * 60 },
  breakGlass: { until: null, cooldownUntil: null, allowMinutes: 5, cooldownMinutes: 10 },
  focusBlockOverlay: null,
  showOnboarding: false,
  showHistory: false,
  showSettings: false,
  showFindInPage: false,
  showBookmarksBar: true,
  showCommandPalette: false,
  showCapsuleManager: false,
  showCapsuleEditorForId: null,
  pendingTerminalCommand: null,
  currentTerminalId: null,

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
  startFocusMode: (options: { lockedTabId: string; durationMinutes?: number }) =>
    set((s) => {
      const durationSec =
        typeof options.durationMinutes === 'number'
          ? Math.max(1, Math.round(options.durationMinutes * 60))
          : (s.focusTimer.durationSec ?? 25 * 60);
      return {
        focusMode: true,
        focusLockedTabId: options.lockedTabId,
        focusTimer: { running: true, startedAt: Date.now(), durationSec },
        focusBlockOverlay: null,
        breakGlass: {
          ...s.breakGlass,
          // keep config, clear active windows
          until: null,
          cooldownUntil: null
        }
      };
    }),
  stopFocusMode: () =>
    set((s) => ({
      focusMode: false,
      focusLockedTabId: null,
      focusTimer: { running: false, startedAt: null, durationSec: s.focusTimer.durationSec ?? 25 * 60 },
      focusBlockOverlay: null,
      breakGlass: { ...s.breakGlass, until: null, cooldownUntil: null }
    })),
  setFocusBlocklist: (list: string[]) =>
    set(() => ({
      focusBlocklist: (list || [])
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .slice(0, 200)
    })),
  showFocusBlocked: (payload: { url: string; rule: string }) =>
    set(() => ({
      focusBlockOverlay: { url: payload.url, rule: payload.rule, at: Date.now() }
    })),
  clearFocusBlocked: () => set({ focusBlockOverlay: null }),
  breakGlassNow: () =>
    set((s) => {
      const now = Date.now();
      if (s.breakGlass.cooldownUntil && s.breakGlass.cooldownUntil > now) return {};
      const allowMs = Math.max(1, s.breakGlass.allowMinutes) * 60 * 1000;
      const cooldownMs = Math.max(1, s.breakGlass.cooldownMinutes) * 60 * 1000;
      return {
        breakGlass: {
          ...s.breakGlass,
          until: now + allowMs,
          cooldownUntil: now + cooldownMs
        },
        focusBlockOverlay: null
      };
    }),
  setShowOnboarding: (show: boolean) => set({ showOnboarding: show }),
  setShowHistory: (show: boolean) => set({ showHistory: show }),
  setShowSettings: (show: boolean) => set({ showSettings: show }),
  setShowFindInPage: (show: boolean) => set({ showFindInPage: show }),
  setShowBookmarksBar: (show: boolean) => set({ showBookmarksBar: show }),
  setShowCommandPalette: (show: boolean) => set({ showCommandPalette: show }),
  setShowCapsuleManager: (show: boolean) => set({ showCapsuleManager: show }),
  setShowCapsuleEditorForId: (id: string | null) => set({ showCapsuleEditorForId: id }),
  setCurrentTerminalId: (id: string | null) => set({ currentTerminalId: id }),
  queueTerminalCommand: (text: string, options?: { run?: boolean }) =>
    set({
      pendingTerminalCommand: {
        id: `ptc-${Date.now()}`,
        text,
        run: options?.run !== false
      }
    }),
  clearPendingTerminalCommand: () => set({ pendingTerminalCommand: null })
}));
