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

// ---------------------------------------------------------------------------
// Multi-provider AI + agent
// ---------------------------------------------------------------------------

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'ollama';

export interface ModelPair {
  planner: string;
  executor: string;
}

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  hasKey: boolean;
  models: ModelPair;
  baseUrl?: string;
}

export interface ProviderSummary {
  id: ProviderId;
  label: string;
  hasKey: boolean;
  requiresKey: boolean;
  isDefault: boolean;
  defaultModels: ModelPair;
  models: ModelPair;
  baseUrl?: string;
}

// Vendor-neutral message format the providers all consume
export interface AIMessageContentText {
  type: 'text';
  text: string;
}
export interface AIMessageContentImage {
  type: 'image';
  // PNG base64 (no data: prefix)
  data: string;
  mediaType?: 'image/png' | 'image/jpeg' | 'image/webp';
}
export interface AIMessageContentToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface AIMessageContentToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type AIMessageContent =
  | AIMessageContentText
  | AIMessageContentImage
  | AIMessageContentToolUse
  | AIMessageContentToolResult;

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AIMessageContent[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AIChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolSchema[];
  systemPrompt?: string;
  cacheSystem?: boolean;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  estimatedUsd?: number;
}

export interface AIResponse {
  // The full response content (text + tool_use blocks)
  content: AIMessageContent[];
  // Flattened text for convenience
  text: string;
  // Tool calls the model wants us to execute
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  // Reason the model stopped: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'error'
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'error';
  usage: AIUsage;
  model: string;
  provider: ProviderId;
}

// Agent task/run lifecycle
export type AgentTaskStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'paused'
  | 'awaiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentTaskMode = 'live' | 'headless';

export interface AgentTask {
  id: string;
  goal: string;
  status: AgentTaskStatus;
  mode: AgentTaskMode;
  tabId?: string;
  provider: ProviderId;
  models: ModelPair;
  createdAt: number;
  updatedAt: number;
  totalUsd: number;
  stepCount: number;
}

export interface AgentEvent {
  taskId: string;
  ts: number;
  // Possible event shapes
  type:
    | 'task_started'
    | 'plan'
    | 'observation'
    | 'tool_call'
    | 'tool_result'
    | 'assistant_text'
    | 'cost'
    | 'paused'
    | 'resumed'
    | 'user_takeover'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'awaiting_user';
  data: any;
}

export interface AgentElement {
  index: number;
  tag: string;
  text: string;
  type?: string | null;
  placeholder?: string | null;
  ariaLabel?: string | null;
  role?: string | null;
  href?: string | null;
  rect?: { x: number; y: number; width: number; height: number };
  visible?: boolean;
}

export interface AgentObservation {
  url: string;
  title: string;
  // Truncated plain text
  text: string;
  elements: AgentElement[];
  // PNG base64 of viewport (optional, only when vision is enabled)
  screenshot?: string;
  // Pixel size of the viewport
  viewport?: { width: number; height: number };
}

export interface ControlServerInfo {
  enabled: boolean;
  url: string;
  token: string;
  port: number;
}
