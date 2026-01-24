import React, { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../store/ai.store';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useUIStore } from '../../store/ui.store';

export function ChatPanel() {
  const { messages, isLoading, addMessage, setLoading } = useAIStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setShowOnboarding, toggleSidebar } = useUIStore();

  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(''); // set after fetch
  const [statusText, setStatusText] = useState<string>('Checking…');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function refreshAIStatus() {
      try {
        setStatusText('Checking…');
        const installed = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
        );
        if (cancelled) return;
        setOllamaInstalled(!!installed);

        const list: string[] = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_LIST_MODELS
        );
        if (cancelled) return;
        setModels(Array.isArray(list) ? list : []);

        if (!installed) {
          setStatusText('Not installed');
          setSelectedModel('');
          return;
        }

        if (!list || list.length === 0) {
          setStatusText('No models');
          setSelectedModel('');
          return;
        }

        setStatusText('Ready');
        setSelectedModel((prev) => prev || list[0]);
      } catch (e) {
        if (!cancelled) {
          setOllamaInstalled(false);
          setModels([]);
          setSelectedModel('');
          setStatusText('Offline');
        }
      }
    }

    refreshAIStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const openAISetup = () => {
    setShowOnboarding(true);
  };

  const startOllamaServer = async () => {
    try {
      setStatusText('Starting…');
      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_START_SERVER);
      const list: string[] = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.OLLAMA_LIST_MODELS
      );
      setModels(Array.isArray(list) ? list : []);
      if (list?.length) {
        setSelectedModel(list[0]);
        setStatusText('Ready');
      } else {
        setStatusText('No models');
      }
    } catch (e) {
      setStatusText('Offline');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!ollamaInstalled) {
      addMessage({
        role: 'assistant',
        content: 'Local AI is not set up yet. Click “Set up AI” to install Ollama and download a model.'
      });
      openAISetup();
      return;
    }
    if (!selectedModel) {
      addMessage({
        role: 'assistant',
        content: 'No model is installed yet. Click “Download models” to install a lightweight offline model.'
      });
      openAISetup();
      return;
    }

    const userMessage = {
      role: 'user' as const,
      content: input.trim()
    };

    addMessage(userMessage);
    setInput('');
    setLoading(true);

    try {
      const response = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AI_CHAT,
        [...messages, userMessage],
        selectedModel
      );

      if (response.message) {
        addMessage({
          role: 'assistant',
          content: response.message.content
        });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      addMessage({
        role: 'assistant',
        content:
          'Sorry, I couldn’t reach Ollama. If you just installed it, click “Start AI Engine”, or re-run setup.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">AI Assistant</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              statusText === 'Ready' ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            title={statusText}
          />
          <span className="text-xs text-text-muted">{selectedModel || statusText}</span>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-2 w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
            title="Close AI panel"
          >
            ×
          </button>
        </div>
      </div>

      {/* Setup banner */}
      {(ollamaInstalled === false || statusText !== 'Ready') && (
        <div className="px-4 py-3 border-b border-border bg-bg-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-text-primary font-medium">
                {ollamaInstalled === false
                  ? 'Set up local AI'
                  : statusText === 'No models'
                  ? 'Download an offline model'
                  : 'Start AI engine'}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {ollamaInstalled === false
                  ? 'Install Ollama and pick a small model (Qwen 0.5B recommended).'
                  : statusText === 'No models'
                  ? 'No models found. Use the setup wizard to download one.'
                  : 'Ollama looks offline. Start it, then pick a model.'}
              </div>
            </div>
            <div className="flex gap-2">
              {ollamaInstalled !== false && statusText !== 'Ready' && (
                <button
                  onClick={startOllamaServer}
                  className="px-3 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-primary"
                >
                  Start AI Engine
                </button>
              )}
              <button
                onClick={openAISetup}
                className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover rounded text-white"
              >
                {ollamaInstalled === false ? 'Set up AI' : 'Download models'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model picker (when ready) */}
      {statusText === 'Ready' && models.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-bg-panel">
          <label className="text-xs text-text-muted mr-2">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-xs bg-bg-secondary border border-border rounded px-2 py-1 text-text-primary"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-text-muted mt-8">
            <p className="text-lg mb-2">👋 Hi! I'm your local AI assistant</p>
            <p className="text-sm">
              {statusText === 'Ready'
                ? 'Ask me anything about the current page or for help with tasks.'
                : 'Set up Ollama + a model to start chatting offline.'}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-bg-panel text-text-primary'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-bg-panel rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={statusText === 'Ready' ? 'Ask me anything…' : 'Set up AI to chat…'}
            className="flex-1 px-4 py-2 bg-bg-panel border border-border rounded-lg text-sm text-text-primary resize-none focus:border-accent"
            rows={2}
            disabled={isLoading || statusText !== 'Ready'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || statusText !== 'Ready'}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
