interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private ollamaBaseUrl = 'http://localhost:11434';

  async chat(messages: Message[], model = 'llama3.2', stream = false) {
    const response = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream
      })
    });

    if (stream) {
      return response.body; // Return readable stream
    }

    return await response.json();
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
