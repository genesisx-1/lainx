import { create } from 'zustand';
import type { AgentId, AgentInfo, AgentStatus, AgentTask } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// Agent definitions matching CLAUDE.md
const AGENT_DEFS: AgentInfo[] = [
  {
    id: 'claude',
    name: 'Claude',
    role: 'Commander',
    color: '#8b5cf6', // purple
    icon: 'C',
    command: 'claude',
    capabilities: ['Full-stack dev', 'Architecture', 'Planning', 'Code review'],
    delegateWhen: 'Default handler — owns every task end-to-end',
    status: 'offline',
    lastSeen: null,
    pid: null,
  },
  {
    id: 'codex',
    name: 'Codex',
    role: 'XO (Second-in-Command)',
    color: '#10b981', // green
    icon: 'X',
    command: 'codex',
    capabilities: ['Code generation', 'Code review', 'Backend logic', 'Module implementation'],
    delegateWhen: 'Full module implementation or code review of a diff',
    status: 'offline',
    lastSeen: null,
    pid: null,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    role: 'Engineer',
    color: '#3b82f6', // blue
    icon: 'R',
    command: 'agent',
    capabilities: ['Multi-file refactor', 'Targeted edits', 'Frontend', 'Codebase context'],
    delegateWhen: 'Multi-file refactor with codebase context; targeted edits across a repo',
    status: 'offline',
    lastSeen: null,
    pid: null,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    role: 'Research',
    color: '#f59e0b', // amber
    icon: 'G',
    command: 'gemini',
    capabilities: ['Research', 'Documentation', 'Knowledge lookups', 'Architecture opinions'],
    delegateWhen: 'Need research on a library/API/pattern; want a second opinion',
    status: 'offline',
    lastSeen: null,
    pid: null,
  },
  {
    id: 'qwen',
    name: 'Qwen',
    role: 'Data Lab',
    color: '#ef4444', // red
    icon: 'Q',
    command: 'qwen',
    capabilities: ['Python scripts', 'Web scraping', 'Data processing', 'CRM operations'],
    delegateWhen: 'Python scripts, web scraping, data processing, CRM database work',
    status: 'offline',
    lastSeen: null,
    pid: null,
  },
];

type SidebarTab = 'chat' | 'agents' | 'tasks';

interface AgentsState {
  agents: AgentInfo[];
  tasks: AgentTask[];
  activeAgent: AgentId;
  sidebarTab: SidebarTab;
  isPolling: boolean;
  lastPollAt: number | null;

  // Actions
  setSidebarTab: (tab: SidebarTab) => void;
  setActiveAgent: (id: AgentId) => void;
  updateAgentStatus: (id: AgentId, status: AgentStatus, pid: number | null) => void;
  setTasks: (tasks: AgentTask[]) => void;
  addTask: (task: AgentTask) => void;
  updateTask: (id: string, updates: Partial<AgentTask>) => void;
  pollStatuses: () => Promise<void>;
  pollTasks: () => Promise<void>;
  runAgentCommand: (agentId: AgentId, prompt: string) => Promise<string>;
}

export const useAgentsStore = create<AgentsState>((set, _get) => ({
  agents: AGENT_DEFS,
  tasks: [],
  activeAgent: 'claude',
  sidebarTab: 'chat',
  isPolling: false,
  lastPollAt: null,

  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setActiveAgent: (id) => set({ activeAgent: id }),

  updateAgentStatus: (id, status, pid) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id
          ? { ...a, status, pid, lastSeen: status === 'online' ? Date.now() : a.lastSeen }
          : a
      ),
    })),

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  pollStatuses: async () => {
    try {
      set({ isPolling: true });
      const statuses = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AGENT_CHECK_STATUS
      );
      if (statuses && typeof statuses === 'object') {
        set((s) => ({
          agents: s.agents.map((a) => {
            const st = statuses[a.id];
            if (!st) return a;
            return {
              ...a,
              status: st.status,
              pid: st.pid,
              lastSeen: st.status === 'online' ? Date.now() : a.lastSeen,
            };
          }),
          lastPollAt: Date.now(),
        }));
      }
    } catch (err) {
      console.error('[AgentsStore] Failed to poll statuses:', err);
    } finally {
      set({ isPolling: false });
    }
  },

  pollTasks: async () => {
    try {
      const tasks = await window.electron.ipcRenderer.invoke(IPC_CHANNELS.AGENT_GET_TASKS);
      if (Array.isArray(tasks)) {
        set({ tasks });
      }
    } catch (err) {
      console.error('[AgentsStore] Failed to poll tasks:', err);
    }
  },

  runAgentCommand: async (agentId: AgentId, prompt: string) => {
    set((s) => ({
      agents: s.agents.map((a) => (a.id === agentId ? { ...a, status: 'busy' } : a)),
    }));
    try {
      const result = await window.electron.ipcRenderer.invoke(
        IPC_CHANNELS.AGENT_RUN_COMMAND,
        agentId,
        prompt
      );
      set((s) => ({
        agents: s.agents.map((a) => (a.id === agentId ? { ...a, status: 'online' } : a)),
      }));
      return result || '';
    } catch (err: any) {
      set((s) => ({
        agents: s.agents.map((a) => (a.id === agentId ? { ...a, status: 'error' } : a)),
      }));
      throw err;
    }
  },
}));
