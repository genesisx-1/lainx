import { EventEmitter } from 'events';
import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  AgentEvent,
  AgentTask,
  AgentTaskMode,
  AIMessage,
  AIMessageContent,
  ProviderId,
  ToolSchema,
} from '../../shared/types';
import { ProviderManager } from '../services/providers/manager';
import { ToolRegistry } from './tool-registry';
import { RendererBrowserDriver } from './renderer-driver';
import type { BrowserDriver, ToolContext } from './types';

interface StartTaskOpts {
  goal: string;
  mode?: AgentTaskMode;
  tabId?: string;
  provider?: ProviderId;
  withVision?: boolean;
  withPlanner?: boolean;
}

interface InternalTask extends AgentTask {
  paused: boolean;
  cancelled: boolean;
  awaitingUser?: { requestId: string; question: string; resolve: (s: string) => void };
  driver: BrowserDriver;
  messages: AIMessage[];
}

const MAX_STEPS = 30;
const RECENT_OBS_BLOCKS = 3; // keep last N tool_result blocks fully — older ones get trimmed

export class AgentOrchestrator extends EventEmitter {
  private tasks = new Map<string, InternalTask>();
  private toolRegistry = new ToolRegistry();
  private userResponseChannel: string;

  constructor(
    private readonly providers: ProviderManager,
    private readonly getWindow: () => BrowserWindow | null
  ) {
    super();
    this.userResponseChannel = IPC_CHANNELS.AGENT_RESPOND_USER;
    ipcMain.on(this.userResponseChannel, (_event, payload: { taskId: string; answer: string }) => {
      const t = this.tasks.get(payload.taskId);
      if (t?.awaitingUser) {
        const aw = t.awaitingUser;
        t.awaitingUser = undefined;
        t.status = 'running';
        aw.resolve(payload.answer);
      }
    });
  }

  registry() {
    return this.toolRegistry;
  }

  async start(opts: StartTaskOpts): Promise<AgentTask> {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const provider = opts.provider
      ? { id: opts.provider, provider: this.providers.get(opts.provider), models: this.providers.modelsFor(opts.provider) }
      : this.providers.getDefault();

    const driver = new RendererBrowserDriver(
      this.getWindow,
      () => opts.tabId || this.activeTabId()
    );

    const task: InternalTask = {
      id,
      goal: opts.goal,
      status: 'pending',
      mode: opts.mode || 'live',
      tabId: opts.tabId,
      provider: provider.id,
      models: provider.models,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalUsd: 0,
      stepCount: 0,
      paused: false,
      cancelled: false,
      driver,
      messages: [],
    };
    this.tasks.set(id, task);

    // Fire-and-forget; the loop emits events as it runs.
    this.runTask(task, { withVision: opts.withVision !== false, withPlanner: opts.withPlanner !== false }).catch((err) => {
      task.status = 'failed';
      this.emitEvent(task, 'task_failed', { error: err?.message || String(err) });
    });

    return this.publicTask(task);
  }

  pause(taskId: string) {
    const t = this.tasks.get(taskId);
    if (!t) return;
    t.paused = true;
    t.status = 'paused';
    this.emitEvent(t, 'paused', {});
  }

  resume(taskId: string) {
    const t = this.tasks.get(taskId);
    if (!t) return;
    t.paused = false;
    if (t.status === 'paused') t.status = 'running';
    this.emitEvent(t, 'resumed', {});
  }

  cancel(taskId: string) {
    const t = this.tasks.get(taskId);
    if (!t) return;
    t.cancelled = true;
    t.status = 'cancelled';
    if (t.awaitingUser) {
      const aw = t.awaitingUser;
      t.awaitingUser = undefined;
      aw.resolve('__cancelled__');
    }
    this.emitEvent(t, 'task_cancelled', {});
  }

  takeover(taskId: string) {
    const t = this.tasks.get(taskId);
    if (!t) return;
    t.paused = true;
    t.status = 'paused';
    this.emitEvent(t, 'user_takeover', {});
  }

  listTasks(): AgentTask[] {
    return Array.from(this.tasks.values()).map((t) => this.publicTask(t));
  }

  getTask(id: string): AgentTask | null {
    const t = this.tasks.get(id);
    return t ? this.publicTask(t) : null;
  }

  // --- internal -------------------------------------------------------------

  private activeTabId(): string | null {
    // The renderer is the source of truth for active tab; the orchestrator
    // generally receives a tabId from the caller. As a fallback, return null;
    // the renderer-driver will surface "no active tab" if it can't resolve.
    return null;
  }

  private publicTask(t: InternalTask): AgentTask {
    const { driver: _d, messages: _m, paused: _p, cancelled: _c, awaitingUser: _aw, ...rest } = t;
    return rest;
  }

  private emitEvent(task: InternalTask, type: AgentEvent['type'], data: any) {
    const evt: AgentEvent = {
      taskId: task.id,
      ts: Date.now(),
      type,
      data,
    };
    task.updatedAt = evt.ts;
    this.emit('event', evt);
    const win = this.getWindow();
    win?.webContents.send(IPC_CHANNELS.AGENT_EVENT, evt);
  }

  private async waitWhilePaused(task: InternalTask) {
    while (task.paused && !task.cancelled) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  private toolContext(task: InternalTask): ToolContext {
    return {
      taskId: task.id,
      driver: task.driver,
      emit: (type, data) => this.emitEvent(task, type as any, data),
      askUser: async (question: string) => {
        const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        task.status = 'awaiting_user';
        this.emitEvent(task, 'awaiting_user', { requestId, question });
        return new Promise<string>((resolve) => {
          task.awaitingUser = { requestId, question, resolve };
        });
      },
      shouldStop: () => task.paused || task.cancelled,
    };
  }

  private toolSchemas(): ToolSchema[] {
    return this.toolRegistry.schemas();
  }

  private async runTask(task: InternalTask, opts: { withVision: boolean; withPlanner: boolean }) {
    task.status = 'planning';
    this.emitEvent(task, 'task_started', { goal: task.goal, mode: task.mode, provider: task.provider });

    const provider = this.providers.get(task.provider);
    const tools = this.toolSchemas();
    const isRemote = task.provider !== 'ollama';
    const systemPrompt = buildSystemPrompt(task.goal, task.mode);

    // --- 1) Planner pass (cheap one-shot, no tools required) ---------------
    if (opts.withPlanner) {
      try {
        const planResp = await provider.chat(
          [{ role: 'user', content: `Goal: ${task.goal}\n\nReturn a numbered plan of 3-8 short steps. No commentary, just the numbered list.` }],
          { model: task.models.planner, maxTokens: 600, systemPrompt: 'You are a careful browser-automation planner. Output only a numbered list of concrete observable steps.', cacheSystem: isRemote }
        );
        task.totalUsd += planResp.usage.estimatedUsd || 0;
        this.emitEvent(task, 'plan', { plan: planResp.text, usage: planResp.usage });
        task.messages.push({ role: 'user', content: `Goal: ${task.goal}\n\nApproved plan:\n${planResp.text}` });
      } catch (e: any) {
        this.emitEvent(task, 'assistant_text', { text: `Planning failed (${e?.message || e}); proceeding without a plan.` });
        task.messages.push({ role: 'user', content: `Goal: ${task.goal}` });
      }
    } else {
      task.messages.push({ role: 'user', content: `Goal: ${task.goal}` });
    }

    task.status = 'running';

    // --- 2) Executor loop -------------------------------------------------
    for (let step = 0; step < MAX_STEPS; step++) {
      if (task.cancelled) return;
      await this.waitWhilePaused(task);
      if (task.cancelled) return;
      task.stepCount = step + 1;

      let resp;
      try {
        resp = await provider.chat(task.messages, {
          model: task.models.executor,
          maxTokens: 1500,
          tools,
          systemPrompt,
          cacheSystem: isRemote,
        });
        task.totalUsd += resp.usage.estimatedUsd || 0;
        this.emitEvent(task, 'cost', { usd: task.totalUsd, usage: resp.usage });
      } catch (e: any) {
        this.emitEvent(task, 'task_failed', { error: `LLM call failed: ${e?.message || e}` });
        task.status = 'failed';
        return;
      }

      // Save the assistant turn (with any tool_use blocks) so providers that
      // require alternating roles + tool_use/tool_result pairing stay happy.
      const assistantContent: AIMessageContent[] = resp.content.length
        ? resp.content
        : [{ type: 'text', text: resp.text || '' }];
      task.messages.push({ role: 'assistant', content: assistantContent });
      if (resp.text) this.emitEvent(task, 'assistant_text', { text: resp.text });

      // No tool calls? End-of-turn — assume done, especially if model said "done".
      if (resp.toolCalls.length === 0) {
        task.status = 'completed';
        this.emitEvent(task, 'task_completed', { summary: resp.text || 'Done.' });
        return;
      }

      // Execute tool calls in order, collecting tool_result blocks for the
      // next user turn.
      const userTurn: AIMessageContent[] = [];
      let sawDone = false;
      let doneSummary = '';
      for (const call of resp.toolCalls) {
        if (task.cancelled) return;
        await this.waitWhilePaused(task);
        const tool = this.toolRegistry.get(call.name);
        if (!tool) {
          this.emitEvent(task, 'tool_result', { name: call.name, ok: false, output: 'unknown tool' });
          userTurn.push({ type: 'tool_result', tool_use_id: call.id, content: `Unknown tool: ${call.name}`, is_error: true });
          continue;
        }
        this.emitEvent(task, 'tool_call', { name: call.name, input: call.input, id: call.id });
        const ctx = this.toolContext(task);
        let result;
        try {
          result = await tool.execute(call.input, ctx);
        } catch (e: any) {
          result = { ok: false, output: `Tool threw: ${e?.message || e}` };
        }
        this.emitEvent(task, 'tool_result', { name: call.name, ok: result.ok, output: result.output, id: call.id });

        if (call.name === 'task_done') {
          sawDone = true;
          doneSummary = result.output;
        }

        // If we have screenshot data from browser_observe or browser_screenshot,
        // attach it as an image block in the tool_result content so the model
        // can "see" it on the next turn (vision models only).
        let toolResultContent: string = result.output;
        if (opts.withVision && isRemote) {
          const data = (result.data as any) || {};
          if (data?.screenshot) {
            // For Anthropic, tool_result content can be a string; the image
            // must be sent in a follow-up user content block.
            toolResultContent = `${result.output}\n[screenshot attached as image]`;
            userTurn.push({ type: 'tool_result', tool_use_id: call.id, content: toolResultContent, is_error: !result.ok });
            userTurn.push({ type: 'image', data: data.screenshot, mediaType: 'image/png' });
            continue;
          }
          if (data?.elements && data?.screenshot === undefined && (data as any)?.screenshotData) {
            userTurn.push({ type: 'tool_result', tool_use_id: call.id, content: toolResultContent, is_error: !result.ok });
            continue;
          }
        }
        userTurn.push({ type: 'tool_result', tool_use_id: call.id, content: toolResultContent, is_error: !result.ok });
      }

      task.messages.push({ role: 'user', content: userTurn });
      this.trimMessages(task);

      if (sawDone) {
        task.status = 'completed';
        this.emitEvent(task, 'task_completed', { summary: doneSummary });
        return;
      }
    }

    task.status = 'failed';
    this.emitEvent(task, 'task_failed', { error: `Exceeded ${MAX_STEPS} steps without completing.` });
  }

  // Keep the context size in check by trimming older tool_result blocks down
  // to one-line summaries after they fall outside the recent window.
  private trimMessages(task: InternalTask) {
    const toolResultMsgIndices: number[] = [];
    task.messages.forEach((m, i) => {
      if (m.role === 'user' && Array.isArray(m.content) && m.content.some((c) => c.type === 'tool_result')) {
        toolResultMsgIndices.push(i);
      }
    });
    const toCompress = toolResultMsgIndices.slice(0, Math.max(0, toolResultMsgIndices.length - RECENT_OBS_BLOCKS));
    for (const idx of toCompress) {
      const m = task.messages[idx];
      if (!Array.isArray(m.content)) continue;
      m.content = m.content.map((c) => {
        if (c.type === 'tool_result') {
          const summary = (c.content || '').toString().split('\n')[0].slice(0, 160);
          return { type: 'tool_result', tool_use_id: c.tool_use_id, content: `(trimmed) ${summary}`, is_error: c.is_error };
        }
        if (c.type === 'image') return { type: 'text', text: '(image trimmed)' };
        return c;
      });
    }
  }
}

function buildSystemPrompt(goal: string, mode: AgentTaskMode): string {
  return [
    `You are LAIN, an autonomous browser agent operating in ${mode === 'headless' ? 'a background Chromium' : 'the user\'s live browser tab'}.`,
    `Your job is to fulfil the user goal by calling the provided tools. Always start with browser_observe to see the page.`,
    `Prefer clicking by index from the most recent observation. Re-observe after any action that can change the page.`,
    `When the goal is fulfilled, call task_done with a short summary. If you genuinely cannot proceed without clarification, call task_ask_user.`,
    `Do not invent element indices or selectors. If something fails, observe again and try a different approach.`,
    `The user goal is: ${goal}`,
  ].join('\n');
}
