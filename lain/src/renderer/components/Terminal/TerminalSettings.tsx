import React, { useState } from 'react';

interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme: 'dark' | 'light' | 'custom';
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  customColors?: {
    background: string;
    foreground: string;
    cursor: string;
  };
}

interface TerminalSettingsProps {
  onClose: () => void;
  onSave: (settings: TerminalSettings) => void;
  currentSettings: TerminalSettings;
}

export function TerminalSettings({ onClose, onSave, currentSettings }: TerminalSettingsProps) {
  const [settings, setSettings] = useState<TerminalSettings>(currentSettings);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const presetThemes = {
    dark: {
      background: '#0f0f0f',
      foreground: '#d4d4d4',
      cursor: '#8b5cf6'
    },
    light: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#8b5cf6'
    },
    dracula: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#ff79c6'
    },
    monokai: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f92672'
    },
    solarized: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#268bd2'
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text-primary">Terminal Settings</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Settings */}
        <div className="p-6 space-y-6">
          {/* Font Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-4">Font</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Font Size</label>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                  className="w-full"
                />
                <span className="text-sm text-text-muted">{settings.fontSize}px</span>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-panel border border-border rounded text-text-primary"
                >
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  <option value="'Fira Code', monospace">Fira Code</option>
                  <option value="'Source Code Pro', monospace">Source Code Pro</option>
                  <option value="'Monaco', monospace">Monaco</option>
                  <option value="'Courier New', monospace">Courier New</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cursor Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-4">Cursor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">Cursor Style</label>
                <div className="flex gap-2">
                  {(['block', 'underline', 'bar'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setSettings({ ...settings, cursorStyle: style })}
                      className={`
                        px-4 py-2 rounded border capitalize
                        ${settings.cursorStyle === style
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-panel text-text-secondary border-border hover:border-accent'
                        }
                      `}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cursor-blink"
                  checked={settings.cursorBlink}
                  onChange={(e) => setSettings({ ...settings, cursorBlink: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="cursor-blink" className="text-sm text-text-secondary">
                  Cursor Blink
                </label>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-4">Theme</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(presetThemes).map(([name, colors]) => (
                <button
                  key={name}
                  onClick={() => setSettings({
                    ...settings,
                    theme: 'custom',
                    customColors: colors
                  })}
                  className="p-4 rounded border border-border hover:border-accent transition-colors text-left"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground
                  }}
                >
                  <div className="font-medium capitalize mb-1">{name}</div>
                  <div className="text-xs opacity-70">Click to apply</div>
                </button>
              ))}
            </div>
          </div>

          {/* Performance */}
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-4">Performance</h3>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Scrollback Lines (history)
              </label>
              <input
                type="number"
                value={settings.scrollback}
                onChange={(e) => setSettings({ ...settings, scrollback: parseInt(e.target.value) })}
                min="100"
                max="10000"
                step="100"
                className="w-full px-3 py-2 bg-bg-panel border border-border rounded text-text-primary"
              />
              <p className="text-xs text-text-muted mt-1">
                Higher values use more memory
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
