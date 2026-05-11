import { useEffect, useState } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProviderId, ProviderSummary, ControlServerInfo } from '../../../shared/types';

interface Props {
  onClose: () => void;
}

const FRIENDLY: Record<ProviderId, string> = {
  anthropic: 'Anthropic (Opus 4.7 plan, Sonnet 4.6 act)',
  openai: 'OpenAI (GPT-4.1 / 4o)',
  openrouter: 'OpenRouter (any model, one key)',
  ollama: 'Ollama (local, offline)',
};

const HINTS: Record<ProviderId, string> = {
  anthropic: 'Best for agent quality. Get a key at console.anthropic.com.',
  openai: 'Function calling + vision. Get a key at platform.openai.com.',
  openrouter: 'Cheapest path to any model. Get a key at openrouter.ai.',
  ollama: 'No key required. Make sure Ollama is installed and a model is downloaded.',
};

export function ProviderSettings({ onClose }: Props) {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [controlInfo, setControlInfo] = useState<ControlServerInfo | null>(null);
  const [perms, setPerms] = useState<{ 'computer-use': boolean; 'computer-shell': boolean; imessage: boolean }>({
    'computer-use': false, 'computer-shell': false, imessage: false,
  });

  async function refresh() {
    const list = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_LIST);
    setProviders(list);
    const info = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.CONTROL_SERVER_GET_INFO);
    setControlInfo(info);
    const p = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_PERMISSIONS_GET);
    setPerms({
      'computer-use': p['computer-use'] === 'allow',
      'computer-shell': p['computer-shell'] === 'allow',
      imessage: p.imessage === 'allow',
    });
  }
  useEffect(() => { refresh(); }, []);

  async function setPerm(key: 'computer-use' | 'computer-shell' | 'imessage', allow: boolean) {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_PERMISSIONS_SET, key, allow ? 'allow' : 'deny');
    setPerms((p) => ({ ...p, [key]: allow }));
  }

  async function saveKey(id: ProviderId) {
    const k = keyDrafts[id] || '';
    if (!k.trim()) return;
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SET_KEY, id, k.trim());
    setKeyDrafts((d) => ({ ...d, [id]: '' }));
    await refresh();
  }
  async function clearKey(id: ProviderId) {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_CLEAR_KEY, id);
    await refresh();
  }
  async function test(id: ProviderId) {
    setTesting((t) => ({ ...t, [id]: true }));
    setTestResult((r) => ({ ...r, [id]: '' }));
    try {
      const result = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_TEST, id);
      setTestResult((r) => ({ ...r, [id]: result?.ok ? 'OK' : `Failed: ${result?.error || 'unknown'}` }));
    } finally {
      setTesting((t) => ({ ...t, [id]: false }));
    }
  }
  async function saveModels(id: ProviderId, planner: string, executor: string) {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SET_MODELS, id, { planner, executor });
    await refresh();
  }

  async function toggleControlServer(enabled: boolean) {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.CONTROL_SERVER_SET_ENABLED, enabled);
    await refresh();
  }
  async function regenerateToken() {
    await window.electron.ipcRenderer.invoke(IPC_CHANNELS.CONTROL_SERVER_REGENERATE_TOKEN);
    await refresh();
  }
  function copyToken() {
    if (controlInfo?.token) navigator.clipboard?.writeText(controlInfo.token).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[640px] max-h-[85vh] overflow-auto rounded-2xl border border-border bg-bg-secondary/95 backdrop-blur p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">AI Providers</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Keys are encrypted via Electron safeStorage when supported by your OS. They never leave the main process.
        </p>
        {/* Control server (lainx CLI) */}
        <div className="rounded-xl border border-border bg-bg-panel/70 backdrop-blur-glass p-4 mb-4 shadow-glass">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Local control server</div>
              <div className="text-xs text-text-muted mt-0.5">
                Lets the <code>lainx</code> CLI drive this browser from any shell. Bound to <code>127.0.0.1</code>.
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!controlInfo?.enabled} onChange={(e) => toggleControlServer(e.target.checked)} />
              Enabled
            </label>
          </div>
          {controlInfo?.enabled && (
            <div className="mt-3 grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-xs">
              <span className="text-text-muted">URL</span>
              <code className="bg-bg-primary border border-border rounded px-2 py-1 truncate">{controlInfo.url}</code>
              <span />
              <span />
              <span className="text-text-muted">Token</span>
              <code className="bg-bg-primary border border-border rounded px-2 py-1 truncate">
                {controlInfo.token ? `${controlInfo.token.slice(0, 8)}…${controlInfo.token.slice(-4)}` : '(none)'}
              </code>
              <button onClick={copyToken} className="px-2 py-1 rounded border border-border hover:bg-bg-primary">Copy</button>
              <button onClick={regenerateToken} className="px-2 py-1 rounded border border-border hover:bg-bg-primary">Rotate</button>
            </div>
          )}
          <div className="text-xs text-text-muted mt-3">
            CLI setup: <code>lainx login --token &lt;token&gt; --url {controlInfo?.url || 'http://127.0.0.1:7878'}</code>
          </div>
        </div>

        {/* OS permissions */}
        <div className="rounded-xl border border-border bg-bg-panel/70 backdrop-blur-glass p-4 mb-4 shadow-glass">
          <div className="font-medium mb-1">OS / app permissions</div>
          <div className="text-xs text-text-muted mb-2">
            These grant the agent power outside the browser. Off by default.
          </div>
          <PermRow label="Computer-use (mouse + keyboard + desktop screenshots)" hint="Requires installing @nut-tree-fork/nut-js for mouse/keyboard. Screenshots work without it."
            checked={perms['computer-use']} onChange={(v) => setPerm('computer-use', v)} />
          <PermRow label="Shell access (run terminal commands)" hint="DANGEROUS — only enable for trusted prompts."
            checked={perms['computer-shell']} onChange={(v) => setPerm('computer-shell', v)} />
          <PermRow label="iMessage (send + read recent)" hint="macOS only. AppleScript + Messages app + chat.db readonly."
            checked={perms.imessage} onChange={(v) => setPerm('imessage', v)} />
        </div>

        <div className="space-y-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-bg-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{FRIENDLY[p.id]}</div>
                  <div className="text-xs text-text-muted mt-0.5">{HINTS[p.id]}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.hasKey ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {p.requiresKey ? (p.hasKey ? 'Key set' : 'No key') : 'No key needed'}
                  </span>
                </div>
              </div>

              {p.requiresKey && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="password"
                    placeholder={p.hasKey ? 'Replace key…' : 'Paste API key…'}
                    value={keyDrafts[p.id] || ''}
                    onChange={(e) => setKeyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    className="flex-1 bg-bg-primary border border-border rounded-md px-3 py-2 text-sm"
                  />
                  <button onClick={() => saveKey(p.id)} className="px-3 py-2 text-sm rounded-md bg-accent hover:bg-accent-hover text-white">
                    Save
                  </button>
                  {p.hasKey && (
                    <button onClick={() => clearKey(p.id)} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-bg-primary">
                      Clear
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-text-muted">
                  Planner model
                  <input
                    defaultValue={p.models.planner}
                    onBlur={(e) => saveModels(p.id, e.target.value, p.models.executor)}
                    className="mt-1 w-full bg-bg-primary border border-border rounded-md px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-text-muted">
                  Executor model
                  <input
                    defaultValue={p.models.executor}
                    onBlur={(e) => saveModels(p.id, p.models.planner, e.target.value)}
                    className="mt-1 w-full bg-bg-primary border border-border rounded-md px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => test(p.id)}
                  disabled={!!testing[p.id]}
                  className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-bg-primary"
                >
                  {testing[p.id] ? 'Testing…' : 'Test'}
                </button>
                {testResult[p.id] && (
                  <span className={`text-xs ${testResult[p.id].startsWith('OK') ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {testResult[p.id]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PermRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 py-1 cursor-pointer">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="text-xs">
        <div className="text-text-primary">{label}</div>
        <div className="text-text-muted">{hint}</div>
      </div>
    </label>
  );
}
