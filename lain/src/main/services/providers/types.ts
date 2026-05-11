import type {
  AIChatOptions,
  AIMessage,
  AIResponse,
  ModelPair,
  ProviderId,
} from '../../../shared/types';

export interface Provider {
  readonly id: ProviderId;
  readonly label: string;
  readonly requiresKey: boolean;
  readonly defaultModels: ModelPair;

  // Returns true if the provider is configured well enough to call (e.g. has key,
  // or Ollama server is reachable).
  isReady(): Promise<boolean>;

  // One-shot chat. Streaming is added later; for the agent loop we want the full
  // response (including tool_use blocks) before deciding the next step.
  chat(messages: AIMessage[], opts: AIChatOptions): Promise<AIResponse>;
}

export class ProviderError extends Error {
  readonly providerId: ProviderId;
  readonly status?: number;
  constructor(providerId: ProviderId, message: string, status?: number) {
    super(`[${providerId}] ${message}`);
    this.providerId = providerId;
    this.status = status;
    this.name = 'ProviderError';
  }
}

// Simple pricing table for token usage estimation. Prices in USD per 1M tokens.
// These are reasonable defaults — the orchestrator falls back to 0 if a model
// is not listed.
export const PRICING: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  // Anthropic
  'claude-opus-4-7': { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  // OpenAI
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // OpenRouter typically passes the upstream model id through; pricing varies
  'openrouter/auto': { input: 0, output: 0 },
  'deepseek/deepseek-chat-v3.1': { input: 0.27, output: 1.1 },
  'anthropic/claude-haiku-4-5': { input: 0.8, output: 4 },
  'anthropic/claude-sonnet-4-6': { input: 3, output: 15 },
  // Local / free
  'ollama-local': { input: 0, output: 0 },
};

export function estimateUsd(model: string, input: number, output: number, cacheRead = 0, cacheWrite = 0): number {
  const p = PRICING[model] || (model.startsWith('ollama:') ? PRICING['ollama-local'] : null);
  if (!p) return 0;
  return (
    (input / 1_000_000) * p.input +
    (output / 1_000_000) * p.output +
    (cacheRead / 1_000_000) * (p.cacheRead ?? 0) +
    (cacheWrite / 1_000_000) * (p.cacheWrite ?? 0)
  );
}
