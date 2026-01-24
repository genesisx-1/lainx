import React from 'react';
import { useUIStore } from '../../store/ui.store';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { sidebarOpen, terminalOpen, toggleSidebar, toggleTerminal } = useUIStore();

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
        </div>
      </div>
    </div>
  );
}
