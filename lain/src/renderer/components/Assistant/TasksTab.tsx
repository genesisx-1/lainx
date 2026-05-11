import { useEffect, useState } from 'react';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { AgentTask, AgentEvent } from '../../../shared/types';

export function TasksTab() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [refreshAt, setRefreshAt] = useState(0);

  async function refresh() {
    try {
      const list = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_LIST_TASKS);
      setTasks(Array.isArray(list) ? list : []);
    } catch {/* ignore */}
  }
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refreshAt]);

  // Bump on any agent event so we don't wait the full interval.
  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, (_evt: AgentEvent) => {
      setRefreshAt(Date.now());
    });
    return () => { try { unsub(); } catch {/* ignore */} };
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="p-6 text-sm text-text-muted text-center">
        No agent tasks yet. Start one from the <b>Agent</b> tab or the omnibox (switch to Agent mode and type a goal).
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 space-y-2">
      {tasks
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
    </div>
  );
}

function TaskRow({ task }: { task: AgentTask }) {
  const statusColor =
    task.status === 'completed' ? 'text-success'
    : task.status === 'failed' ? 'text-danger'
    : task.status === 'cancelled' ? 'text-text-muted'
    : task.status === 'running' || task.status === 'planning' ? 'text-accent-soft'
    : task.status === 'paused' || task.status === 'awaiting_user' ? 'text-warning'
    : 'text-text-secondary';

  function action(channel: string) {
    return () => window.electron.ipcRenderer.invoke(channel, task.id);
  }

  return (
    <div className="rounded-xl border border-border bg-bg-panel/70 backdrop-blur px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-text-primary truncate">{task.goal}</div>
          <div className="mt-0.5 text-text-muted flex items-center gap-2">
            <span className={statusColor}>{task.status}</span>
            <span>·</span>
            <span>{task.mode}</span>
            <span>·</span>
            <span>{task.provider}</span>
            <span>·</span>
            <span>step {task.stepCount}</span>
            <span>·</span>
            <span>~${(task.totalUsd || 0).toFixed(4)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(task.status === 'running' || task.status === 'planning') && (
            <button onClick={action(IPC_CHANNELS.AGENT_PAUSE)} className="px-2 py-1 rounded border border-border hover:bg-bg-primary">
              Pause
            </button>
          )}
          {(task.status === 'paused' || task.status === 'awaiting_user') && (
            <button onClick={action(IPC_CHANNELS.AGENT_RESUME)} className="px-2 py-1 rounded border border-border hover:bg-bg-primary">
              Resume
            </button>
          )}
          {!['completed', 'failed', 'cancelled'].includes(task.status) && (
            <button onClick={action(IPC_CHANNELS.AGENT_CANCEL)} className="px-2 py-1 rounded border border-border hover:bg-bg-primary text-danger">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
