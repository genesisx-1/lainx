import { useEffect, useMemo, useRef, useState } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { useBrowserStore } from '../../store/browser.store';
import type { AgentEvent, AgentTask, ProviderId, ProviderSummary } from '../../../shared/types';

interface TimelineEntry {
  ts: number;
  type: AgentEvent['type'];
  text: string;
  data?: any;
}

interface Props {
  onOpenProviders: () => void;
}

export function AgentTab({ onOpenProviders }: Props) {
  const { activeTabId, setAgentDrivingTab } = useBrowserStore();
  const [goal, setGoal] = useState('');
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | ''>('');
  const [withVision, setWithVision] = useState(true);
  const [withPlanner, setWithPlanner] = useState(true);
  const [task, setTask] = useState<AgentTask | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [costUsd, setCostUsd] = useState(0);
  const [awaitingUser, setAwaitingUser] = useState<{ requestId: string; question: string } | null>(null);
  const [userReply, setUserReply] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke(IPC_CHANNELS.PROVIDER_LIST)
      .then((list: ProviderSummary[]) => {
        setProviders(list);
        const ready = list.find((p) => p.hasKey) || list.find((p) => p.id === 'ollama');
        if (ready) setSelectedProvider(ready.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, (evt: AgentEvent) => {
      if (task && evt.taskId !== task.id) return;
      const entry = describeEvent(evt);
      setTimeline((tl) => [...tl, entry]);
      if (evt.type === 'cost' && typeof evt.data?.usd === 'number') setCostUsd(evt.data.usd);
      if (evt.type === 'awaiting_user') setAwaitingUser({ requestId: evt.data.requestId, question: evt.data.question });
      if (evt.type === 'task_completed' || evt.type === 'task_failed' || evt.type === 'task_cancelled') {
        setAgentDrivingTab(null);
        setTask((t) => (t ? { ...t, status: evt.type === 'task_completed' ? 'completed' : evt.type === 'task_failed' ? 'failed' : 'cancelled' } : t));
      }
    });
    return () => { try { unsub(); } catch {/* ignore */} };
  }, [task?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length]);

  async function startTask() {
    if (!goal.trim()) return;
    setTimeline([]);
    setCostUsd(0);
    setAwaitingUser(null);
    const started: AgentTask = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_START, {
      goal: goal.trim(),
      mode: 'live',
      tabId: activeTabId,
      provider: selectedProvider || undefined,
      withVision,
      withPlanner,
    });
    setTask(started);
    setAgentDrivingTab(activeTabId);
  }

  function pauseTask() { if (task) window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_PAUSE, task.id); }
  function resumeTask() { if (task) window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_RESUME, task.id); }
  function cancelTask() {
    if (task) window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL, task.id);
    setAgentDrivingTab(null);
  }
  function answerUser() {
    if (!awaitingUser || !task) return;
    window.electron.ipcRenderer.send(IPC_CHANNELS.AGENT_RESPOND_USER, { taskId: task.id, answer: userReply });
    setAwaitingUser(null);
    setUserReply('');
  }

  const running = useMemo(() => task && !['completed', 'failed', 'cancelled'].includes(task.status), [task]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as ProviderId)}
            className="bg-bg-primary border border-border rounded-md text-xs px-2 py-1.5"
          >
            <option value="">Auto-pick provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={p.requiresKey && !p.hasKey}>
                {p.label}{p.requiresKey && !p.hasKey ? ' (no key)' : ''}
              </option>
            ))}
          </select>
          <button onClick={onOpenProviders} className="text-xs text-text-muted hover:text-text-primary underline">
            Manage keys
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={withPlanner} onChange={(e) => setWithPlanner(e.target.checked)} />
            Planner (Opus)
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={withVision} onChange={(e) => setWithVision(e.target.checked)} />
            Vision (screenshots)
          </label>
          <span className="ml-auto">~${costUsd.toFixed(4)}</span>
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What should the agent do? e.g. 'Open Hacker News, click the top story, summarize it.'"
          rows={3}
          className="w-full bg-bg-primary border border-border rounded-md px-3 py-2 text-sm resize-y"
        />
        <div className="flex items-center gap-2">
          {!running && (
            <button
              onClick={startTask}
              disabled={!goal.trim()}
              className="px-3 py-2 text-sm rounded-md bg-accent hover:bg-accent-hover text-white disabled:opacity-50"
            >
              Run agent
            </button>
          )}
          {running && (
            <>
              {task?.status === 'paused' || task?.status === 'awaiting_user' ? (
                <button onClick={resumeTask} className="px-3 py-2 text-sm rounded-md bg-accent hover:bg-accent-hover text-white">
                  Resume
                </button>
              ) : (
                <button onClick={pauseTask} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-bg-primary">
                  Pause
                </button>
              )}
              <button onClick={cancelTask} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-bg-primary">
                Cancel
              </button>
            </>
          )}
          {task && (
            <span className="ml-auto text-xs text-text-muted">step {task.stepCount} · {task.status}</span>
          )}
        </div>
      </div>

      {awaitingUser && (
        <div className="m-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm">
          <div className="font-medium text-amber-300 mb-1">Agent is asking:</div>
          <div className="mb-2">{awaitingUser.question}</div>
          <div className="flex items-center gap-2">
            <input
              value={userReply}
              onChange={(e) => setUserReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') answerUser(); }}
              className="flex-1 bg-bg-primary border border-border rounded-md px-2 py-1.5 text-sm"
              placeholder="Your answer…"
            />
            <button onClick={answerUser} className="px-2 py-1.5 text-xs rounded-md bg-accent hover:bg-accent-hover text-white">
              Reply
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {timeline.length === 0 && (
          <div className="text-xs text-text-muted py-8 text-center">
            No agent activity yet. Set a goal above and press <b>Run agent</b>.
          </div>
        )}
        {timeline.map((e, i) => (
          <TimelineRow key={i} entry={e} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const color =
    entry.type === 'task_completed' ? 'text-emerald-300'
    : entry.type === 'task_failed' || entry.type === 'task_cancelled' ? 'text-rose-300'
    : entry.type === 'tool_call' ? 'text-sky-300'
    : entry.type === 'tool_result' ? 'text-slate-300'
    : entry.type === 'plan' ? 'text-violet-300'
    : entry.type === 'awaiting_user' ? 'text-amber-300'
    : 'text-text-primary';
  return (
    <div className="rounded-md border border-border bg-bg-panel/50 px-3 py-2 text-xs">
      <div className={`font-medium ${color}`}>{entry.type}</div>
      <div className="whitespace-pre-wrap text-text-primary mt-0.5">{entry.text}</div>
    </div>
  );
}

function describeEvent(evt: AgentEvent): TimelineEntry {
  const text = (() => {
    switch (evt.type) {
      case 'task_started': return `Goal: ${evt.data?.goal || ''} (mode ${evt.data?.mode}, provider ${evt.data?.provider})`;
      case 'plan': return evt.data?.plan || '';
      case 'tool_call': return `${evt.data?.name}(${JSON.stringify(evt.data?.input || {}).slice(0, 200)})`;
      case 'tool_result': return `${evt.data?.name} → ${evt.data?.ok ? 'ok' : 'fail'}: ${(evt.data?.output || '').slice(0, 400)}`;
      case 'assistant_text': return evt.data?.text || '';
      case 'cost': return `Total ~$${(evt.data?.usd || 0).toFixed(4)}`;
      case 'task_completed': return evt.data?.summary || 'Done.';
      case 'task_failed': return `Failed: ${evt.data?.error || ''}`;
      case 'task_cancelled': return 'Cancelled.';
      case 'awaiting_user': return `Asks: ${evt.data?.question || ''}`;
      case 'paused': return 'Paused.';
      case 'resumed': return 'Resumed.';
      case 'user_takeover': return 'User took control.';
      default: return JSON.stringify(evt.data || {});
    }
  })();
  return { ts: evt.ts, type: evt.type, text, data: evt.data };
}
