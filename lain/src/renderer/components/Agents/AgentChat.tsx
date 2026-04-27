import React, { useState, useRef, useEffect } from 'react';
import { useAgentsStore } from '../../store/agents.store';
import { useAIStore } from '../../store/ai.store';
// useUIStore available if needed for onboarding etc
import { useBrowserStore } from '../../store/browser.store';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { AgentId, AgentInfo } from '../../../shared/types';

// Agent colors are defined in the agent definitions in the store

function AgentSelector({
  agents,
  activeAgent,
  onSelect,
}: {
  agents: AgentInfo[];
  activeAgent: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 overflow-x-auto">
      {agents.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
            activeAgent === a.id
              ? 'border shadow-sm'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-panel/80'
          }`}
          style={
            activeAgent === a.id
              ? {
                  backgroundColor: `${a.color}18`,
                  borderColor: `${a.color}40`,
                  color: a.color,
                }
              : undefined
          }
          title={`${a.name} — ${a.role} (${a.status})`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              a.status === 'online'
                ? 'bg-green-500'
                : a.status === 'busy'
                ? 'bg-amber-400 animate-pulse'
                : a.status === 'error'
                ? 'bg-red-500'
                : 'bg-zinc-600'
            }`}
          />
          {a.name}
        </button>
      ))}
    </div>
  );
}

export function AgentChat() {
  const { agents, activeAgent, setActiveAgent, runAgentCommand } = useAgentsStore();
  const {
    messages,
    isLoading,
    addMessage,
    setLoading,
    getSystemMessage,
    saveCurrentConversation,
    settings,
  } = useAIStore();
  // UI store available via useUIStore() if needed
  const { webviewApi, tabs, activeTabId } = useBrowserStore();

  const [input, setInput] = useState('');
  const [ollamaReady, setOllamaReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find((a) => a.id === activeAgent) || agents[0];

  // Check Ollama for local AI chat (used by Claude/default)
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const installed = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION
        );
        if (cancelled) return;
        if (!installed) {
          setOllamaReady(false);
          return;
        }
        const list: string[] = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.OLLAMA_LIST_MODELS
        );
        if (cancelled) return;
        const normalized = Array.isArray(list) ? list : [];
        setModels(normalized);
        if (normalized.length > 0) {
          setOllamaReady(true);
          const preferred = settings.preferredModel;
          const model =
            (preferred && normalized.includes(preferred) && preferred) ||
            normalized.find((m) => m.startsWith('qwen2.5') && m.includes('0.5b')) ||
            normalized[0];
          setSelectedModel(model || '');
        }
      } catch {
        if (!cancelled) setOllamaReady(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [settings.preferredModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');

    addMessage({ role: 'user', content: `[@${currentAgent.name}] ${userText}` });
    setLoading(true);

    try {
      // For external CLI agents (non-local AI), route to the agent CLI
      if (activeAgent !== 'claude' || !ollamaReady) {
        // Use the agent CLI
        const result = await runAgentCommand(activeAgent, userText);
        addMessage({
          role: 'assistant',
          content: result || `${currentAgent.name} returned no output.`,
        });
        saveCurrentConversation();
      } else {
        // Use local Ollama AI for Claude chat
        if (!selectedModel) {
          addMessage({
            role: 'assistant',
            content:
              'No local model available. Set up Ollama first or switch to another agent.',
          });
          setLoading(false);
          return;
        }

        const systemPrompt = getSystemMessage();
        const messagesWithSystem = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          ...messages,
          { role: 'user' as const, content: userText },
        ];

        const response = await window.electron.ipcRenderer.invoke(
          IPC_CHANNELS.AI_CHAT,
          messagesWithSystem,
          selectedModel
        );

        if (response?.message?.content) {
          addMessage({ role: 'assistant', content: response.message.content });
          saveCurrentConversation();
        } else {
          addMessage({
            role: 'assistant',
            content: 'Received empty response. Model may still be loading.',
          });
        }
      }
    } catch (error: any) {
      addMessage({
        role: 'assistant',
        content: `Error from ${currentAgent.name}: ${error?.message || 'Command failed. Is the agent CLI installed?'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Page context actions
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canAnalyzePage =
    activeTab && activeTab.url !== 'lain://welcome' && webviewApi?.getPageContent;

  const summarizePage = async () => {
    if (!canAnalyzePage || isLoading || !selectedModel) return;
    setLoading(true);
    addMessage({ role: 'user', content: `Summarize: ${activeTab?.title || activeTab?.url}` });
    try {
      const pageContent = await webviewApi!.getPageContent();
      if (!pageContent.text) {
        addMessage({ role: 'assistant', content: "Couldn't read page content." });
        setLoading(false);
        return;
      }
      const response = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AI_CHAT,
        [
          {
            role: 'system',
            content:
              'Summarize web pages concisely with key points in a structured format.',
          },
          {
            role: 'user',
            content: `Summarize (${pageContent.url}):\n\nTitle: ${pageContent.title}\n\n${pageContent.text.slice(0, 6000)}`,
          },
        ],
        selectedModel
      );
      addMessage({
        role: 'assistant',
        content: response?.message?.content || "Couldn't generate summary.",
      });
    } catch {
      addMessage({ role: 'assistant', content: 'Failed to summarize page.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Agent selector strip */}
      <AgentSelector
        agents={agents}
        activeAgent={activeAgent}
        onSelect={setActiveAgent}
      />

      {/* Active agent info bar */}
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: `${currentAgent.color}22`, color: currentAgent.color }}
        >
          {currentAgent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text-primary">
            {currentAgent.name}{' '}
            <span className="text-text-muted font-normal">— {currentAgent.role}</span>
          </div>
          <div className="text-[10px] text-text-muted truncate">
            {currentAgent.delegateWhen}
          </div>
        </div>
        {/* Model picker for local AI */}
        {activeAgent === 'claude' && ollamaReady && models.length > 0 && (
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              useAIStore.getState().updateSettings({ preferredModel: e.target.value });
            }}
            className="text-[10px] bg-bg-secondary border border-border rounded px-1.5 py-0.5 text-text-primary max-w-[120px]"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-text-muted mt-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mx-auto mb-3"
              style={{
                backgroundColor: `${currentAgent.color}18`,
                color: currentAgent.color,
              }}
            >
              {currentAgent.icon}
            </div>
            <p className="text-sm font-medium text-text-primary">{currentAgent.name}</p>
            <p className="text-xs mt-1">{currentAgent.role}</p>
            <p className="text-xs mt-3 max-w-[240px] mx-auto">
              {activeAgent === 'claude'
                ? ollamaReady
                  ? 'Ask me anything. Local AI chat powered by Ollama.'
                  : 'Set up Ollama for local AI, or switch to another agent CLI.'
                : `Messages will be routed to ${currentAgent.name} CLI (${currentAgent.command}).`}
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          // Parse agent tag from message
          const agentMatch = message.content.match(/^\[@(\w+)\]\s*/);
          const msgAgent = agentMatch
            ? agents.find((a) => a.name.toLowerCase() === agentMatch[1].toLowerCase())
            : null;
          const displayContent = agentMatch
            ? message.content.slice(agentMatch[0].length)
            : message.content;
          const msgColor = message.role === 'user'
            ? (msgAgent?.color || currentAgent.color)
            : currentAgent.color;

          return (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[85%] flex gap-2">
                {/* Agent avatar for assistant messages */}
                {message.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: `${currentAgent.color}22`,
                      color: currentAgent.color,
                    }}
                  >
                    {currentAgent.icon}
                  </div>
                )}

                <div
                  className={`rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'text-white'
                      : 'bg-bg-panel text-text-primary border border-border/40'
                  }`}
                  style={
                    message.role === 'user'
                      ? { backgroundColor: `${msgColor}cc` }
                      : undefined
                  }
                >
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {displayContent}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: `${currentAgent.color}22`,
                  color: currentAgent.color,
                }}
              >
                {currentAgent.icon}
              </div>
              <div className="bg-bg-panel rounded-lg px-3 py-2 border border-border/40">
                <div className="flex gap-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: currentAgent.color, animationDelay: '0ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: currentAgent.color, animationDelay: '150ms' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: currentAgent.color, animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {ollamaReady && canAnalyzePage && activeAgent === 'claude' && (
        <div className="px-3 py-2 border-t border-border/40 flex gap-2">
          <button
            onClick={summarizePage}
            disabled={isLoading}
            className="flex-1 px-2 py-1.5 text-[11px] bg-accent/15 hover:bg-accent/25 border border-accent/30 rounded-md text-accent font-medium disabled:opacity-50 transition-colors"
          >
            Summarize Page
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentAgent.name}...`}
              className="w-full px-3 py-2 bg-bg-panel border border-border rounded-lg text-xs text-text-primary resize-none focus:border-accent pr-8"
              rows={2}
              disabled={isLoading}
            />
            {/* Agent indicator inside input */}
            <span
              className="absolute right-2 top-2 text-[10px] font-bold opacity-50"
              style={{ color: currentAgent.color }}
            >
              @{currentAgent.name}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: currentAgent.color }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
