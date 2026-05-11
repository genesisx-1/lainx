import { spawn } from 'child_process';
import type {
  AIChatOptions,
  AIMessage,
  AIMessageContent,
  AIResponse,
  ModelPair,
} from '../../../shared/types';
import { Provider, ProviderError, estimateUsd } from './types';

// Ollama doesn't require a key. We talk to its local /api/chat endpoint. To
// keep the existing reliability characteristics, we fall back to curl when
// fetch fails (matches the legacy ai.service.ts behaviour).
export class OllamaProvider implements Provider {
  readonly id = 'ollama' as const;
  readonly label = 'Ollama (local)';
  readonly requiresKey = false;
  readonly defaultModels: ModelPair = {
    planner: 'qwen2.5:7b',
    executor: 'qwen2.5:3b',
  };
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async isReady(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/api/tags`);
      return r.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[], opts: AIChatOptions): Promise<AIResponse> {
    // Ollama's /api/chat takes role+content text only. We flatten our content
    // blocks to text, ignoring tool_use blocks (we emulate tools via JSON
    // instructions for local models).
    const flatMessages = messages.map((m) => ({
      role: m.role,
      content: flattenContent(m.content),
    }));

    let toolHint = '';
    if (opts.tools && opts.tools.length > 0) {
      const lines = opts.tools.map(
        (t) =>
          `- ${t.name}: ${t.description}\n  schema: ${JSON.stringify(t.input_schema.properties)}`
      );
      toolHint =
        `\n\nYou MUST respond with a single JSON object describing one tool call. ` +
        `Format: {"tool_name":"<name>","input":<object>} OR {"final":"<message to user>"}.\n` +
        `Available tools:\n${lines.join('\n')}`;
    }
    if (opts.systemPrompt || toolHint) {
      flatMessages.unshift({
        role: 'system',
        content: `${opts.systemPrompt || ''}${toolHint}`.trim(),
      });
    }

    const payload = {
      model: opts.model,
      messages: flatMessages,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.2,
      },
    };

    let json: any = null;
    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      json = await resp.json();
    } catch (fetchErr) {
      // Fallback to curl for older Electron / quirky environments
      json = await this.curlChat(payload);
      if (!json) {
        throw new ProviderError('ollama', `Failed to reach Ollama: ${(fetchErr as Error).message}`);
      }
    }

    const rawText = json?.message?.content || '';
    const inputTokens = json?.prompt_eval_count || 0;
    const outputTokens = json?.eval_count || 0;

    const content: AIMessageContent[] = [];
    const toolCalls: AIResponse['toolCalls'] = [];
    let stopReason: AIResponse['stopReason'] = 'end_turn';

    if (opts.tools && opts.tools.length > 0) {
      const parsed = extractJson(rawText);
      if (parsed && parsed.tool_name && opts.tools.find((t) => t.name === parsed.tool_name)) {
        const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const input = (parsed.input && typeof parsed.input === 'object') ? parsed.input : {};
        content.push({ type: 'tool_use', id, name: parsed.tool_name, input });
        toolCalls.push({ id, name: parsed.tool_name, input });
        stopReason = 'tool_use';
      } else if (parsed && typeof parsed.final === 'string') {
        content.push({ type: 'text', text: parsed.final });
      } else {
        content.push({ type: 'text', text: rawText });
      }
    } else if (rawText) {
      content.push({ type: 'text', text: rawText });
    }

    return {
      content,
      text: content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim(),
      toolCalls,
      stopReason,
      usage: {
        inputTokens,
        outputTokens,
        estimatedUsd: estimateUsd('ollama-local', inputTokens, outputTokens),
      },
      model: opts.model,
      provider: 'ollama',
    };
  }

  private curlChat(payload: any): Promise<any | null> {
    return new Promise((resolve) => {
      const proc = spawn('curl', [
        '-s',
        '-X', 'POST',
        `${this.baseUrl}/api/chat`,
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify(payload),
      ]);
      let stdout = '';
      proc.stdout.on('data', (b) => (stdout += b.toString()));
      proc.on('close', (code) => {
        if (code !== 0 || !stdout) return resolve(null);
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve(null);
        }
      });
      proc.on('error', () => resolve(null));
    });
  }
}

function flattenContent(content: AIMessage['content']): string {
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === 'text') parts.push(c.text);
    else if (c.type === 'tool_result') parts.push(`[tool ${c.tool_use_id} result] ${c.content}`);
    else if (c.type === 'tool_use')
      parts.push(`[tool call ${c.name}] ${JSON.stringify(c.input)}`);
    else if (c.type === 'image') parts.push(`[image omitted: local model]`);
  }
  return parts.join('\n').trim();
}

function extractJson(text: string): any | null {
  const trimmed = (text || '').trim();
  // try to find the first balanced JSON object
  const start = trimmed.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) {
        const candidate = trimmed.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
