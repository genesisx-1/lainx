import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

interface ModelManagerProps {
  onClose: () => void;
}

export function ModelManager({ onClose }: ModelManagerProps) {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [customModelTag, setCustomModelTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullStatus, setPullStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState<string>('');

  // Load installed models on mount
  useEffect(() => {
    refreshModels();
    
    // Load default model from localStorage
    const saved = localStorage.getItem('lain-default-model');
    if (saved) setDefaultModel(saved);
  }, []);

  const refreshModels = async () => {
    setIsLoading(true);
    try {
      const models = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_LIST_MODELS);
      setInstalledModels(Array.isArray(models) ? models : []);
      setError(null);
    } catch (e: any) {
      setError('Failed to fetch models. Is Ollama running?');
    } finally {
      setIsLoading(false);
    }
  };

  const pullModel = async () => {
    if (!customModelTag.trim() || isPulling) return;
    
    setIsPulling(true);
    setPullProgress(0);
    setPullStatus(`Pulling ${customModelTag}...`);
    setError(null);

    try {
      await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.OLLAMA_DOWNLOAD_MODEL,
        customModelTag.trim()
      );
      setPullStatus('Download complete!');
      setPullProgress(100);
      setCustomModelTag('');
      await refreshModels();
    } catch (e: any) {
      setError(e?.message || 'Failed to pull model');
      setPullStatus('');
    } finally {
      setIsPulling(false);
    }
  };

  const deleteModel = async (modelName: string) => {
    if (!confirm(`Delete ${modelName}? This cannot be undone.`)) return;
    
    try {
      // Use ollama CLI to remove model
      await window.electron.ipcRenderer.invoke('terminal:execute', `ollama rm ${modelName}`);
      await refreshModels();
    } catch (e) {
      setError('Failed to delete model. Try running "ollama rm <model>" in terminal.');
    }
  };

  const setAsDefault = (modelName: string) => {
    setDefaultModel(modelName);
    localStorage.setItem('lain-default-model', modelName);
  };

  const popularModels = [
    { tag: 'llama3.2', desc: 'Fast general model (2GB)' },
    { tag: 'qwen2.5:0.5b', desc: 'Tiny & fast (400MB)' },
    { tag: 'qwen2.5:7b', desc: 'Stronger reasoning (4GB)' },
    { tag: 'codellama', desc: 'Code specialist (4GB)' },
    { tag: 'deepseek-coder', desc: 'Code focused (1GB)' },
    { tag: 'mistral', desc: 'Balanced quality (4GB)' },
  ];

  return (
    <div className="absolute inset-0 bg-bg-secondary z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Model Manager</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Installed Models */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              Installed Models
            </label>
            <button
              type="button"
              onClick={refreshModels}
              disabled={isLoading}
              className="text-xs text-accent hover:underline"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {installedModels.length === 0 ? (
            <div className="p-4 bg-bg-panel rounded-lg text-center text-text-muted text-sm">
              No models installed. Pull one below!
            </div>
          ) : (
            <div className="space-y-2">
              {installedModels.map((model) => (
                <div
                  key={model}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    defaultModel === model
                      ? 'bg-accent/10 border-accent/40'
                      : 'bg-bg-panel border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary font-medium">{model}</span>
                    {defaultModel === model && (
                      <span className="text-[10px] px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {defaultModel !== model && (
                      <button
                        type="button"
                        onClick={() => setAsDefault(model)}
                        className="text-xs text-text-muted hover:text-accent"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteModel(model)}
                      className="text-xs text-text-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pull Custom Model */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Pull Custom Model
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customModelTag}
              onChange={(e) => setCustomModelTag(e.target.value)}
              placeholder="e.g., llama3.2:latest or phi3:mini"
              className="flex-1 px-3 py-2 bg-bg-panel border border-border rounded-lg text-sm text-text-primary placeholder-text-muted"
              disabled={isPulling}
            />
            <button
              type="button"
              onClick={pullModel}
              disabled={!customModelTag.trim() || isPulling}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isPulling ? 'Pulling...' : 'Pull'}
            </button>
          </div>
          
          {/* Pull progress */}
          {isPulling && (
            <div className="mt-3">
              <div className="h-2 bg-bg-panel rounded-full overflow-hidden">
                <div
                  className="h-2 bg-accent transition-all"
                  style={{ width: `${pullProgress}%` }}
                />
              </div>
              <div className="text-xs text-text-muted mt-1">{pullStatus}</div>
            </div>
          )}

          <p className="text-xs text-text-muted mt-2">
            Find models at{' '}
            <span className="text-accent">ollama.com/library</span>
          </p>
        </div>

        {/* Quick Install */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Popular Models
          </label>
          <div className="grid grid-cols-2 gap-2">
            {popularModels.map((m) => {
              const isInstalled = installedModels.some(
                (i) => i.startsWith(m.tag.split(':')[0])
              );
              return (
                <button
                  key={m.tag}
                  type="button"
                  onClick={() => {
                    if (!isInstalled) {
                      setCustomModelTag(m.tag);
                    }
                  }}
                  disabled={isPulling || isInstalled}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    isInstalled
                      ? 'bg-green-500/10 border-green-500/30 cursor-default'
                      : 'bg-bg-panel border-border hover:border-accent/50'
                  }`}
                >
                  <div className="text-sm font-medium text-text-primary flex items-center gap-1">
                    {m.tag}
                    {isInstalled && <span className="text-green-400 text-xs">✓</span>}
                  </div>
                  <div className="text-xs text-text-muted">{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Terminal tip */}
        <div className="p-3 bg-bg-panel rounded-lg border border-border">
          <div className="text-xs font-medium text-text-muted mb-1">Power User Tip</div>
          <div className="text-xs text-text-secondary">
            You can also manage models from the terminal:
            <code className="block mt-1 p-2 bg-bg-secondary rounded text-accent">
              ollama pull llama3.2<br />
              ollama list<br />
              ollama rm modelname
            </code>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
