import * as http from 'http';
import * as crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { AgentOrchestrator } from '../agent/orchestrator';
import { ProviderManager } from '../services/providers/manager';
import { SecureStoreService } from '../services/secure-store.service';
import type { AgentEvent, ProviderId } from '../../shared/types';

interface SseClient {
  res: ServerResponse;
  taskId?: string;
}

// Tiny local HTTP server bound to 127.0.0.1 that lets a CLI (or any script)
// drive the running browser. Auth: Authorization: Bearer <token>.
// Streaming: server-sent events at /v1/events (or /v1/tasks/:id/events) — no
// extra `ws` dependency needed.
export class ControlServer {
  private server: http.Server | null = null;
  private sseClients = new Set<SseClient>();

  constructor(
    private readonly orchestrator: AgentOrchestrator,
    private readonly providers: ProviderManager,
    private readonly secureStore: SecureStoreService
  ) {
    this.orchestrator.on('event', (evt: AgentEvent) => {
      this.broadcast(evt);
    });
  }

  start() {
    const cfg = this.secureStore.getControlServerConfig();
    if (!cfg.enabled) return;
    if (!cfg.token) {
      // Generate a token on first enable.
      const token = `lain_${crypto.randomBytes(18).toString('hex')}`;
      this.secureStore.setControlServerConfig({ token });
    }
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.listen(cfg.port, '127.0.0.1', () => {
      console.log(`[lain] control server listening on http://127.0.0.1:${cfg.port}`);
    });
    this.server.on('error', (err) => {
      console.error('[lain] control server error:', err.message);
    });
  }

  stop() {
    if (!this.server) return;
    for (const c of this.sseClients) {
      try { c.res.end(); } catch { /* ignore */ }
    }
    this.sseClients.clear();
    this.server.close();
    this.server = null;
  }

  restart() {
    this.stop();
    this.start();
  }

  private broadcast(evt: AgentEvent) {
    const data = `event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;
    for (const c of this.sseClients) {
      if (c.taskId && c.taskId !== evt.taskId) continue;
      try {
        c.res.write(data);
      } catch { /* ignore broken pipe */ }
    }
  }

  private authorized(req: IncomingMessage): boolean {
    const cfg = this.secureStore.getControlServerConfig();
    if (!cfg.token) return false;
    const header = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(String(header));
    if (!m) {
      // Allow ?token=... for SSE convenience (EventSource can't set headers).
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const token = url.searchParams.get('token');
      if (token && token === cfg.token) return true;
      return false;
    }
    return m[1] === cfg.token;
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization,content-type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/v1' || path === '/v1/health') {
      return this.json(res, 200, { ok: true, name: 'lain-control', version: 1 });
    }

    if (!this.authorized(req)) {
      return this.json(res, 401, { error: 'unauthorized' });
    }

    try {
      if (path === '/v1/providers' && req.method === 'GET') {
        return this.json(res, 200, this.providers.list());
      }
      if (path === '/v1/tasks' && req.method === 'POST') {
        const body = await readBody(req);
        const task = await this.orchestrator.start({
          goal: String(body?.goal || ''),
          mode: body?.mode === 'headless' ? 'headless' : 'live',
          tabId: typeof body?.tab_id === 'string' ? body.tab_id : undefined,
          provider: body?.provider as ProviderId | undefined,
          withVision: body?.with_vision !== false,
          withPlanner: body?.with_planner !== false,
        });
        return this.json(res, 200, task);
      }
      if (path === '/v1/tasks' && req.method === 'GET') {
        return this.json(res, 200, this.orchestrator.listTasks());
      }
      const taskMatch = /^\/v1\/tasks\/([^/]+)(\/.*)?$/.exec(path);
      if (taskMatch) {
        const taskId = decodeURIComponent(taskMatch[1]);
        const sub = taskMatch[2] || '';
        if (sub === '' && req.method === 'GET') {
          const t = this.orchestrator.getTask(taskId);
          return this.json(res, t ? 200 : 404, t || { error: 'not found' });
        }
        if (sub === '/pause' && req.method === 'POST') { this.orchestrator.pause(taskId); return this.json(res, 200, { ok: true }); }
        if (sub === '/resume' && req.method === 'POST') { this.orchestrator.resume(taskId); return this.json(res, 200, { ok: true }); }
        if (sub === '/cancel' && req.method === 'POST') { this.orchestrator.cancel(taskId); return this.json(res, 200, { ok: true }); }
        if (sub === '/events' && req.method === 'GET') {
          return this.startSse(res, taskId);
        }
      }
      if (path === '/v1/events' && req.method === 'GET') {
        return this.startSse(res);
      }
      return this.json(res, 404, { error: 'not found', path });
    } catch (e: any) {
      return this.json(res, 500, { error: e?.message || String(e) });
    }
  }

  private startSse(res: ServerResponse, taskId?: string) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    res.write(': lain control event stream\n\n');
    const client: SseClient = { res, taskId };
    this.sseClients.add(client);
    res.on('close', () => this.sseClients.delete(client));
  }

  private json(res: ServerResponse, status: number, body: any) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c.toString()));
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
