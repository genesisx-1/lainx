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
}

export interface Capsule {
  id: string;
  name: string;
  description?: string;
  layout_config?: {
    browserWidth: number;
    terminalHeight: number;
    sidebarVisible: boolean;
  };
  pinned_tabs?: string[];
  ai_role?: string;
  tool_permissions?: Record<string, 'always' | 'ask' | 'never'>;
  hotkeys?: Record<string, string>;
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
