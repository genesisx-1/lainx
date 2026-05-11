import type {
  AIChatOptions,
  AIMessage,
  AIMessageContent,
  AIResponse,
  ModelPair,
} from '../../../shared/types';
import { Provider, ProviderError, estimateUsd } from './types';

type GetKey = () => string | null;

export class AnthropicProvider implements Provider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic';
  readonly requiresKey = true;
  readonly defaultModels: ModelPair = {
    planner: 'claude-opus-4-7',
    executor: 'claude-sonnet-4-6',
  };

  private readonly endpoint = 'https://api.anthropic.com/v1/messages';
  private readonly apiVersion = '2023-06-01';

  constructor(private readonly getKey: GetKey) {}

  async isReady(): Promise<boolean> {
    return !!this.getKey();
  }

  async chat(messages: AIMessage[], opts: AIChatOptions): Promise<AIResponse> {
    const key = this.getKey();
    if (!key) throw new ProviderError('anthropic', 'API key not configured');

    const system = collectSystem(messages, opts.systemPrompt);
    const conversation = messages.filter((m) => m.role !== 'system').map(toAnthropicMessage);

    const body: any = {
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      messages: conversation,
    };
    if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
    if (system) {
      body.system = opts.cacheSystem
        ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
        : system;
    }
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new ProviderError('anthropic', `HTTP ${resp.status}: ${txt.slice(0, 400)}`, resp.status);
    }

    const data: any = await resp.json();
    const content: AIMessageContent[] = (data.content || []).map((b: any): AIMessageContent => {
      if (b.type === 'text') return { type: 'text', text: b.text || '' };
      if (b.type === 'tool_use') {
        return { type: 'tool_use', id: b.id, name: b.name, input: b.input || {} };
      }
      return { type: 'text', text: '' };
    });
    const text = content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const toolCalls = content
      .filter((b): b is { type: 'tool_use'; id: string; name: string; input: any } => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
    const cacheCreate = data.usage?.cache_creation_input_tokens ?? 0;
    return {
      content,
      text,
      toolCalls,
      stopReason: (data.stop_reason as AIResponse['stopReason']) || 'end_turn',
      usage: {
        inputTokens,
        outputTokens,
        cacheReadTokens: cacheRead,
        cacheCreationTokens: cacheCreate,
        estimatedUsd: estimateUsd(opts.model, inputTokens, outputTokens, cacheRead, cacheCreate),
      },
      model: opts.model,
      provider: 'anthropic',
    };
  }
}

function collectSystem(messages: AIMessage[], explicit?: string): string {
  const parts: string[] = [];
  if (explicit) parts.push(explicit);
  for (const m of messages) {
    if (m.role !== 'system') continue;
    if (typeof m.content === 'string') parts.push(m.content);
    else
      for (const c of m.content) {
        if (c.type === 'text') parts.push(c.text);
      }
  }
  return parts.filter(Boolean).join('\n\n');
}

function toAnthropicMessage(m: AIMessage): any {
  if (typeof m.content === 'string') {
    return { role: m.role, content: m.content };
  }
  const blocks = m.content.map((b): any => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    if (b.type === 'image') {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: b.mediaType || 'image/png',
          data: b.data,
        },
      };
    }
    if (b.type === 'tool_use') {
      return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
    }
    if (b.type === 'tool_result') {
      return {
        type: 'tool_result',
        tool_use_id: b.tool_use_id,
        content: b.content,
        ...(b.is_error ? { is_error: true } : {}),
      };
    }
    return { type: 'text', text: '' };
  });
  return { role: m.role, content: blocks };
}
