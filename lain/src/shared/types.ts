// Shared TypeScript types between main and renderer processes

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isActive: boolean;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  isPrivate?: boolean;
  zoomFactor?: number;
  isAudioPlaying?: boolean;
  isMuted?: boolean;
}

export interface Capsule {
  id: string;
  name: string;
  description?: string;
  version?: number;
  workspace?: {
    tabs: Tab[];
    activeTabId: string | null;
    ui: {
      sidebarOpen: boolean;
      terminalOpen: boolean;
      terminalHeight: number;
      showBookmarksBar: boolean;
      focusMode: boolean;
      focusBlocklist?: string[];
      focusDurationMin?: number;
    };
    terminal?: {
      cwd?: string;
      lastCommand?: string;
      settings?: any;
    };
    ai?: {
      messages?: Message[];
      settings?: any;
      currentConversationId?: string | null;
    };
  };
  created_at?: number;
  last_used?: number;
}

export interface TerminalSession {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface CommandHistoryEntry {
  id: number;
  command: string;
  output?: string;
  exit_code?: number;
  working_dir: string;
  executed_at: number;
  capsule_id?: string;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title?: string;
  visit_count: number;
  last_visit: number;
  favicon?: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  folder?: string;
  tags?: string[];
  created_at: number;
}

// ── Multi-Agent Types ──────────────────────────────────────────────────

export type AgentId = 'claude' | 'codex' | 'cursor' | 'gemini' | 'qwen';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export interface AgentInfo {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  icon: string; // emoji
  command: string; // CLI command to invoke
  capabilities: string[];
  delegateWhen: string;
  status: AgentStatus;
  lastSeen: number | null;
  pid: number | null;
}

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface AgentTask {
  id: string;
  title: string;
  agent: AgentId | string;
  status: TaskStatus;
  prompt: string;
  result?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AgentMessage {
  id: string;
  fromAgent: AgentId;
  toAgent: AgentId;
  content: string;
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
}
