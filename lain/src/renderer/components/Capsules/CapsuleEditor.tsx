import React, { useMemo, useState } from 'react';
import type { Capsule } from '../../../shared/types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import { useAIStore } from '../../store/ai.store';

export function CapsuleEditor({
  capsule,
  onClose,
  onSaved
}: {
  capsule: Capsule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(capsule.name || '');
  const [description, setDescription] = useState(capsule.description || '');
  const [saving, setSaving] = useState(false);

  const browser = useBrowserStore();
  const ui = useUIStore();
  const ai = useAIStore();

  const canSnapshot = useMemo(() => !!browser.activeTabId, [browser.activeTabId]);

  const save = async (includeSnapshot: boolean) => {
    setSaving(true);
    try {
      const updates: any = {
        name: name.trim() || 'Untitled Capsule',
        description: description.trim() || undefined
      };

      if (includeSnapshot && canSnapshot) {
        const terminalCwd =
          ui.currentTerminalId
            ? await window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_CWD, ui.currentTerminalId)
            : null;
        const lastCommand =
          ui.currentTerminalId
            ? await window.electron.ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_GET_LAST_COMMAND, ui.currentTerminalId)
            : null;

        updates.workspace = {
          tabs: browser.tabs.map((t) => ({ ...t, isLoading: false })),
          activeTabId: browser.activeTabId,
          ui: {
            sidebarOpen: ui.sidebarOpen,
            terminalOpen: ui.terminalOpen,
            terminalHeight: ui.terminalHeight,
            showBookmarksBar: ui.showBookmarksBar,
            focusMode: ui.focusMode,
            focusBlocklist: ui.focusBlocklist,
            focusDurationMin: ui.focusTimer?.durationSec ? Math.round(ui.focusTimer.durationSec / 60) : 25
          },
          terminal: {
            cwd: terminalCwd || undefined,
            lastCommand: lastCommand || undefined
          },
          ai: {
            messages: ai.messages,
            settings: ai.settings,
            currentConversationId: ai.currentConversationId
          }
        };
      }

      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.STORAGE_UPDATE_CAPSULE, capsule.id, updates);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-6">
      <div className="w-[640px] max-w-[95vw] bg-bg-primary border border-border rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-text-primary">Edit Capsule</div>
            <div className="text-xs text-text-muted mt-1">Update metadata, and optionally overwrite with current workspace.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block">
            <div className="text-xs text-text-muted mb-1">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-bg-secondary border border-border text-text-primary text-sm"
              placeholder="My Capsule"
            />
          </label>

          <label className="block">
            <div className="text-xs text-text-muted mb-1">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 px-3 py-2 rounded-md bg-bg-secondary border border-border text-text-primary text-sm"
              placeholder="What is this capsule for?"
            />
          </label>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => save(false).catch(() => {})}
            disabled={saving}
            className="px-3 h-9 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-sm border border-border disabled:opacity-50"
          >
            Save Metadata
          </button>
          <button
            type="button"
            onClick={() => save(true).catch(() => {})}
            disabled={saving || !canSnapshot}
            className="px-3 h-9 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-50"
            title={canSnapshot ? 'Overwrite this capsule with current workspace state' : 'No active tab'}
          >
            Save + Overwrite Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

