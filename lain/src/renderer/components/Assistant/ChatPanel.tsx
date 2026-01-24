import React, { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../store/ai.store';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useUIStore } from '../../store/ui.store';
import { useBrowserStore } from '../../store/browser.store';
import { ChatSettings } from './ChatSettings';
import { ChatHistory } from './ChatHistory';

export function ChatPanel() {
  const { 
    messages, 
    isLoading, 
    addMessage, 
    setLoading, 
    getSystemMessage,
    saveCurrentConversation,
    settings
  } = useAIStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setShowOnboarding, toggleSidebar } = useUIStore();
  const { webviewApi, tabs, activeTabId } = useBrowserStore();

  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(''); // set after fetch
  const [statusText, setStatusText] = useState<string>('Checking…');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Check if we're on a real page (not welcome page)
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canAnalyzePage = activeTab && activeTab.url !== 'lain://welcome' && webviewApi?.getPageContent;

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
        console.log('[ChatPanel] Checking Ollama installation...');
        
        const installed = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
        );
        console.log('[ChatPanel] Ollama installed:', installed);
        
        if (cancelled) return;
        setOllamaInstalled(!!installed);

        const list: string[] = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_LIST_MODELS
        );
        console.log('[ChatPanel] Models list:', list);
        
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
        console.log('[ChatPanel] AI is ready, model:', list[0]);
      } catch (e) {
        console.error('[ChatPanel] Error during AI status check:', e);
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

  const refreshStatus = async () => {
    try {
      setStatusText('Refreshing…');
      const installed = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
      );
      setOllamaInstalled(!!installed);

      if (installed) {
        await startOllamaServer();
      } else {
        setStatusText('Not installed');
      }
    } catch (e) {
      console.error('[ChatPanel] Refresh error:', e);
      setStatusText('Error');
    }
  };

  const summarizePage = async () => {
    if (!canAnalyzePage || isLoading || !selectedModel) return;
    
    setLoading(true);
    addMessage({
      role: 'user',
      content: `📄 Summarize this page: ${activeTab?.title || activeTab?.url}`
    });

    try {
      const pageContent = await webviewApi!.getPageContent();
      console.log('[ChatPanel] Got page content:', pageContent.url, 'text length:', pageContent.text.length);

      if (!pageContent.text) {
        addMessage({
          role: 'assistant',
          content: 'I couldn\'t read the page content. The page might still be loading or be protected.'
        });
        setLoading(false);
        return;
      }

      // Send to AI for summarization
      const response = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AI_CHAT,
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes web pages concisely. Give a clear, structured summary with key points.'
          },
          {
            role: 'user',
            content: `Summarize this webpage (${pageContent.url}):\n\nTitle: ${pageContent.title}\n\nContent:\n${pageContent.text.slice(0, 6000)}`
          }
        ],
        selectedModel
      );

      if (response?.message?.content) {
        addMessage({
          role: 'assistant',
          content: response.message.content
        });
      } else {
        addMessage({
          role: 'assistant',
          content: 'I couldn\'t generate a summary. Please try again.'
        });
      }
    } catch (error) {
      console.error('[ChatPanel] Summarize error:', error);
      addMessage({
        role: 'assistant',
        content: 'Failed to summarize the page. Make sure the AI is running.'
      });
    } finally {
      setLoading(false);
    }
  };

  const askAboutPage = async () => {
    if (!canAnalyzePage || !selectedModel) return;
    
    // Pre-fill the input with context about asking about the page
    setInput(`About this page (${activeTab?.title}): `);
  };

  // Browser Agent Mode - Show interactive elements and let AI control the page
  const [agentMode, setAgentMode] = useState(false);

  const scanPage = async () => {
    if (!webviewApi?.getInteractiveElements) return;
    
    addMessage({
      role: 'user',
      content: '🔍 Scanning page for interactive elements...'
    });

    try {
      const elements = await webviewApi.getInteractiveElements();
      
      // Build a description for the AI
      const elementList = elements.map((el, i) => 
        `[${i}] ${el.tag}${el.type ? ` (${el.type})` : ''}: "${el.text || el.placeholder || 'no text'}"`
      ).join('\n');

      addMessage({
        role: 'assistant',
        content: `Found ${elements.length} interactive elements:\n\n${elementList}\n\nTell me which element to click or what to type, e.g.:\n- "Click element 3"\n- "Type 'hello' in element 5"\n- "Scroll down"`
      });
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: 'Failed to scan the page for elements.'
      });
    }
  };

  const executeAgentCommand = async (command: string) => {
    if (!webviewApi) return;

    const lowerCmd = command.toLowerCase();

    // Click command
    const clickMatch = lowerCmd.match(/click\s+(?:element\s+)?(\d+)/i);
    if (clickMatch) {
      const idx = parseInt(clickMatch[1], 10);
      const success = await webviewApi.clickElement(idx);
      addMessage({
        role: 'assistant',
        content: success ? `✅ Clicked element ${idx}` : `❌ Failed to click element ${idx}`
      });
      // Re-scan after action
      setTimeout(scanPage, 1000);
      return true;
    }

    // Type command
    const typeMatch = command.match(/type\s+['"](.+)['"]\s+(?:in|into)\s+(?:element\s+)?(\d+)/i);
    if (typeMatch) {
      const text = typeMatch[1];
      const idx = parseInt(typeMatch[2], 10);
      const success = await webviewApi.typeInElement(idx, text);
      addMessage({
        role: 'assistant',
        content: success ? `✅ Typed "${text}" in element ${idx}` : `❌ Failed to type in element ${idx}`
      });
      return true;
    }

    // Scroll command
    if (lowerCmd.includes('scroll down')) {
      await webviewApi.scrollPage('down');
      addMessage({ role: 'assistant', content: '✅ Scrolled down' });
      return true;
    }
    if (lowerCmd.includes('scroll up')) {
      await webviewApi.scrollPage('up');
      addMessage({ role: 'assistant', content: '✅ Scrolled up' });
      return true;
    }

    return false;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Check for agent commands first (if agent mode is on)
    if (agentMode && canAnalyzePage) {
      const userInput = input.trim();
      addMessage({ role: 'user', content: userInput });
      setInput('');
      
      const handled = await executeAgentCommand(userInput);
      if (handled) return;
    }

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
      // Build messages array with system prompt from settings
      const systemPrompt = getSystemMessage();
      const messagesWithSystem = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...messages,
        userMessage
      ];

      const response = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AI_CHAT,
        messagesWithSystem,
        selectedModel
      );

      if (response.message) {
        addMessage({
          role: 'assistant',
          content: response.message.content
        });
        // Auto-save conversation after each exchange
        saveCurrentConversation();
      } else {
        console.error('[ChatPanel] Invalid response format:', response);
        addMessage({
          role: 'assistant',
          content: 'I received an empty response. The model may still be loading.'
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

  // Show settings or history panels
  if (showSettings) {
    return <ChatSettings onClose={() => setShowSettings(false)} />;
  }
  if (showHistory) {
    return <ChatHistory onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">
            {settings.userName ? `Hi, ${settings.userName}` : 'AI Assistant'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full mr-1 ${
              statusText === 'Ready' ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            title={statusText}
          />
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary text-xs"
            title="Chat history"
          >
            📋
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary text-xs"
            title="Settings"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary text-xs"
            title="Refresh AI status"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
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

      {/* Page analysis buttons */}
      {statusText === 'Ready' && canAnalyzePage && (
        <div className="px-4 py-2 border-t border-border bg-bg-panel space-y-2">
          <div className="flex gap-2">
            <button
              onClick={summarizePage}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-lg text-accent font-medium disabled:opacity-50 transition-colors"
            >
              📄 Summarize
            </button>
            <button
              onClick={askAboutPage}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded-lg text-text-primary font-medium disabled:opacity-50 transition-colors"
            >
              💬 Ask
            </button>
            <button
              onClick={() => {
                setAgentMode(!agentMode);
                if (!agentMode) scanPage();
              }}
              disabled={isLoading}
              className={`flex-1 px-3 py-2 text-xs border rounded-lg font-medium disabled:opacity-50 transition-colors ${
                agentMode
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'bg-bg-secondary hover:bg-bg-primary border-border text-text-primary'
              }`}
            >
              🤖 {agentMode ? 'Agent ON' : 'Agent'}
            </button>
          </div>
          {agentMode && (
            <div className="flex gap-2">
              <button
                onClick={scanPage}
                disabled={isLoading}
                className="flex-1 px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                🔍 Rescan
              </button>
              <button
                onClick={() => webviewApi?.scrollPage('up')}
                disabled={isLoading}
                className="px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                ↑
              </button>
              <button
                onClick={() => webviewApi?.scrollPage('down')}
                disabled={isLoading}
                className="px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                ↓
              </button>
            </div>
          )}
        </div>
      )}

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
