import React, { useState } from 'react';
import { useAIStore } from '../../store/ai.store';
import { ModelManager } from './ModelManager';

interface ChatSettingsProps {
  onClose: () => void;
}

export function ChatSettings({ onClose }: ChatSettingsProps) {
  const { settings, updateSettings } = useAIStore();
  const [showModelManager, setShowModelManager] = useState(false);

  if (showModelManager) {
    return <ModelManager onClose={() => setShowModelManager(false)} />;
  }

  return (
    <div className="absolute inset-0 bg-bg-secondary z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Chat Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
        >
          ×
        </button>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* User Name */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={settings.userName}
            onChange={(e) => updateSettings({ userName: e.target.value })}
            placeholder="Enter your name..."
            className="w-full px-3 py-2 bg-bg-panel border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:border-accent"
          />
          <p className="text-xs text-text-muted mt-1">
            The AI will address you by name when appropriate.
          </p>
        </div>

        {/* Response Style */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Response Length
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['concise', 'balanced', 'detailed'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => updateSettings({ responseStyle: style })}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  settings.responseStyle === style
                    ? 'bg-accent border-accent text-white'
                    : 'bg-bg-panel border-border text-text-primary hover:bg-bg-primary'
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">
            {settings.responseStyle === 'concise' && 'Short 1-3 sentence responses.'}
            {settings.responseStyle === 'balanced' && 'Moderate length responses.'}
            {settings.responseStyle === 'detailed' && 'Thorough responses with examples.'}
          </p>
        </div>

        {/* Personality */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            AI Personality
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'helpful', label: 'Helpful', desc: 'Straightforward assistance' },
              { id: 'friendly', label: 'Friendly', desc: 'Warm and casual' },
              { id: 'professional', label: 'Professional', desc: 'Formal and precise' },
              { id: 'creative', label: 'Creative', desc: 'Imaginative responses' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateSettings({ personality: p.id })}
                className={`px-3 py-3 text-left rounded-lg border transition-colors ${
                  settings.personality === p.id
                    ? 'bg-accent/20 border-accent text-text-primary'
                    : 'bg-bg-panel border-border text-text-primary hover:bg-bg-primary'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-text-muted">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom System Prompt */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Custom Instructions
          </label>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
            placeholder="Add any custom instructions for the AI... (e.g., 'Always respond in bullet points' or 'You are an expert in Python')"
            className="w-full px-3 py-2 bg-bg-panel border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:border-accent resize-none"
            rows={4}
          />
          <p className="text-xs text-text-muted mt-1">
            These instructions are added to every conversation.
          </p>
        </div>

        {/* Model Manager */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            AI Models
          </label>
          <button
            type="button"
            onClick={() => setShowModelManager(true)}
            className="w-full p-4 bg-bg-panel border border-border rounded-lg text-left hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text-primary">Manage Models</div>
                <div className="text-xs text-text-muted mt-1">
                  Install, remove, or set default AI models
                </div>
              </div>
              <span className="text-text-muted">→</span>
            </div>
          </button>
        </div>

        {/* Preview */}
        <div className="p-3 bg-bg-panel rounded-lg border border-border">
          <div className="text-xs font-medium text-text-muted mb-2">System prompt preview:</div>
          <div className="text-xs text-text-secondary italic">
            {useAIStore.getState().getSystemMessage() || 'No custom settings applied.'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
