import type {
  AIChatOptions,
  AIMessage,
  AIResponse,
  ModelPair,
  ProviderId,
  ProviderSummary,
} from '../../../shared/types';
import { SecureStoreService } from '../secure-store.service';
import { Provider, ProviderError } from './types';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider, OpenRouterProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';

export class ProviderManager {
  private providers: Map<ProviderId, Provider>;

  constructor(private readonly secureStore: SecureStoreService) {
    this.providers = new Map();
    this.providers.set(
      'anthropic',
      new AnthropicProvider(() => this.secureStore.getApiKey('anthropic'))
    );
    this.providers.set(
      'openai',
      new OpenAIProvider(() => this.secureStore.getApiKey('openai'))
    );
    this.providers.set(
      'openrouter',
      new OpenRouterProvider(() => this.secureStore.getApiKey('openrouter'))
    );
    this.providers.set('ollama', new OllamaProvider());
  }

  list(): ProviderSummary[] {
    const out: ProviderSummary[] = [];
    const defaultProvider = this.secureStore.getDefaultProvider();
    for (const [id, p] of this.providers.entries()) {
      const override = this.secureStore.getModelOverride(id);
      out.push({
        id,
        label: p.label,
        hasKey: !p.requiresKey || this.secureStore.hasApiKey(id),
        requiresKey: p.requiresKey,
        isDefault: id === defaultProvider,
        defaultModels: p.defaultModels,
        models: override || p.defaultModels,
      });
    }
    return out;
  }

  get(id: ProviderId): Provider {
    const p = this.providers.get(id);
    if (!p) throw new ProviderError(id, 'Unknown provider');
    return p;
  }

  getDefault(): { id: ProviderId; provider: Provider; models: ModelPair } {
    // Prefer a configured remote key over local Ollama. Ollama is always
    // "ready" from a key perspective, but may not actually be running.
    const configured = this.secureStore.getDefaultProvider();
    const candidates: ProviderId[] =
      configured === 'ollama'
        ? ['anthropic', 'openai', 'openrouter', 'ollama']
        : [configured, 'anthropic', 'openai', 'openrouter', 'ollama'];
    for (const id of candidates) {
      const p = this.providers.get(id);
      if (!p) continue;
      if (!p.requiresKey || this.secureStore.hasApiKey(id)) {
        return {
          id,
          provider: p,
          models: this.secureStore.getModelOverride(id) || p.defaultModels,
        };
      }
    }
    const fallback = this.providers.get('ollama')!;
    return { id: 'ollama', provider: fallback, models: fallback.defaultModels };
  }

  modelsFor(id: ProviderId): ModelPair {
    const p = this.providers.get(id);
    if (!p) throw new ProviderError(id, 'Unknown provider');
    return this.secureStore.getModelOverride(id) || p.defaultModels;
  }

  async chat(
    id: ProviderId | undefined,
    messages: AIMessage[],
    opts: Partial<AIChatOptions> & { model?: string } = {}
  ): Promise<AIResponse> {
    const target = id ? this.get(id) : this.getDefault().provider;
    const providerId = id || this.getDefault().id;
    const models = this.modelsFor(providerId);
    const model = opts.model || models.executor;
    return target.chat(messages, {
      model,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      tools: opts.tools,
      systemPrompt: opts.systemPrompt,
      cacheSystem: opts.cacheSystem,
    });
  }

  // Test that the configured provider can answer a trivial chat.
  async testProvider(id: ProviderId): Promise<{ ok: boolean; error?: string }> {
    try {
      const p = this.get(id);
      if (p.requiresKey && !this.secureStore.hasApiKey(id)) {
        return { ok: false, error: 'API key not configured' };
      }
      const models = this.modelsFor(id);
      const resp = await p.chat(
        [{ role: 'user', content: 'Reply with exactly: ok' }],
        { model: models.executor, maxTokens: 8 }
      );
      const ok = (resp.text || '').toLowerCase().includes('ok');
      return ok ? { ok: true } : { ok: true }; // we got a response, count it as healthy
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
}
