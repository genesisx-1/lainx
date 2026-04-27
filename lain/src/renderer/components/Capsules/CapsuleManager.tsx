import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Capsule } from '../../../shared/types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import { useAIStore } from '../../store/ai.store';
import { CapsuleEditor } from './CapsuleEditor';

export function CapsuleManager({ onClose }: { onClose: () => void }) {
  const { tabs, activeTabId, replaceTabs } = useBrowserStore();
  const {
    sidebarOpen,
    terminalOpen,
    terminalHeight,
    showBookmarksBar,
    focusMode,
    focusBlocklist,
    focusTimer,
    startFocusMode,
    stopFocusMode,
    setSidebarOpen,
    setTerminalOpen,
    setTerminalHeight,
    setShowBookmarksBar,
    queueTerminalCommand,
    currentTerminalId
  } = useUIStore();

  const aiState = useAIStore();

  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [editing, setEditing] = useState<Capsule | null>(null);

  const refresh = useCallback(async () => {
    const list = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_CAPSULES);
    setCapsules(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setCapsules([]);
    });
  }, [refresh]);

  const saveNewCapsule = useCallback(async () => {
    const name = window.prompt('Capsule name?');
    if (!name) return;

    const terminalCwd =
      currentTerminalId ? await window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_CWD, currentTerminalId) : null;
    const lastCommand =
      currentTerminalId
        ? await window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_LAST_COMMAND, currentTerminalId)
        : null;

    const payload: Capsule = {
      id: `cap-${Date.now()}`,
      name: name.trim(),
      version: 1,
      workspace: {
        tabs: tabs.map((t) => ({ ...t, isLoading: false })),
        activeTabId,
        ui: {
          sidebarOpen,
          terminalOpen,
          terminalHeight,
          showBookmarksBar,
          focusMode,
          focusBlocklist,
          focusDurationMin: focusTimer?.durationSec ? Math.round(focusTimer.durationSec / 60) : 25
        },
        terminal: {
          cwd: terminalCwd || undefined,
          lastCommand: lastCommand || undefined
        },
        ai: {
          messages: aiState.messages,
          settings: aiState.settings,
          currentConversationId: aiState.currentConversationId
        }
      }
    };

    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_CREATE_CAPSULE, payload);
    await refresh();
  }, [
    activeTabId,
    aiState.currentConversationId,
    aiState.messages,
    aiState.settings,
    currentTerminalId,
    focusBlocklist,
    focusMode,
    focusTimer?.durationSec,
    refresh,
    showBookmarksBar,
    sidebarOpen,
    tabs,
    terminalHeight,
    terminalOpen
  ]);

  const restore = useCallback(
    (cap: Capsule) => {
      const ws = cap.workspace;
      if (!ws) return;

      // UI
      setSidebarOpen(ws.ui.sidebarOpen);
      setTerminalOpen(ws.ui.terminalOpen);
      setTerminalHeight(ws.ui.terminalHeight);
      setShowBookmarksBar(ws.ui.showBookmarksBar);

      // Focus mode
      if (ws.ui.focusMode && ws.activeTabId) {
        startFocusMode({ lockedTabId: ws.activeTabId, durationMinutes: ws.ui.focusDurationMin || 25 });
      } else {
        stopFocusMode();
      }

      // Tabs
      replaceTabs(ws.tabs || [], ws.activeTabId || null);

      // Terminal (feasible subset): cd to cwd
      if (ws.ui.terminalOpen && ws.terminal?.cwd) {
        queueTerminalCommand(`cd "${ws.terminal.cwd}"`, { run: true });
      }

      // AI (feasible subset)
      if (ws.ai?.messages) {
        useAIStore.setState({
          messages: ws.ai.messages,
          // keep persisted conversations as-is; just swap active state
          settings: { ...aiState.settings, ...(ws.ai.settings || {}) },
          currentConversationId: ws.ai.currentConversationId || null
        });
      }
    },
    [
      aiState.settings,
      queueTerminalCommand,
      replaceTabs,
      setShowBookmarksBar,
      setSidebarOpen,
      setTerminalHeight,
      setTerminalOpen,
      startFocusMode,
      stopFocusMode
    ]
  );

  const deleteCapsule = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this capsule?')) return;
      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_DELETE_CAPSULE, id);
      await refresh();
    },
    [refresh]
  );

  const exportCapsule = useCallback(async (id: string) => {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_EXPORT_CAPSULE, id);
  }, []);

  const importCapsule = useCallback(async () => {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_IMPORT_CAPSULE);
    await refresh();
  }, [refresh]);

  const sorted = useMemo(() => capsules || [], [capsules]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-bg-primary border border-border rounded-lg w-[720px] max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Capsules</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-border flex items-center gap-2">
          <button
            type="button"
            onClick={() => saveNewCapsule().catch(() => {})}
            className="px-3 h-9 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium"
          >
            Save Current Workspace
          </button>
          <button
            type="button"
            onClick={() => importCapsule().catch(() => {})}
            className="px-3 h-9 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-sm border border-border"
          >
            Import…
          </button>
          <div className="ml-auto text-xs text-text-muted">{sorted.length} total</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-6 text-sm text-text-muted">No capsules yet. Save your current workspace to create one.</div>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((c) => (
                <div key={c.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">{c.name}</div>
                    {c.description && <div className="text-xs text-text-secondary mt-1">{c.description}</div>}
                    <div className="text-xs text-text-muted mt-2">
                      {c.last_used ? `Last used: ${new Date(c.last_used).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restore(c)}
                      className="px-3 h-8 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-xs border border-border"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="px-3 h-8 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-xs border border-border"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => exportCapsule(c.id).catch(() => {})}
                      className="px-3 h-8 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-xs border border-border"
                    >
                      Export…
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCapsule(c.id).catch(() => {})}
                      className="px-3 h-8 rounded-md bg-bg-panel hover:bg-bg-primary text-red-300 text-xs border border-border"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {editing && (
          <CapsuleEditor
            capsule={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh().catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}

