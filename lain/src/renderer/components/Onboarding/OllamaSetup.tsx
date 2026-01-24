import React, { useEffect, useMemo, useState } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

interface SetupStep {
  id: 'check' | 'install' | 'models' | 'ready';
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
}

export function OllamaSetup() {
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'check',
      title: 'Checking for Ollama',
      description: 'Looking for an existing installation…',
      status: 'in-progress'
    },
    {
      id: 'install',
      title: 'Install Ollama',
      description: 'One-click download + install the local AI engine',
      status: 'pending'
    },
    {
      id: 'models',
      title: 'Download AI Models',
      description: 'Choose models to install (llama3.2, codellama, …)',
      status: 'pending'
    },
    {
      id: 'ready',
      title: 'Ready to Go',
      description: 'LAIN is ready to assist',
      status: 'pending'
    }
  ]);

  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [currentModel, setCurrentModel] = useState('');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const availableModels = useMemo(
    () => [
      {
        name: 'llama3.2',
        size: '2GB',
        description: 'Fast, efficient model for everyday tasks',
        recommended: true
      },
      {
        name: 'codellama',
        size: '3.8GB',
        description: 'Specialized for code generation and analysis',
        recommended: true
      },
      // Alibaba Qwen (Qwen2.5)
      {
        name: 'qwen2.5:0.5b',
        size: 'Small',
        description: 'Qwen2.5 0.5B (Alibaba) – lightweight, fast, good general chat',
        recommended: true
      },
      {
        name: 'qwen2.5:7b',
        size: 'Medium',
        description: 'Qwen2.5 7B (Alibaba) – stronger reasoning and coding than tiny models',
        recommended: false
      },
      // DeepSeek
      {
        name: 'deepseek-r1:1.5b',
        size: 'Small',
        description: 'DeepSeek R1 1.5B – lightweight reasoning model',
        recommended: false
      },
      {
        name: 'deepseek-r1:8b',
        size: 'Medium',
        description: 'DeepSeek R1 8B – stronger reasoning (larger download)',
        recommended: false
      },
      {
        name: 'deepseek-coder',
        size: 'Small',
        description: 'DeepSeek Coder – compact coding-focused model',
        recommended: true
      }
    ],
    []
  );

  const [selectedModels, setSelectedModels] = useState<string[]>(['llama3.2']);

  const updateStep = (id: SetupStep['id'], status: SetupStep['status']) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const refreshInstalledModels = async () => {
    try {
      const models: string[] = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_LIST_MODELS);
      setInstalledModels(Array.isArray(models) ? models : []);
      return Array.isArray(models) ? models : [];
    } catch {
      setInstalledModels([]);
      return [];
    }
  };

  const addDebugLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog((prev) => [...prev, `[${timestamp}] ${msg}`].slice(-15));
  };

  const checkOllamaInstallation = async () => {
    try {
      setError(null);
      updateStep('check', 'in-progress');
      addDebugLog('Checking if Ollama is installed...');
      const installed = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION);
      addDebugLog(`Ollama installed: ${installed}`);
      updateStep('check', 'complete');

      if (installed) {
        setIsInstalled(true);
        updateStep('install', 'complete');

        // Start server in background (Step 5 in your architecture)
        addDebugLog('Starting Ollama server...');
        await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_START_SERVER);
        addDebugLog('Ollama server started');

        addDebugLog('Fetching installed models...');
        const models = await refreshInstalledModels();
        addDebugLog(`Found ${models.length} models installed`);
        if (models.length > 0) {
          updateStep('models', 'complete');
          updateStep('ready', 'complete');
        } else {
          updateStep('models', 'in-progress');
        }
      } else {
        setIsInstalled(false);
        updateStep('install', 'in-progress');
      }
    } catch (e: any) {
      setError(e?.message || 'Unable to check Ollama installation.');
      updateStep('check', 'error');
      updateStep('install', 'in-progress');
    }
  };

  useEffect(() => {
    checkOllamaInstallation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for progress events emitted from main.
  useEffect(() => {
    const unsubInstall = window.electron.ipcRenderer.on(
      'ollama:install-progress',
      (payload: { progress: number; status: string }) => {
        addDebugLog(`[Install] ${payload.status} - ${payload.progress}%`);
        setDownloadProgress(payload.progress || 0);
        setDownloadStatus(payload.status || '');
      }
    );

    const unsubModel = window.electron.ipcRenderer.on(
      'ollama:model-progress',
      (payload: { modelName: string; progress: number }) => {
        addDebugLog(`[Model ${payload.modelName}] ${payload.progress}%`);
        if (payload?.modelName && payload.modelName === currentModel) {
          setDownloadProgress(payload.progress || 0);
        }
      }
    );

    return () => {
      unsubInstall?.();
      unsubModel?.();
    };
  }, [currentModel]);

  const installOllama = async () => {
    try {
      setError(null);
      setDownloadProgress(0);
      setDownloadStatus('Starting…');
      updateStep('install', 'in-progress');

      addDebugLog('Installing Ollama (this may take a few minutes)...');
      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_INSTALL);
      addDebugLog('Ollama installation complete');

      // Start server once installed.
      addDebugLog('Starting Ollama server...');
      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_START_SERVER);
      addDebugLog('Ollama server started');

      setIsInstalled(true);
      updateStep('install', 'complete');
      updateStep('models', 'in-progress');
    } catch (e: any) {
      setError(e?.message || 'Ollama installation failed.');
      updateStep('install', 'error');
    }
  };

  const downloadSelectedModels = async () => {
    try {
      setError(null);
      updateStep('models', 'in-progress');

      addDebugLog(`Downloading ${selectedModels.length} model(s)...`);
      for (const modelName of selectedModels) {
        setCurrentModel(modelName);
        setDownloadProgress(0);
        setDownloadStatus(`Downloading ${modelName}…`);
        addDebugLog(`Starting download: ${modelName}`);
        await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_DOWNLOAD_MODEL, modelName);
        addDebugLog(`Finished download: ${modelName}`);
      }

      setCurrentModel('');
      setDownloadStatus('');
      updateStep('models', 'complete');
      updateStep('ready', 'complete');
      addDebugLog('All models downloaded. Refreshing list...');
      await refreshInstalledModels();
      addDebugLog('Setup complete!');
    } catch (e: any) {
      setError(e?.message || 'Model download failed.');
      updateStep('models', 'error');
    }
  };

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName) ? prev.filter((m) => m !== modelName) : [...prev, modelName]
    );
  };

  const skipSetup = () => {
    window.electron.ipcRenderer.send(IPC_CHANNELS.ONBOARDING_SKIP);
  };

  const finish = () => {
    window.electron.ipcRenderer.send(IPC_CHANNELS.ONBOARDING_COMPLETE);
  };

  return (
    <div className="h-screen overflow-y-auto px-6 py-12 lain-cosmic">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-6xl font-bold text-accent mb-3 tracking-[0.18em]">LAIN</div>
          <h1 className="text-3xl font-semibold text-text-primary mb-2">Set Up Local AI</h1>
          <p className="text-sm text-text-secondary">
            One-click install of Ollama + model downloads. After setup, LAIN chats via{' '}
            <span className="text-text-primary">http://localhost:11434/api/chat</span>.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="lain-glass rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-border/40 text-text-secondary">
                  {step.status === 'complete' ? '✓' : step.status === 'error' ? '!' : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">{step.title}</div>
                  <div className="text-xs text-text-secondary mt-1">{step.description}</div>

                  {step.id === 'install' && step.status !== 'complete' && (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={installOllama}
                        className="px-4 h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
                      >
                        Install Ollama
                      </button>
                      <div className="text-xs text-text-muted">
                        {downloadStatus ? downloadStatus : 'Mac/Windows auto-download • Linux uses install script'}
                      </div>
                    </div>
                  )}

                  {step.id === 'install' && step.status === 'in-progress' && downloadProgress > 0 && (
                    <div className="mt-3">
                      <div className="h-3 rounded-full bg-bg-secondary/40 overflow-hidden border border-border/40">
                        <div 
                          className="h-3 bg-gradient-to-r from-accent to-purple-500 transition-all duration-300" 
                          style={{ width: `${downloadProgress}%` }} 
                        />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-accent">
                        {Math.round(downloadProgress)}% — {downloadStatus}
                      </div>
                    </div>
                  )}

                  {step.id === 'models' && (step.status === 'in-progress' || step.status === 'error') && (
                    <div className="mt-4">
                      <div className="text-sm text-text-primary font-medium mb-2">Choose AI Models</div>
                      <div className="space-y-2">
                        {availableModels.map((m) => (
                          <label
                            key={m.name}
                            className="flex items-start gap-3 px-3 py-2 rounded-xl border border-border/40 bg-bg-secondary/20"
                          >
                            <input
                              type="checkbox"
                              checked={selectedModels.includes(m.name)}
                              onChange={() => toggleModel(m.name)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm text-text-primary font-medium">{m.name}</div>
                                {m.recommended && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                                    Recommended
                                  </span>
                                )}
                                <div className="text-xs text-text-muted">{m.size}</div>
                              </div>
                              <div className="text-xs text-text-secondary mt-1">{m.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {currentModel && (
                        <div className="mt-4 p-3 rounded-xl border border-accent/40 bg-accent/5">
                          <div className="text-sm font-medium text-text-primary mb-2">
                            Downloading {currentModel}…
                          </div>
                          <div className="h-3 rounded-full bg-bg-secondary/40 overflow-hidden border border-border/40">
                            <div 
                              className="h-3 bg-gradient-to-r from-accent to-purple-500 transition-all duration-300" 
                              style={{ width: `${downloadProgress}%` }} 
                            />
                          </div>
                          <div className="mt-2 text-sm font-semibold text-accent">
                            {Math.round(downloadProgress)}%
                            {downloadStatus && ` — ${downloadStatus}`}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={downloadSelectedModels}
                          disabled={selectedModels.length === 0}
                          className="px-4 h-10 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Download {selectedModels.length} Model{selectedModels.length === 1 ? '' : 's'}
                        </button>
                        {installedModels.length > 0 && (
                          <div className="text-xs text-text-muted">
                            Installed: {installedModels.slice(0, 3).join(', ')}
                            {installedModels.length > 3 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {step.id === 'ready' && step.status === 'complete' && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={finish}
                        className="px-5 h-11 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
                      >
                        Start Using LAIN
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between text-xs text-text-muted">
          <button type="button" onClick={skipSetup} className="hover:text-text-primary transition-colors">
            Skip AI Setup (use without local AI)
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500/70" />
            <span>All processing is local. Your data never leaves your device.</span>
          </div>
        </div>

        {/* Debug log panel so you can see what's happening */}
        {debugLog.length > 0 && (
          <div className="mt-6 lain-glass rounded-xl p-4">
            <div className="text-xs text-text-muted mb-2 font-semibold">Debug Log (last 15 events)</div>
            <div className="space-y-1 font-mono text-[11px] text-text-secondary max-h-40 overflow-y-auto">
              {debugLog.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
