// src/renderer/components/Onboarding/OllamaSetup.tsx
import React, { useState, useEffect } from 'react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
}

export function OllamaSetup() {
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'check',
      title: 'Checking for Ollama',
      description: 'Looking for existing installation...',
      status: 'in-progress'
    },
    {
      id: 'install',
      title: 'Install Ollama',
      description: 'Download and install local AI engine',
      status: 'pending'
    },
    {
      id: 'models',
      title: 'Download AI Models',
      description: 'Choose models to install',
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
  const [currentModel, setCurrentModel] = useState('');
  const [isInstalled, setIsInstalled] = useState(false);
  const [availableModels, setAvailableModels] = useState([
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
    {
      name: 'llama3.2:70b',
      size: '40GB',
      description: 'Most powerful, requires significant resources',
      recommended: false
    }
  ]);
  const [selectedModels, setSelectedModels] = useState<string[]>(['llama3.2']);

  useEffect(() => {
    checkOllamaInstallation();
  }, []);

  const checkOllamaInstallation = async () => {
    const installed = await window.electron.ipcRenderer.invoke(
      'ollama:check-installation'
    );

    if (installed) {
      updateStep('check', 'complete');
      updateStep('install', 'complete');
      setIsInstalled(true);
      
      // Check which models are already installed
      const models = await window.electron.ipcRenderer.invoke('ollama:list-models');
      if (models.length > 0) {
        updateStep('models', 'complete');
        updateStep('ready', 'complete');
      } else {
        updateStep('models', 'in-progress');
      }
    } else {
      updateStep('check', 'complete');
      updateStep('install', 'in-progress');
    }
  };

  const updateStep = (id: string, status: SetupStep['status']) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status } : step))
    );
  };

  const installOllama = async () => {
    try {
      updateStep('install', 'in-progress');

      await window.electron.ipcRenderer.invoke(
        'ollama:install',
        (progress: number, status: string) => {
          setDownloadProgress(progress);
          // Update UI with status
        }
      );

      updateStep('install', 'complete');
      updateStep('models', 'in-progress');
      setIsInstalled(true);

      // Auto-start downloading recommended models
      await downloadSelectedModels();
    } catch (error) {
      updateStep('install', 'error');
      console.error('Ollama installation failed:', error);
    }
  };

  const downloadSelectedModels = async () => {
    updateStep('models', 'in-progress');

    for (const modelName of selectedModels) {
      setCurrentModel(modelName);
      setDownloadProgress(0);

      await window.electron.ipcRenderer.invoke(
        'ollama:download-model',
        modelName,
        (progress: number) => {
          setDownloadProgress(progress);
        }
      );
    }

    updateStep('models', 'complete');
    updateStep('ready', 'complete');
  };

  const toggleModel = (modelName: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelName)
        ? prev.filter((m) => m !== modelName)
        : [...prev, modelName]
    );
  };

  const skipSetup = () => {
    // Allow user to continue without AI
    window.electron.ipcRenderer.send('onboarding:skip');
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        {/* Header */}
        <div className="onboarding-header">
          <div className="lain-logo">LAIN</div>
          <h1>Set Up Local AI</h1>
          <p className="subtitle">
            LAIN runs AI models locally on your machine. No data leaves your computer.
          </p>
        </div>

        {/* Setup Steps */}
        <div className="setup-steps">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`setup-step step-${step.status}`}
            >
              <div className="step-indicator">
                {step.status === 'complete' && <CheckIcon />}
                {step.status === 'in-progress' && <LoadingSpinner />}
                {step.status === 'error' && <ErrorIcon />}
                {step.status === 'pending' && <div className="step-number">{index + 1}</div>}
              </div>
              
              <div className="step-content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>

                {/* Installation UI */}
                {step.id === 'install' && step.status === 'in-progress' && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <p className="progress-text">{Math.round(downloadProgress)}%</p>
                  </div>
                )}

                {step.id === 'install' &&
                  step.status === 'in-progress' &&
                  !isInstalled && (
                    <button onClick={installOllama} className="btn-primary">
                      Install Ollama
                    </button>
                  )}

                {/* Model Selection */}
                {step.id === 'models' && step.status === 'in-progress' && (
                  <div className="model-selection">
                    <h4>Choose AI Models</h4>
                    <div className="model-list">
                      {availableModels.map((model) => (
                        <label key={model.name} className="model-option">
                          <input
                            type="checkbox"
                            checked={selectedModels.includes(model.name)}
                            onChange={() => toggleModel(model.name)}
                          />
                          <div className="model-info">
                            <div className="model-header">
                              <span className="model-name">{model.name}</span>
                              {model.recommended && (
                                <span className="recommended-badge">Recommended</span>
                              )}
                              <span className="model-size">{model.size}</span>
                            </div>
                            <p className="model-description">{model.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {currentModel && (
                      <div className="download-status">
                        <p>Downloading {currentModel}...</p>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                        <p className="progress-text">{Math.round(downloadProgress)}%</p>
                      </div>
                    )}

                    <button
                      onClick={downloadSelectedModels}
                      className="btn-primary"
                      disabled={selectedModels.length === 0}
                    >
                      Download {selectedModels.length} Model{selectedModels.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                )}

                {/* Ready State */}
                {step.id === 'ready' && step.status === 'complete' && (
                  <div className="ready-actions">
                    <button
                      onClick={() => window.electron.ipcRenderer.send('onboarding:complete')}
                      className="btn-primary btn-large"
                    >
                      Start Using LAIN
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          <button onClick={skipSetup} className="btn-text">
            Skip AI Setup (use without local AI)
          </button>

          <div className="privacy-note">
            <LockIcon />
            <span>All AI processing happens locally. Your data never leaves your computer.</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .onboarding-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-primary);
          padding: 2rem;
        }

        .onboarding-content {
          max-width: 600px;
          width: 100%;
        }

        .onboarding-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .lain-logo {
          font-size: 3rem;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 1rem;
          letter-spacing: 0.1em;
        }

        h1 {
          font-size: 2rem;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1rem;
        }

        .setup-steps {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .setup-step {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .step-in-progress {
          border-color: var(--accent);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
        }

        .step-indicator {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--bg-panel);
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .step-complete .step-indicator {
          background: var(--accent);
          color: white;
        }

        .step-content {
          flex: 1;
        }

        .step-content h3 {
          font-size: 1.125rem;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .step-content p {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .progress-section,
        .download-status {
          margin-top: 1rem;
        }

        .progress-bar {
          height: 8px;
          background: var(--bg-panel);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .model-selection {
          margin-top: 1rem;
        }

        .model-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin: 1rem 0;
        }

        .model-option {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .model-option:hover {
          border-color: var(--accent);
        }

        .model-info {
          flex: 1;
        }

        .model-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .model-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .recommended-badge {
          padding: 0.125rem 0.5rem;
          background: var(--accent);
          color: white;
          font-size: 0.75rem;
          border-radius: 12px;
        }

        .model-size {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .btn-primary {
          padding: 0.75rem 1.5rem;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 1rem;
        }

        .btn-primary:hover {
          background: var(--accent-hover);
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-large {
          padding: 1rem 2rem;
          font-size: 1.125rem;
        }

        .onboarding-footer {
          text-align: center;
          margin-top: 2rem;
        }

        .btn-text {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          text-decoration: underline;
          margin-bottom: 1rem;
        }

        .privacy-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: var(--text-muted);
          font-size: 0.875rem;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}

// Icons (you can replace with your icon library)
function CheckIcon() {
  return <span>✓</span>;
}

function LoadingSpinner() {
  return <span className="spinner">⟳</span>;
}

function ErrorIcon() {
  return <span>✗</span>;
}

function LockIcon() {
  return <span>🔒</span>;
}
