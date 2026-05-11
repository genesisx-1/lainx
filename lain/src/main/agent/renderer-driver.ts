import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { AgentElement, AgentObservation } from '../../shared/types';
import type { BrowserDriver } from './types';

interface PendingCall {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timeout: NodeJS.Timeout;
}

// Bridge that lets the main-process orchestrator drive the renderer-side
// <webview>. The renderer listens for BROWSER_AGENT_ACTION and replies via
// BROWSER_AGENT_ACTION + ':result'. We expose a small typed BrowserDriver API
// on top of that RPC.
export class RendererBrowserDriver implements BrowserDriver {
  private pending = new Map<string, PendingCall>();
  private replyChannel: string;
  private isPaused = false;

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly tabId: string | (() => string | null)
  ) {
    this.replyChannel = `${IPC_CHANNELS.BROWSER_AGENT_ACTION}:result`;
    ipcMain.on(this.replyChannel, (_event, payload: { requestId: string; result?: any; error?: string }) => {
      const p = this.pending.get(payload.requestId);
      if (!p) return;
      clearTimeout(p.timeout);
      this.pending.delete(payload.requestId);
      if (payload.error) p.reject(new Error(payload.error));
      else p.resolve(payload.result);
    });
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  async isDriving(): Promise<boolean> {
    return !this.isPaused;
  }

  async isReady(): Promise<boolean> {
    return !!this.getWindow() && !!this.resolveTabId();
  }

  private resolveTabId(): string | null {
    return typeof this.tabId === 'function' ? this.tabId() : this.tabId;
  }

  private call(action: string, args: any = {}, timeoutMs = 30_000): Promise<any> {
    const win = this.getWindow();
    if (!win) return Promise.reject(new Error('No window available'));
    const tabId = this.resolveTabId();
    if (!tabId) return Promise.reject(new Error('No active tab to drive'));
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error(`Browser action ${action} timed out`));
        }
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      win.webContents.send(IPC_CHANNELS.BROWSER_AGENT_ACTION, {
        requestId,
        tabId,
        action,
        args,
      });
    });
  }

  observe(opts?: { withScreenshot?: boolean }): Promise<AgentObservation> {
    return this.call('observe', { withScreenshot: opts?.withScreenshot !== false });
  }

  navigate(url: string): Promise<{ ok: boolean; message?: string }> {
    return this.call('navigate', { url });
  }

  click(args: { index?: number; selector?: string }): Promise<{ ok: boolean; message?: string }> {
    return this.call('click', args);
  }

  type(args: { index?: number; selector?: string; text: string; submit?: boolean }): Promise<{ ok: boolean; message?: string }> {
    return this.call('type', args);
  }

  scroll(args: { direction?: 'up' | 'down' | 'top' | 'bottom'; pixels?: number }): Promise<{ ok: boolean; message?: string }> {
    return this.call('scroll', args);
  }

  waitFor(args: { selector?: string; ms?: number; text?: string }): Promise<{ ok: boolean; message?: string }> {
    return this.call('waitFor', args, 12_000);
  }

  extract(args: { selector?: string }): Promise<{ ok: boolean; text: string }> {
    return this.call('extract', args);
  }

  screenshot(): Promise<{ ok: boolean; data?: string; message?: string }> {
    return this.call('screenshot', {}, 15_000);
  }

  listInteractive(): Promise<AgentElement[]> {
    return this.call('listInteractive', {});
  }
}
