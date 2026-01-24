import { spawn } from 'child_process';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private ollamaBaseUrl = 'http://localhost:11434';

  async chat(messages: Message[], model = 'llama3.2', stream = false) {
    // Use curl via child process - more reliable than Node fetch in Electron
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model,
        messages,
        stream: false
      });

      console.log(`[AIService] Sending chat request to Ollama with model: ${model}`);
      
      const curlProcess = spawn('curl', [
        '-s',
        '-X', 'POST',
        `${this.ollamaBaseUrl}/api/chat`,
        '-H', 'Content-Type: application/json',
        '-d', payload
      ]);

      let stdout = '';
      let stderr = '';

      curlProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      curlProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      curlProcess.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            console.log(`[AIService] Got response:`, result.message?.content?.slice(0, 100));
            resolve(result);
          } catch (e) {
            console.error('[AIService] Failed to parse response:', stdout.slice(0, 200));
            reject(new Error('Failed to parse Ollama response'));
          }
        } else {
          console.error('[AIService] Curl failed:', stderr || `exit code ${code}`);
          reject(new Error(`Ollama chat failed: ${stderr || 'unknown error'}`));
        }
      });

      curlProcess.on('error', (err) => {
        console.error('[AIService] Curl process error:', err);
        reject(err);
      });
    });
  }

  async getPageContext(url: string, html: string) {
    // Strip HTML to readable text
    const text = this.htmlToText(html);
    return {
      url,
      content: text.slice(0, 4000) // Token limit
    };
  }

  async summarizePage(html: string, url: string): Promise<string> {
    const text = this.htmlToText(html);
    const response: any = await this.chat([
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes web pages concisely.'
      },
      {
        role: 'user',
        content: `Summarize this webpage (${url}):\n\n${text.slice(0, 4000)}`
      }
    ]);

    return response.message?.content || '';
  }

  async explainTerminalOutput(output: string): Promise<string> {
    const response: any = await this.chat([
      {
        role: 'system',
        content: 'You are a helpful terminal assistant that explains command output.'
      },
      {
        role: 'user',
        content: `Explain this terminal output:\n\n${output}`
      }
    ]);

    return response.message?.content || '';
  }

  private htmlToText(html: string): string {
    // Remove scripts, styles
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }
}
