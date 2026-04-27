import { useEffect, useState } from 'react';
import { useAgentsStore } from '../../store/agents.store';
import type { AgentId, AgentTask, TaskStatus } from '../../../shared/types';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-zinc-600 text-zinc-300',
  running: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  done: 'bg-green-500/20 text-green-400 border border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const AGENT_COLORS: Record<string, string> = {
  claude: '#8b5cf6',
  codex: '#10b981',
  cursor: '#3b82f6',
  gemini: '#f59e0b',
  qwen: '#ef4444',
};

function TaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLORS[task.agent] || '#6b7280';

  return (
    <div className="rounded-lg border border-border/60 bg-bg-panel/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5 hover:bg-bg-panel transition-colors"
      >
        <div className="flex items-start gap-2">
          {/* Agent badge */}
          <span
            className="mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
            style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
          >
            {task.agent}
          </span>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text-primary truncate">{task.title}</div>
          </div>

          {/* Status badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${STATUS_COLORS[task.status]}`}
          >
            {task.status}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/40">
          <div className="mt-2 text-xs text-text-secondary">
            <div className="font-medium text-text-muted mb-1">Prompt:</div>
            <div className="bg-bg-secondary rounded p-2 text-[11px] font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
              {task.prompt || '(no prompt)'}
            </div>
          </div>
          {task.result && (
            <div className="mt-2 text-xs text-text-secondary">
              <div className="font-medium text-text-muted mb-1">Result:</div>
              <div className="bg-bg-secondary rounded p-2 text-[11px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {task.result}
              </div>
            </div>
          )}
          {task.createdAt && (
            <div className="mt-2 text-[10px] text-text-muted">
              Created {new Date(task.createdAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskQueuePanel() {
  const { tasks, pollTasks } = useAgentsStore();
  const [newTitle, setNewTitle] = useState('');
  const [newAgent, setNewAgent] = useState<AgentId>('codex');
  const [newPrompt, setNewPrompt] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    pollTasks();
    const interval = setInterval(pollTasks, 10000);
    return () => clearInterval(interval);
  }, [pollTasks]);

  const createTask = async () => {
    if (!newTitle.trim()) return;
    try {
      const task = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_CREATE_TASK, {
        title: newTitle.trim(),
        agent: newAgent,
        prompt: newPrompt.trim(),
        status: 'pending',
      });
      if (task) {
        useAgentsStore.getState().addTask(task);
      }
      setNewTitle('');
      setNewPrompt('');
      setShowCreate(false);
    } catch (err) {
      console.error('[TaskQueue] Failed to create task:', err);
    }
  };

  const pending = tasks.filter((t) => t.status === 'pending');
  const running = tasks.filter((t) => t.status === 'running');
  const done = tasks.filter((t) => t.status === 'done' || t.status === 'failed');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Task Queue</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {pending.length} pending, {running.length} running, {done.length} completed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pollTasks()}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-bg-panel text-text-secondary transition-colors"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="px-2 py-1 text-xs rounded bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-border bg-bg-panel/50 space-y-2">
          <input
            type="text"
            placeholder="Task title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded text-text-primary"
          />
          <div className="flex gap-2">
            <select
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value as AgentId)}
              className="px-2 py-1.5 text-xs bg-bg-secondary border border-border rounded text-text-primary"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
              <option value="cursor">Cursor</option>
              <option value="gemini">Gemini</option>
              <option value="qwen">Qwen</option>
            </select>
            <input
              type="text"
              placeholder="Prompt..."
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded text-text-primary"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1 text-xs rounded border border-border text-text-secondary hover:bg-bg-panel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createTask}
              disabled={!newTitle.trim()}
              className="px-3 py-1 text-xs rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 && (
          <div className="text-center text-text-muted mt-8">
            <p className="text-sm">No tasks in queue</p>
            <p className="text-xs mt-1">
              Tasks appear here from ~/agent-office/tasks.json
            </p>
          </div>
        )}

        {running.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-amber-400 uppercase tracking-wide mb-2">
              Running
            </div>
            <div className="space-y-2">
              {running.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-2">
              Pending
            </div>
            <div className="space-y-2">
              {pending.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-2">
              Completed
            </div>
            <div className="space-y-2">
              {done.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto-dispatch legend */}
      <div className="px-4 py-2 border-t border-border bg-bg-panel/50">
        <div className="text-[10px] text-text-muted leading-relaxed">
          <span className="font-medium text-text-secondary">Auto-dispatch:</span>{' '}
          research→Gemini, scrape/data→Qwen, edit/refactor→Cursor, generate/review→Codex,
          plan→Claude
        </div>
      </div>
    </div>
  );
}
