import type { ToolImpl } from './types';

// Browser action tools. They all route through the BrowserDriver in ctx so the
// same tools work for the live <webview> driver and (later) the Playwright
// headless driver.

export const browserTools: ToolImpl[] = [
  {
    schema: {
      name: 'browser_observe',
      description:
        'Look at the current page. Returns the URL, title, plain text excerpt, a list of interactive elements with stable indices, and optionally a screenshot of the viewport. Call this at the start of every task and whenever the page may have changed.',
      input_schema: {
        type: 'object',
        properties: {
          with_screenshot: {
            type: 'boolean',
            description: 'Include a viewport screenshot. Default true for vision-capable models.',
          },
        },
      },
    },
    async execute(input, ctx) {
      const withScreenshot = input.with_screenshot !== false;
      const obs = await ctx.driver.observe({ withScreenshot });
      const summary =
        `URL: ${obs.url}\nTitle: ${obs.title}\n` +
        `Interactive elements (${obs.elements.length}):\n` +
        obs.elements
          .slice(0, 60)
          .map(
            (el) =>
              `  [${el.index}] ${el.tag}${el.type ? `(${el.type})` : ''}${el.role ? ` role=${el.role}` : ''}: ${JSON.stringify((el.text || el.placeholder || el.ariaLabel || '').slice(0, 80))}`
          )
          .join('\n') +
        `\n\nText excerpt:\n${(obs.text || '').slice(0, 1200)}`;
      return { ok: true, output: summary, data: obs };
    },
  },
  {
    schema: {
      name: 'browser_navigate',
      description: 'Open a URL in the current tab. Use this to start a task or to follow a link by URL.',
      input_schema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Absolute URL including scheme.' } },
        required: ['url'],
      },
    },
    async execute(input, ctx) {
      const url = String(input.url || '');
      if (!url) return { ok: false, output: 'No URL provided' };
      const r = await ctx.driver.navigate(url);
      return { ok: r.ok, output: r.message || (r.ok ? `Navigated to ${url}` : 'Navigation failed') };
    },
  },
  {
    schema: {
      name: 'browser_click',
      description:
        'Click an interactive element by the index returned from browser_observe. Prefer index over selector when possible.',
      input_schema: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Element index from the most recent observe().' },
          selector: { type: 'string', description: 'Optional CSS selector if no index is suitable.' },
        },
      },
    },
    async execute(input, ctx) {
      const r = await ctx.driver.click({
        index: typeof input.index === 'number' ? input.index : undefined,
        selector: typeof input.selector === 'string' ? input.selector : undefined,
      });
      return { ok: r.ok, output: r.message || (r.ok ? 'Clicked' : 'Click failed') };
    },
  },
  {
    schema: {
      name: 'browser_type',
      description:
        'Type text into an input/textarea by index (preferred) or CSS selector. Set submit=true to press Enter after.',
      input_schema: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          selector: { type: 'string' },
          text: { type: 'string' },
          submit: { type: 'boolean' },
        },
        required: ['text'],
      },
    },
    async execute(input, ctx) {
      const r = await ctx.driver.type({
        index: typeof input.index === 'number' ? input.index : undefined,
        selector: typeof input.selector === 'string' ? input.selector : undefined,
        text: String(input.text || ''),
        submit: Boolean(input.submit),
      });
      return { ok: r.ok, output: r.message || (r.ok ? 'Typed' : 'Type failed') };
    },
  },
  {
    schema: {
      name: 'browser_scroll',
      description: 'Scroll the page. direction one of up|down|top|bottom, or supply pixels (positive = down).',
      input_schema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
          pixels: { type: 'integer' },
        },
      },
    },
    async execute(input, ctx) {
      const r = await ctx.driver.scroll({
        direction: input.direction as any,
        pixels: typeof input.pixels === 'number' ? input.pixels : undefined,
      });
      return { ok: r.ok, output: r.message || 'Scrolled' };
    },
  },
  {
    schema: {
      name: 'browser_wait_for',
      description:
        'Wait until an element matches a selector, until text appears, or for a fixed ms. Maximum 10 seconds.',
      input_schema: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          text: { type: 'string' },
          ms: { type: 'integer' },
        },
      },
    },
    async execute(input, ctx) {
      const r = await ctx.driver.waitFor({
        selector: typeof input.selector === 'string' ? input.selector : undefined,
        text: typeof input.text === 'string' ? input.text : undefined,
        ms: typeof input.ms === 'number' ? Math.min(Math.max(input.ms, 100), 10_000) : undefined,
      });
      return { ok: r.ok, output: r.message || (r.ok ? 'Wait succeeded' : 'Wait timed out') };
    },
  },
  {
    schema: {
      name: 'browser_extract',
      description:
        'Return the visible text content matching a CSS selector. If no selector is given, returns the main page text (truncated).',
      input_schema: {
        type: 'object',
        properties: { selector: { type: 'string' } },
      },
    },
    async execute(input, ctx) {
      const r = await ctx.driver.extract({
        selector: typeof input.selector === 'string' ? input.selector : undefined,
      });
      return { ok: r.ok, output: r.text };
    },
  },
  {
    schema: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current viewport. Used when the agent needs to see the page visually.',
      input_schema: { type: 'object', properties: {} },
    },
    async execute(_input, ctx) {
      const r = await ctx.driver.screenshot();
      if (!r.ok || !r.data) return { ok: false, output: r.message || 'Screenshot failed' };
      // The data is returned to the orchestrator separately for vision; here we
      // just confirm to the model that it succeeded.
      return { ok: true, output: 'Screenshot captured.', data: { screenshot: r.data } };
    },
  },
  {
    schema: {
      name: 'task_done',
      description:
        'Call when the user goal has been fulfilled. Provide a short natural-language summary that will be shown to the user.',
      input_schema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
    async execute(input, _ctx) {
      return { ok: true, output: String(input.summary || 'Done.') };
    },
  },
  {
    schema: {
      name: 'task_ask_user',
      description:
        'Ask the user a clarifying question and wait for their reply. Use sparingly — only when proceeding is genuinely ambiguous.',
      input_schema: {
        type: 'object',
        properties: { question: { type: 'string' } },
        required: ['question'],
      },
    },
    async execute(input, ctx) {
      const answer = await ctx.askUser(String(input.question || ''));
      return { ok: true, output: answer };
    },
  },
];

export class ToolRegistry {
  private tools = new Map<string, ToolImpl>();

  constructor(initial: ToolImpl[] = browserTools) {
    for (const t of initial) this.tools.set(t.schema.name, t);
  }

  register(tool: ToolImpl) {
    this.tools.set(tool.schema.name, tool);
  }

  get(name: string): ToolImpl | undefined {
    return this.tools.get(name);
  }

  schemas() {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }
}
