import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAIStore } from '../../store/ai.store';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useUIStore } from '../../store/ui.store';
import { useBrowserStore } from '../../store/browser.store';
import { ChatSettings } from './ChatSettings';
import { ChatHistory } from './ChatHistory';

type AgentElement = {
  index: number;
  tag: string;
  text: string;
  type?: string;
  placeholder?: string;
};

function Icon({
  name,
  className = 'w-4 h-4'
}: {
  name:
    | 'history'
    | 'settings'
    | 'refresh'
    | 'close'
    | 'doc'
    | 'chat'
    | 'robot'
    | 'search'
    | 'chevronUp'
    | 'chevronDown';
  className?: string;
}) {
  switch (name) {
    case 'history':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'refresh':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 9A9 9 0 006.4 5.6L4 10m0 5a9 9 0 0013.6 3.4L20 14" />
        </svg>
      );
    case 'close':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'doc':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
        </svg>
      );
    case 'chat':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m11-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'robot':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v3m-6 4h12a3 3 0 013 3v5a3 3 0 01-3 3H6a3 3 0 01-3-3v-5a3 3 0 013-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14h.01M15 14h.01" />
        </svg>
      );
    case 'search':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 19a8 8 0 100-16 8 8 0 000 16z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35" />
        </svg>
      );
    case 'chevronUp':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    case 'chevronDown':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
  }
}

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
  const { webviewApi, tabs, activeTabId, updateTab } = useBrowserStore();

  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(''); // set after fetch
  const [statusText, setStatusText] = useState<string>('Checking…');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastScannedElements, setLastScannedElements] = useState<AgentElement[]>([]);
  
  // Check if we're on a real page (not welcome page)
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canAnalyzePage = activeTab && activeTab.url !== 'lain://welcome' && webviewApi?.getPageContent;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for omnibox "Ask" mode dispatches and pre-fill the input.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const ce = e as CustomEvent<{ question: string }>;
      const q = ce.detail?.question;
      if (typeof q === 'string') {
        setInput((prev) => (prev ? `${prev} ${q}` : q));
        setTimeout(() => {
          const el = document.querySelector('[data-lain-chat-input]') as HTMLTextAreaElement | null;
          el?.focus();
        }, 0);
      }
    };
    window.addEventListener('lain:omnibox-ask', onAsk as EventListener);
    return () => window.removeEventListener('lain:omnibox-ask', onAsk as EventListener);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const chooseDefaultModel = (list: string[], preferred: string) => {
      if (preferred && list.includes(preferred)) return preferred;
      return (
        list.find((m) => m.startsWith('qwen2.5') && m.includes('0.5b')) ||
        list.find((m) => m.toLowerCase().includes('qwen')) ||
        list[0] ||
        ''
      );
    };

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
        const normalized = Array.isArray(list) ? list : [];
        setModels(normalized);

        if (!installed) {
          setStatusText('Not installed');
          setSelectedModel('');
          return;
        }

        if (!normalized || normalized.length === 0) {
          setStatusText('No models');
          setSelectedModel('');
          return;
        }

        setStatusText('Ready');
        const next = chooseDefaultModel(normalized, settings.preferredModel);
        setSelectedModel((prev) => (prev && normalized.includes(prev) ? prev : next));
        if (next && next !== settings.preferredModel) {
          useAIStore.getState().updateSettings({ preferredModel: next });
        }
        console.log('[ChatPanel] AI is ready, model:', next);
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
  }, [settings.preferredModel]);

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
      const normalized = Array.isArray(list) ? list : [];
      setModels(normalized);
      if (normalized?.length) {
        const next =
          (settings.preferredModel && normalized.includes(settings.preferredModel) && settings.preferredModel) ||
          normalized.find((m) => m.startsWith('qwen2.5') && m.includes('0.5b')) ||
          normalized.find((m) => m.toLowerCase().includes('qwen')) ||
          normalized[0];
        setSelectedModel(next);
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
      content: `Summarize this page: ${activeTab?.title || activeTab?.url}`
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
      content: 'Scanning page for interactive elements...'
    });

    try {
      const elements = (await webviewApi.getInteractiveElements()) as AgentElement[];
      setLastScannedElements(Array.isArray(elements) ? elements : []);
      
      // Build a description for the AI
      const elementList = elements.map((el) => 
        `[${el.index}] ${el.tag}${el.type ? ` (${el.type})` : ''}: "${el.text || el.placeholder || 'no text'}"`
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

  const agentContextText = useMemo(() => {
    if (!agentMode) return '';
    if (!canAnalyzePage) return '';
    if (!lastScannedElements.length) return '';
    return lastScannedElements
      .slice(0, 60)
      .map(
        (el) =>
          `[${el.index}] ${el.tag}${el.type ? ` (${el.type})` : ''}: "${(el.text || el.placeholder || 'no text')
            .slice(0, 60)
            .replace(/\s+/g, ' ')
            .trim()}"`
      )
      .join('\n');
  }, [agentMode, canAnalyzePage, lastScannedElements]);

  function extractJsonObject(text: string): any | null {
    const trimmed = (text || '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  const runAiAgent = async (userInput: string) => {
    if (!selectedModel) return false;
    if (!webviewApi) return false;
    if (!agentContextText) return false;

    setLoading(true);
    try {
      const url = activeTab?.url || '';
      const title = activeTab?.title || '';
      const response = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AI_CHAT,
        [
          {
            role: 'system',
            content:
              'You are a browser automation agent. Choose exactly ONE action and output ONLY a JSON object. ' +
              'Allowed actions: click, type, scroll, rescan, navigate. ' +
              'Schema: ' +
              '{"action":"click","index":NUMBER} | {"action":"type","index":NUMBER,"text":"..."} | {"action":"scroll","direction":"up"|"down"} | {"action":"rescan"} | {"action":"navigate","url":"https://..."}.' +
              ' Use the element indices exactly as provided.',
          },
          {
            role: 'user',
            content: `Page: ${title}\nURL: ${url}\n\nInteractive elements:\n${agentContextText}\n\nUser request: ${userInput}`,
          },
        ],
        selectedModel
      );

      const content = response?.message?.content || '';
      const actionObj = extractJsonObject(content);
      if (!actionObj || !actionObj.action) {
        addMessage({
          role: 'assistant',
          content:
            'Agent could not interpret that request. Try: "click element 12", "type \\"hello\\" in element 7", "scroll down", or click Rescan first.',
        });
        return true;
      }

      const action = String(actionObj.action);
      if (action === 'click') {
        const idx = Number(actionObj.index);
        const ok = Number.isFinite(idx) ? await webviewApi.clickElement(idx) : false;
        addMessage({ role: 'assistant', content: ok ? `Clicked element ${idx}.` : `Failed to click element ${idx}.` });
        setTimeout(scanPage, 800);
        return true;
      }
      if (action === 'type') {
        const idx = Number(actionObj.index);
        const text = typeof actionObj.text === 'string' ? actionObj.text : '';
        const ok = Number.isFinite(idx) && text ? await webviewApi.typeInElement(idx, text) : false;
        addMessage({ role: 'assistant', content: ok ? `Typed into element ${idx}.` : `Failed to type into element ${idx}.` });
        setTimeout(scanPage, 800);
        return true;
      }
      if (action === 'scroll') {
        const dir = actionObj.direction === 'up' ? 'up' : 'down';
        await webviewApi.scrollPage(dir);
        addMessage({ role: 'assistant', content: `Scrolled ${dir}.` });
        return true;
      }
      if (action === 'navigate') {
        const nextUrl = typeof actionObj.url === 'string' ? actionObj.url.trim() : '';
        if (nextUrl && activeTabId) {
          updateTab(activeTabId, { url: nextUrl, isLoading: true });
          addMessage({ role: 'assistant', content: `Navigating to ${nextUrl}` });
          return true;
        }
        addMessage({ role: 'assistant', content: 'Could not navigate: missing URL.' });
        return true;
      }
      if (action === 'rescan') {
        await scanPage();
        return true;
      }

      addMessage({ role: 'assistant', content: `Unsupported agent action: ${action}` });
      return true;
    } catch {
      addMessage({ role: 'assistant', content: 'Agent failed to run. Try Rescan and then ask again.' });
      return true;
    } finally {
      setLoading(false);
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
        content: success ? `Clicked element ${idx}.` : `Failed to click element ${idx}.`
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
        content: success ? `Typed \"${text}\" in element ${idx}.` : `Failed to type in element ${idx}.`
      });
      return true;
    }

    // Scroll command
    if (lowerCmd.includes('scroll down')) {
      await webviewApi.scrollPage('down');
      addMessage({ role: 'assistant', content: 'Scrolled down.' });
      return true;
    }
    if (lowerCmd.includes('scroll up')) {
      await webviewApi.scrollPage('up');
      addMessage({ role: 'assistant', content: 'Scrolled up.' });
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

      const aiHandled = await runAiAgent(userInput);
      if (aiHandled) return;
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
            <Icon name="history" className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary text-xs"
            title="Settings"
          >
            <Icon name="settings" className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary text-xs"
            title="Refresh AI status"
          >
            <Icon name="refresh" className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
            title="Close AI panel"
          >
            <Icon name="close" className="w-4 h-4" />
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
            onChange={(e) => {
              const v = e.target.value;
              setSelectedModel(v);
              useAIStore.getState().updateSettings({ preferredModel: v });
            }}
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
            <div className="flex items-center justify-center gap-2 text-text-primary mb-2">
              <span className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                <Icon name="robot" className="w-4 h-4" />
              </span>
              <p className="text-lg">Local AI Assistant</p>
            </div>
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
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="doc" className="w-4 h-4" />
                Summarize
              </span>
            </button>
            <button
              onClick={askAboutPage}
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded-lg text-text-primary font-medium disabled:opacity-50 transition-colors"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="chat" className="w-4 h-4" />
                Ask
              </span>
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
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="robot" className="w-4 h-4" />
                {agentMode ? 'Agent ON' : 'Agent'}
              </span>
            </button>
          </div>
          {agentMode && (
            <div className="flex gap-2">
              <button
                onClick={scanPage}
                disabled={isLoading}
                className="flex-1 px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Icon name="search" className="w-4 h-4" />
                  Rescan
                </span>
              </button>
              <button
                onClick={() => webviewApi?.scrollPage('up')}
                disabled={isLoading}
                className="px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                <Icon name="chevronUp" className="w-4 h-4" />
              </button>
              <button
                onClick={() => webviewApi?.scrollPage('down')}
                disabled={isLoading}
                className="px-2 py-1.5 text-xs bg-bg-secondary hover:bg-bg-primary border border-border rounded text-text-muted"
              >
                <Icon name="chevronDown" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            data-lain-chat-input
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
