import { pipeline, env } from '@huggingface/transformers';
import * as path from 'path';
import { app } from 'electron';
import { net } from 'electron';

// Configure transformers.js to use local models and Electron's net module
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.useCustomCache = true;
env.cacheDir = path.join(app.getPath('userData'), 'ai-models');

// Custom fetch using Electron's net module for better compatibility
const electronFetch = async (url: string, options?: RequestInit) => {
  const request = net.request({
    url,
    method: options?.method || 'GET',
    redirect: 'follow'
  });

  return new Promise<Response>((resolve, reject) => {
    request.on('response', (response) => {
      const chunks: Buffer[] = [];
      
      response.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mockResponse = new Response(buffer, {
          status: response.statusCode,
          headers: response.headers as any
        });
        resolve(mockResponse);
      });
      
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.end();
  });
};

// Override global fetch for transformers.js in main process
if (typeof global !== 'undefined') {
  (global as any).fetch = electronFetch;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class EmbeddedAIService {
  private textGenerator: any = null;
  private isInitialized = false;
  private modelName = 'Xenova/Qwen2.5-0.5B-Instruct'; // Tiny but capable model (500MB)

  /**
   * Initialize the AI model (lazy loading)
   */
  async initialize(onProgress?: (status: string, progress: number) => void): Promise<void> {
    if (this.isInitialized) return;

    try {
      onProgress?.('Loading AI model...', 0);

      // Load a small but capable text generation model
      this.textGenerator = await pipeline(
        'text-generation',
        this.modelName,
        {
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              const percent = progress.progress || 0;
              onProgress?.(`Downloading model... ${Math.round(percent)}%`, percent);
            } else if (progress.status === 'loading') {
              onProgress?.('Loading model into memory...', 90);
            }
          }
        }
      );

      this.isInitialized = true;
      onProgress?.('AI ready!', 100);
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      throw new Error('AI initialization failed');
    }
  }

  /**
   * Check if model is already downloaded
   */
  async isModelDownloaded(): Promise<boolean> {
    try {
      const modelPath = path.join(env.cacheDir, this.modelName);
      const fs = require('fs');
      return fs.existsSync(modelPath);
    } catch {
      return false;
    }
  }

  /**
   * Chat with the AI
   */
  async chat(messages: Message[], options?: { maxTokens?: number }): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert messages to a single prompt
    const prompt = this.formatMessagesToPrompt(messages);

    try {
      const result = await this.textGenerator(prompt, {
        max_new_tokens: options?.maxTokens || 512,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9,
      });

      // Extract generated text
      const generated = result[0]?.generated_text || '';
      
      // Remove the prompt from the response
      const response = generated.substring(prompt.length).trim();
      
      return response;
    } catch (error) {
      console.error('Chat error:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Summarize webpage content
   */
  async summarizePage(html: string, url: string): Promise<string> {
    const text = this.htmlToText(html);
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes web pages concisely in 2-3 sentences.'
      },
      {
        role: 'user',
        content: `Summarize this webpage (${url}):\n\n${text.slice(0, 2000)}`
      }
    ];

    return await this.chat(messages, { maxTokens: 200 });
  }

  /**
   * Explain terminal output
   */
  async explainTerminalOutput(output: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'You are a helpful terminal assistant. Explain command output clearly and concisely.'
      },
      {
        role: 'user',
        content: `Explain this terminal output:\n\n${output.slice(0, 1000)}`
      }
    ];

    return await this.chat(messages, { maxTokens: 300 });
  }

  /**
   * Format messages array into a prompt string
   */
  private formatMessagesToPrompt(messages: Message[]): string {
    let prompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }
    
    prompt += 'Assistant:';
    return prompt;
  }

  /**
   * Strip HTML to plain text
   */
  private htmlToText(html: string): string {
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.textGenerator = null;
    this.isInitialized = false;
  }
}
