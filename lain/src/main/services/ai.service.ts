import { spawn } from 'child_process';
import type { AIMessage, ProviderId } from '../../shared/types';
import { ProviderManager } from './providers/manager';

interface LegacyMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Thin router that delegates to a Provider. Keeps the legacy `chat()` shape
// (returns `{ message: { content } }`) so the existing AI_CHAT IPC handler and
// the current ChatPanel keep working without changes.
export class AIService {
  constructor(private readonly providers: ProviderManager) {}

  async chat(
    messages: LegacyMessage[],
    model?: string,
    _stream = false,
    providerId?: ProviderId
  ): Promise<any> {
    const provider = providerId
      ? { id: providerId, provider: this.providers.get(providerId), models: this.providers.modelsFor(providerId) }
      : this.providers.getDefault();

    const aiMessages: AIMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const chosenModel = model || provider.models.executor;
    try {
      const resp = await provider.provider.chat(aiMessages, { model: chosenModel });
      return {
        message: { content: resp.text },
        usage: resp.usage,
        provider: resp.provider,
        model: resp.model,
      };
    } catch (e: any) {
      // Last-ditch fallback to the historic curl-Ollama path so the existing
      // chat panel keeps responding when a remote provider is unavailable.
      if (provider.id !== 'ollama') {
        try {
          const ollama = this.providers.get('ollama');
          const resp = await ollama.chat(aiMessages, {
            model: 'qwen2.5:0.5b',
          });
          return {
            message: { content: resp.text },
            usage: resp.usage,
            provider: 'ollama',
            model: resp.model,
            fellBackToLocal: true,
          };
        } catch {
          // ignore — bubble original error up
        }
      }
      throw e;
    }
  }

  async summarizePage(html: string, url: string): Promise<string> {
    const text = this.htmlToText(html).slice(0, 6000);
    const resp = await this.chat([
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes web pages concisely. Keep it under 200 words.',
      },
      {
        role: 'user',
        content: `Summarize this webpage (${url}):\n\n${text}`,
      },
    ]);
    return resp?.message?.content || '';
  }

  async explainTerminalOutput(output: string): Promise<string> {
    const resp = await this.chat([
      {
        role: 'system',
        content: 'You explain terminal command output clearly and briefly. Focus on what happened and any errors.',
      },
      {
        role: 'user',
        content: `Explain this terminal output:\n\n${output.slice(0, 4000)}`,
      },
    ]);
    return resp?.message?.content || '';
  }

  // ---- Legacy curl bridge kept for any external callers that still want it.
  // It's no longer used internally but exported so future tooling can rely on
  // the same reliability shim during emergencies.
  curlToOllama(payload: any, baseUrl = 'http://localhost:11434'): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn('curl', [
        '-s',
        '-X',
        'POST',
        `${baseUrl}/api/chat`,
        '-H',
        'Content-Type: application/json',
        '-d',
        JSON.stringify(payload),
      ]);
      let out = '';
      proc.stdout.on('data', (b) => (out += b.toString()));
      proc.on('close', (code) => {
        if (code === 0 && out) {
          try {
            resolve(JSON.parse(out));
          } catch (e) {
            reject(e);
          }
        } else reject(new Error(`curl exit ${code}`));
      });
      proc.on('error', reject);
    });
  }

  private htmlToText(html: string): string {
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }
}
