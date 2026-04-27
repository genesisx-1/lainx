import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { useBrowserStore } from '../store/browser.store';
import { useUIStore } from '../store/ui.store';
import { useAIStore } from '../store/ai.store';

function looksLikeUrl(input: string) {
  const q = (input || '').trim();
  if (!q) return false;
  if (q.startsWith('http://') || q.startsWith('https://')) return true;
  // Simple heuristic: domain-ish and no spaces.
  return q.includes('.') && !q.includes(' ');
}

function normalizeUrl(input: string) {
  const q = (input || '').trim();
  if (!q) return '';
  if (q.startsWith('http://') || q.startsWith('https://')) return q;
  return `https://${q}`;
}

function isAiCommand(input: string) {
  const q = (input || '').trim();
  const lower = q.toLowerCase();
  return (
    lower.startsWith('/ai ') ||
    lower === '/ai' ||
    lower.startsWith('ai ') ||
    lower === 'ai' ||
    lower.startsWith('ask ') ||
    lower.startsWith('/ask ') ||
    lower.startsWith('summarize ') ||
    lower.startsWith('/summarize ')
  );
}

function stripAiPrefix(input: string) {
  const q = (input || '').trim();
  const lower = q.toLowerCase();
  const prefixes = ['/ai', 'ai', '/ask', 'ask', '/summarize', 'summarize'];
  for (const p of prefixes) {
    if (lower === p) return '';
    if (lower.startsWith(p + ' ')) return q.slice(p.length + 1);
  }
  return q;
}

export function CommandPalette() {
  const {
    showCommandPalette,
    setShowCommandPalette,
    setSidebarOpen,
    setShowOnboarding,
    startFocusMode,
    stopFocusMode,
    setTerminalOpen,
    setShowCapsuleManager
  } = useUIStore();
  const { activeTabId, updateTab, addTab } = useBrowserStore();

  const { messages, addMessage, setLoading, getSystemMessage, saveCurrentConversation, settings } = useAIStore();

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showCommandPalette) return;
    setValue('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [showCommandPalette]);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) {
      return [
        { label: 'Search the web', hint: 'Type anything' },
        { label: 'Open a URL', hint: 'Type example.com' },
        { label: 'Ask AI', hint: 'Type “ai explain X” or “/ai …”' },
        { label: 'Focus mode', hint: 'Type “mode focus”' },
        { label: 'Capsules', hint: 'Type “capsules”' }
      ];
    }
    if (isAiCommand(q)) return [{ label: 'Ask AI', hint: stripAiPrefix(q) || '…' }];
    if (q.toLowerCase().startsWith('mode ')) return [{ label: 'Switch mode', hint: q }];
    if (q.toLowerCase().startsWith('capsule')) return [{ label: 'Capsules', hint: q }];
    if (looksLikeUrl(q) || q.toLowerCase().startsWith('open ')) return [{ label: 'Open URL', hint: q }];
    return [{ label: 'Search', hint: q }];
  }, [value]);

  const close = () => setShowCommandPalette(false);

  const navigate = (url: string, mode: 'current' | 'new' = 'current') => {
    const clean = (url || '').trim();
    if (!clean) return;
    if (mode === 'new') {
      addTab(clean);
      return;
    }
    if (activeTabId) {
      updateTab(activeTabId, { url: clean, title: 'Loading…', isLoading: true });
      return;
    }
    addTab(clean);
  };

  const runQuickAI = async (prompt: string) => {
    const text = (prompt || '').trim();
    if (!text) return;

    setSidebarOpen(true);

    const installed = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION);
    const models: string[] = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_LIST_MODELS);
    const modelList = Array.isArray(models) ? models : [];

    if (!installed || modelList.length === 0) {
      addMessage({
        role: 'assistant',
        content: 'Local AI is not set up yet. Opening the setup wizard now.'
      });
      setShowOnboarding(true);
      return;
    }

    const preferred = (settings.preferredModel || '').trim();
    const chosen =
      (preferred && modelList.includes(preferred) && preferred) ||
      modelList.find((m) => m.startsWith('qwen2.5') && m.includes('0.5b')) ||
      modelList[0];

    const userMessage = { role: 'user' as const, content: text };
    addMessage(userMessage);
    setLoading(true);

    try {
      const systemPrompt = getSystemMessage();
      const messagesWithSystem = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...messages,
        userMessage
      ];

      const response = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, messagesWithSystem, chosen);

      if (response?.message?.content) {
        addMessage({ role: 'assistant', content: response.message.content });
        saveCurrentConversation();
      } else {
        addMessage({
          role: 'assistant',
          content: 'I received an empty response. The model may still be loading.'
        });
      }
    } catch {
      addMessage({
        role: 'assistant',
        content:
          'Sorry — I couldn’t reach Ollama. If you just installed it, try starting the AI engine or re-run setup.'
      });
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    const raw = value.trim();
    if (!raw) return;

    const lower = raw.toLowerCase();

    // Capsules
    if (lower === 'capsules' || lower === 'manage capsules') {
      close();
      setShowCapsuleManager(true);
      return;
    }

    // mode commands
    if (lower === 'mode focus' || lower === 'focus') {
      if (activeTabId) startFocusMode({ lockedTabId: activeTabId, durationMinutes: 25 });
      setTerminalOpen(false);
      close();
      return;
    }
    if (lower === 'mode browse' || lower === 'browse') {
      stopFocusMode();
      close();
      return;
    }
    if (lower === 'mode build' || lower === 'build') {
      stopFocusMode();
      setTerminalOpen(true);
      close();
      return;
    }

    // AI commands
    if (isAiCommand(raw)) {
      close();
      await runQuickAI(stripAiPrefix(raw));
      return;
    }

    // open commands
    if (lower.startsWith('open ')) {
      const target = raw.slice(5).trim();
      const url = looksLikeUrl(target) ? normalizeUrl(target) : target;
      close();
      navigate(url, 'current');
      return;
    }

    if (looksLikeUrl(raw)) {
      close();
      navigate(normalizeUrl(raw), 'current');
      return;
    }

    // default: search
    close();
    navigate(`https://www.google.com/search?q=${encodeURIComponent(raw)}`, 'current');
  };

  useEffect(() => {
    if (!showCommandPalette) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCommandPalette]);

  if (!showCommandPalette) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center pt-20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-[760px] max-w-[95vw] lain-glass rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center">
          <div className="text-xs tracking-[0.25em] text-text-muted">COMMAND PALETTE</div>
          <div className="ml-auto text-xs text-text-muted">
            <kbd className="px-1.5 py-0.5 rounded bg-bg-panel border border-border/40">Esc</kbd> to close
          </div>
        </div>

        <div className="p-4 border-b border-border/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              execute();
            }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type a command: URL, search, or “ai …”"
              className="w-full h-12 px-4 rounded-xl bg-bg-secondary/40 border border-border/50 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
          </form>
          <div className="mt-2 text-xs text-text-muted">
            Examples: <span className="text-text-primary">example.com</span>,{' '}
            <span className="text-text-primary">search react useEffect</span>,{' '}
            <span className="text-text-primary">ai summarize this page</span>,{' '}
            <span className="text-text-primary">mode focus</span>
          </div>
        </div>

        <div className="max-h-[260px] overflow-auto">
          {suggestions.map((s, idx) => (
            <div key={idx} className="px-4 py-2 border-b border-border/20 last:border-0">
              <div className="text-sm text-text-primary font-medium">{s.label}</div>
              <div className="text-xs text-text-muted mt-0.5">{s.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

