import type {
  AIChatOptions,
  AIMessage,
  AIMessageContent,
  AIResponse,
  ModelPair,
  ProviderId,
} from '../../../shared/types';
import { Provider, ProviderError, estimateUsd } from './types';

type GetKey = () => string | null;

interface OpenAILikeConfig {
  id: ProviderId;
  label: string;
  endpoint: string;
  defaultModels: ModelPair;
  extraHeaders?: () => Record<string, string>;
}

// Generic OpenAI-compatible client. Used directly for OpenAI, and as the base
// for OpenRouter (which exposes the same /v1/chat/completions shape).
export class OpenAICompatibleProvider implements Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly requiresKey = true;
  readonly defaultModels: ModelPair;
  private readonly endpoint: string;
  private readonly extraHeaders: () => Record<string, string>;

  constructor(private readonly getKey: GetKey, cfg: OpenAILikeConfig) {
    this.id = cfg.id;
    this.label = cfg.label;
    this.endpoint = cfg.endpoint;
    this.defaultModels = cfg.defaultModels;
    this.extraHeaders = cfg.extraHeaders ?? (() => ({}));
  }

  async isReady(): Promise<boolean> {
    return !!this.getKey();
  }

  async chat(messages: AIMessage[], opts: AIChatOptions): Promise<AIResponse> {
    const key = this.getKey();
    if (!key) throw new ProviderError(this.id, 'API key not configured');

    const oaMessages = toOpenAIMessages(messages, opts.systemPrompt);
    const body: any = {
      model: opts.model,
      messages: oaMessages,
      max_tokens: opts.maxTokens ?? 4096,
    };
    if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        ...this.extraHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new ProviderError(this.id, `HTTP ${resp.status}: ${txt.slice(0, 400)}`, resp.status);
    }

    const data: any = await resp.json();
    const choice = data.choices?.[0];
    const msg = choice?.message || {};

    const content: AIMessageContent[] = [];
    if (typeof msg.content === 'string' && msg.content) {
      content.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') content.push({ type: 'text', text: part.text || '' });
      }
    }
    const toolCalls: AIResponse['toolCalls'] = [];
    for (const tc of msg.tool_calls || []) {
      let input: Record<string, unknown> = {};
      try {
        input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        input = { _raw: tc.function?.arguments };
      }
      content.push({ type: 'tool_use', id: tc.id, name: tc.function?.name || '', input });
      toolCalls.push({ id: tc.id, name: tc.function?.name || '', input });
    }
    const text = content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const stopReason: AIResponse['stopReason'] =
      choice?.finish_reason === 'tool_calls'
        ? 'tool_use'
        : choice?.finish_reason === 'length'
        ? 'max_tokens'
        : choice?.finish_reason === 'stop'
        ? 'end_turn'
        : 'end_turn';

    return {
      content,
      text,
      toolCalls,
      stopReason,
      usage: {
        inputTokens,
        outputTokens,
        estimatedUsd: estimateUsd(opts.model, inputTokens, outputTokens),
      },
      model: opts.model,
      provider: this.id,
    };
  }
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(getKey: GetKey) {
    super(getKey, {
      id: 'openai',
      label: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModels: { planner: 'gpt-4.1', executor: 'gpt-4.1-mini' },
    });
  }
}

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(getKey: GetKey) {
    super(getKey, {
      id: 'openrouter',
      label: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModels: {
        planner: 'anthropic/claude-sonnet-4-6',
        executor: 'deepseek/deepseek-chat-v3.1',
      },
      extraHeaders: () => ({
        'http-referer': 'https://lain.local',
        'x-title': 'LAIN Browser',
      }),
    });
  }
}

function toOpenAIMessages(messages: AIMessage[], explicitSystem?: string): any[] {
  const out: any[] = [];
  const systemTexts: string[] = [];
  if (explicitSystem) systemTexts.push(explicitSystem);
  for (const m of messages) {
    if (m.role === 'system') {
      if (typeof m.content === 'string') systemTexts.push(m.content);
      else
        for (const c of m.content) if (c.type === 'text') systemTexts.push(c.text);
      continue;
    }
  }
  if (systemTexts.length) out.push({ role: 'system', content: systemTexts.join('\n\n') });

  for (const m of messages) {
    if (m.role === 'system') continue;
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const toolUseBlocks = m.content.filter((c) => c.type === 'tool_use') as Array<{
      type: 'tool_use';
      id: string;
      name: string;
      input: any;
    }>;
    const toolResultBlocks = m.content.filter((c) => c.type === 'tool_result') as Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }>;
    const textBlocks = m.content.filter((c) => c.type === 'text') as Array<{ type: 'text'; text: string }>;
    const imageBlocks = m.content.filter((c) => c.type === 'image') as Array<{
      type: 'image';
      data: string;
      mediaType?: string;
    }>;

    if (m.role === 'assistant') {
      const assistantMsg: any = { role: 'assistant' };
      assistantMsg.content = textBlocks.map((t) => t.text).join('\n') || null;
      if (toolUseBlocks.length > 0) {
        assistantMsg.tool_calls = toolUseBlocks.map((b) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
        }));
      }
      out.push(assistantMsg);
      continue;
    }

    // user message
    if (toolResultBlocks.length > 0) {
      for (const r of toolResultBlocks) {
        out.push({
          role: 'tool',
          tool_call_id: r.tool_use_id,
          content: r.content,
        });
      }
    }
    if (textBlocks.length > 0 || imageBlocks.length > 0) {
      const parts: any[] = [];
      for (const t of textBlocks) parts.push({ type: 'text', text: t.text });
      for (const im of imageBlocks) {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${im.mediaType || 'image/png'};base64,${im.data}` },
        });
      }
      out.push({
        role: 'user',
        content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts,
      });
    }
  }

  return out;
}
