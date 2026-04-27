import React from 'react';
import { useUIStore } from '../../store/ui.store';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    sidebarOpen,
    terminalOpen,
    toggleSidebar,
    toggleTerminal,
    showBookmarksBar,
    setShowBookmarksBar,
    focusBlocklist,
    setFocusBlocklist,
    breakGlass,
    focusTimer
  } = useUIStore();
  const { setShowCapsuleManager } = useUIStore();

  const [blocklistText, setBlocklistText] = React.useState((focusBlocklist || []).join('\n'));
  const [focusDurationMin, setFocusDurationMin] = React.useState(() =>
    focusTimer?.durationSec ? Math.round(focusTimer.durationSec / 60) : 25
  );
  const [breakMinutes, setBreakMinutes] = React.useState(breakGlass.allowMinutes);
  const [cooldownMinutes, setCooldownMinutes] = React.useState(breakGlass.cooldownMinutes);

  // Persist settings back into store (best-effort; keep UX simple).
  React.useEffect(() => {
    // store currently owns these values; we keep inputs as draft and write on blur/save later
    // (blocklist has explicit Save button)
    useUIStore.setState((s) => ({
      breakGlass: {
        ...s.breakGlass,
        allowMinutes: Math.max(1, breakMinutes),
        cooldownMinutes: Math.max(1, cooldownMinutes)
      },
      focusTimer: {
        ...s.focusTimer,
        durationSec: Math.max(60, Math.round(Math.max(1, focusDurationMin) * 60))
      }
    }));
  }, [breakMinutes, cooldownMinutes, focusDurationMin]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-primary border border-border rounded-lg w-[500px] max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Appearance */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Appearance</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Show AI Sidebar</span>
                <button
                  onClick={toggleSidebar}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    sidebarOpen ? 'bg-accent' : 'bg-bg-secondary'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      sidebarOpen ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Show Terminal</span>
                <button
                  onClick={toggleTerminal}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    terminalOpen ? 'bg-accent' : 'bg-bg-secondary'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      terminalOpen ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Show Bookmarks Bar</span>
                <button
                  onClick={() => setShowBookmarksBar(!showBookmarksBar)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    showBookmarksBar ? 'bg-accent' : 'bg-bg-secondary'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      showBookmarksBar ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>
          </section>

          {/* Focus Mode */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Focus Mode</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-text-muted mb-1">Blocklist (one domain per line)</div>
                <textarea
                  value={blocklistText}
                  onChange={(e) => setBlocklistText(e.target.value)}
                  className="w-full h-28 px-3 py-2 rounded-md bg-bg-secondary border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                  placeholder="youtube.com\nreddit.com\n..."
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusBlocklist(blocklistText.split('\n'))}
                    className="px-3 h-9 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-sm border border-border"
                  >
                    Save Blocklist
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="text-sm text-text-secondary">
                  <div className="text-xs text-text-muted mb-1">Default timer (min)</div>
                  <input
                    type="number"
                    value={focusDurationMin}
                    onChange={(e) => setFocusDurationMin(parseInt(e.target.value || '25', 10))}
                    className="w-full h-9 px-3 rounded-md bg-bg-secondary border border-border text-text-primary text-sm"
                    min={1}
                    max={240}
                  />
                </label>
                <label className="text-sm text-text-secondary">
                  <div className="text-xs text-text-muted mb-1">Break Glass (min)</div>
                  <input
                    type="number"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value || '5', 10))}
                    className="w-full h-9 px-3 rounded-md bg-bg-secondary border border-border text-text-primary text-sm"
                    min={1}
                    max={60}
                  />
                </label>
                <label className="text-sm text-text-secondary">
                  <div className="text-xs text-text-muted mb-1">Cooldown (min)</div>
                  <input
                    type="number"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(parseInt(e.target.value || '10', 10))}
                    className="w-full h-9 px-3 rounded-md bg-bg-secondary border border-border text-text-primary text-sm"
                    min={1}
                    max={240}
                  />
                </label>
              </div>
              <div className="text-xs text-text-muted">
                Note: timer/break-glass settings apply to new Focus sessions.
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>New Tab</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+T</kbd>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Close Tab</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+W</kbd>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Find in Page</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+F</kbd>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Toggle Terminal</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+`</kbd>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Toggle AI Panel</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+Shift+A</kbd>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Reload Page</span>
                <kbd className="px-2 py-0.5 bg-bg-secondary rounded text-xs">Cmd+R</kbd>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">About</h3>
            <div className="text-sm text-text-muted">
              <p>LAIN Browser v0.1.0</p>
              <p className="mt-1">Desktop browser with integrated terminal and local AI</p>
            </div>
          </section>

          {/* Capsules */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Capsules</h3>
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-secondary">Save and restore workspace layouts</div>
              <button
                type="button"
                onClick={() => setShowCapsuleManager(true)}
                className="px-3 h-9 rounded-md bg-bg-panel hover:bg-bg-primary text-text-primary text-sm border border-border"
              >
                Manage Capsules…
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
