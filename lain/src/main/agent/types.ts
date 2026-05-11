import type { AgentElement, AgentObservation, ToolSchema } from '../../shared/types';

export interface BrowserDriver {
  // True if this driver can act right now (e.g. has an active tab).
  isReady(): Promise<boolean>;
  observe(opts?: { withScreenshot?: boolean }): Promise<AgentObservation>;
  navigate(url: string): Promise<{ ok: boolean; message?: string }>;
  click(args: { index?: number; selector?: string }): Promise<{ ok: boolean; message?: string }>;
  type(args: { index?: number; selector?: string; text: string; submit?: boolean }): Promise<{ ok: boolean; message?: string }>;
  scroll(args: { direction?: 'up' | 'down' | 'top' | 'bottom'; pixels?: number }): Promise<{ ok: boolean; message?: string }>;
  waitFor(args: { selector?: string; ms?: number; text?: string }): Promise<{ ok: boolean; message?: string }>;
  extract(args: { selector?: string }): Promise<{ ok: boolean; text: string }>;
  screenshot(): Promise<{ ok: boolean; data?: string; message?: string }>;
  listInteractive(): Promise<AgentElement[]>;
  // Optional: returning false from this means "agent is paused or user took over"
  isDriving(): Promise<boolean>;
}

export interface ToolContext {
  taskId: string;
  driver: BrowserDriver;
  emit: (type: string, data: any) => void;
  askUser: (question: string, choices?: string[]) => Promise<string>;
  // Returns true if the user pressed pause / cancel / took over
  shouldStop: () => boolean;
}

export interface ToolImpl {
  schema: ToolSchema;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<{ ok: boolean; output: string; data?: any }>;
  // If true, the orchestrator should prompt the user before executing.
  dangerous?: boolean;
}
