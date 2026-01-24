import { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

export function OllamaSetup() {
  const [aiStatus, setAiStatus] = useState<'checking' | 'ready' | 'not-installed' | 'error'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try {
      const installed = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
      );

      if (installed) {
        setAiStatus('ready');
      } else {
        setAiStatus('not-installed');
      }
    } catch (err: any) {
      console.error('Error checking AI:', err);
      setError(err.message);
      setAiStatus('error');
    }
  };

  const skipAndContinue = () => {
    // Just close onboarding and use app without AI
    window.electron.ipcRenderer.send(IPC_CHANNELS.ONBOARDING_SKIP);
  };

  const completeSetup = () => {
    window.electron.ipcRenderer.send(IPC_CHANNELS.ONBOARDING_COMPLETE);
  };

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary px-4 py-10">
      <div className="max-w-2xl w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-7xl font-bold text-accent mb-6">LAIN</div>
          <h1 className="text-4xl font-bold text-text-primary mb-3">
            Desktop Browser with Terminal & AI
          </h1>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            A powerful desktop environment combining web browsing, terminal access, and local AI assistance.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-6 bg-bg-secondary border border-border rounded-lg">
            <div className="text-3xl mb-3">🌐</div>
            <h3 className="font-semibold text-text-primary mb-2">Web Browser</h3>
            <p className="text-sm text-text-secondary">
              Built-in Chromium-based browser with tab management
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-border rounded-lg">
            <div className="text-3xl mb-3">💻</div>
            <h3 className="font-semibold text-text-primary mb-2">Terminal</h3>
            <p className="text-sm text-text-secondary">
              Integrated terminal with full shell access
            </p>
          </div>

          <div className="p-6 bg-bg-secondary border border-accent rounded-lg">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold text-text-primary mb-2">Local AI</h3>
            <p className="text-sm text-text-secondary">
              AI assistant (currently in development)
            </p>
          </div>
        </div>

        {/* AI Status */}
        {aiStatus === 'checking' && (
          <div className="mb-8 p-6 bg-bg-secondary border border-border rounded-lg text-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-text-secondary">Checking AI status...</p>
          </div>
        )}

        {aiStatus === 'ready' && (
          <div className="mb-8 p-6 bg-green-500/10 border border-green-500 rounded-lg text-center">
            <div className="text-4xl mb-2">✓</div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">AI Ready!</h3>
            <p className="text-sm text-text-secondary">
              Local AI model is installed and ready to use.
            </p>
          </div>
        )}

        {(aiStatus === 'not-installed' || aiStatus === 'error') && (
          <div className="mb-8 p-6 bg-bg-secondary border border-border rounded-lg">
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              ℹ️ About Local AI (Optional)
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              LAIN can run AI models locally on your machine for chat assistance, page summarization, 
              and terminal help. This feature is currently in development and completely optional.
            </p>
            
            {error && (
              <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500 rounded text-sm text-yellow-400">
                <strong>Note:</strong> AI features are not available yet. The app works great without them!
              </div>
            )}

            <div className="p-4 bg-bg-panel rounded-lg border border-border">
              <h4 className="font-medium text-text-primary mb-2">Coming Soon:</h4>
              <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
                <li>Embedded AI models (~500MB download)</li>
                <li>No internet required after initial setup</li>
                <li>Complete privacy - data never leaves your device</li>
                <li>Chat assistance and page summarization</li>
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={aiStatus === 'ready' ? completeSetup : skipAndContinue}
            className="px-12 py-4 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold text-lg transition-colors shadow-lg"
          >
            {aiStatus === 'ready' ? 'Start Using LAIN →' : 'Get Started →'}
          </button>

          {aiStatus === 'ready' && (
            <p className="text-sm text-text-muted">
              AI features are enabled and ready
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Free • Open Source • Privacy-Focused</span>
          </div>
        </div>
      </div>
    </div>
  );
}
