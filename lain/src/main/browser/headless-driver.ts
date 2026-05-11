/// <reference lib="dom" />
import { app } from 'electron';
import * as path from 'path';
import type { BrowserDriver } from '../agent/types';
import type { AgentElement, AgentObservation } from '../../shared/types';

// Same action vocabulary as RendererBrowserDriver, but backed by Playwright
// running an off-screen Chromium. The user goes `npx playwright install
// chromium` once to fetch the binary. We lazy-require playwright-core so the
// renderer/main TS compile path doesn't hard-fail if the dep ever goes away.

interface PlaywrightModules {
  chromium: any;
}

let cached: PlaywrightModules | null = null;
function loadPlaywright(): PlaywrightModules | null {
  if (cached) return cached;
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = require('playwright-core');
    cached = { chromium: pw.chromium };
    return cached;
  } catch (e) {
    console.warn('[lain] playwright-core not loadable:', (e as Error).message);
    return null;
  }
}

export class HeadlessBrowserDriver implements BrowserDriver {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private launching: Promise<void> | null = null;

  private async ensure(): Promise<void> {
    if (this.page) return;
    if (this.launching) return this.launching;
    this.launching = (async () => {
      const pw = loadPlaywright();
      if (!pw) throw new Error('playwright-core not installed');
      const profileDir = path.join(app.getPath('userData'), 'headless-profile');
      this.context = await pw.chromium.launchPersistentContext(profileDir, {
        headless: true,
        viewport: { width: 1280, height: 800 },
      });
      const pages = this.context.pages();
      this.page = pages[0] || (await this.context.newPage());
      this.browser = this.context.browser?.() || null;
    })();
    try {
      await this.launching;
    } finally {
      this.launching = null;
    }
  }

  async isReady(): Promise<boolean> {
    return !!loadPlaywright();
  }

  async isDriving(): Promise<boolean> {
    return !!this.page;
  }

  async navigate(url: string): Promise<{ ok: boolean; message?: string }> {
    await this.ensure();
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return { ok: true, message: `Navigated to ${url}` };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'navigate failed' };
    }
  }

  async observe(opts?: { withScreenshot?: boolean }): Promise<AgentObservation> {
    await this.ensure();
    const url = this.page.url();
    const title = await this.page.title().catch(() => '');
    const text = (await this.page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')) || '';
    const elements: AgentElement[] = (await this.page.evaluate(() => {
      const out: any[] = [];
      const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [onclick]';
      const nodes = Array.from(document.querySelectorAll(selectors));
      let kept = 0;
      for (let i = 0; i < nodes.length && kept < 200; i++) {
        const el = nodes[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        out.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || (el as any).value || '').slice(0, 80).replace(/\s+/g, ' ').trim(),
          type: el.getAttribute('type'),
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
          role: el.getAttribute('role'),
          href: el.getAttribute('href'),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          visible: true,
        });
        kept++;
      }
      return out;
    })) as AgentElement[];
    let screenshot: string | undefined;
    if (opts?.withScreenshot !== false) {
      try {
        const buf: Buffer = await this.page.screenshot({ type: 'png', fullPage: false });
        screenshot = buf.toString('base64');
      } catch { /* ignore */ }
    }
    return { url, title, text: (text || '').slice(0, 6000), elements, screenshot };
  }

  async click(args: { index?: number; selector?: string }): Promise<{ ok: boolean; message?: string }> {
    await this.ensure();
    try {
      if (typeof args.selector === 'string') {
        await this.page.click(args.selector, { timeout: 5000 });
        return { ok: true, message: `Clicked ${args.selector}` };
      }
      if (typeof args.index === 'number') {
        const handle = await this.page.evaluateHandle((idx: number) => {
          const nodes = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [onclick]');
          return nodes[idx] || null;
        }, args.index);
        const el = handle.asElement();
        if (!el) return { ok: false, message: `No element at index ${args.index}` };
        await el.click({ timeout: 5000 });
        return { ok: true, message: `Clicked [${args.index}]` };
      }
      return { ok: false, message: 'No selector or index' };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'click failed' };
    }
  }

  async type(args: { index?: number; selector?: string; text: string; submit?: boolean }): Promise<{ ok: boolean; message?: string }> {
    await this.ensure();
    try {
      if (typeof args.selector === 'string') {
        await this.page.fill(args.selector, args.text, { timeout: 5000 });
        if (args.submit) await this.page.keyboard.press('Enter');
        return { ok: true, message: `Typed into ${args.selector}` };
      }
      if (typeof args.index === 'number') {
        const handle = await this.page.evaluateHandle((idx: number) => {
          const nodes = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [onclick]');
          return nodes[idx] || null;
        }, args.index);
        const el = handle.asElement();
        if (!el) return { ok: false, message: `No element at index ${args.index}` };
        await el.fill(args.text, { timeout: 5000 });
        if (args.submit) await this.page.keyboard.press('Enter');
        return { ok: true, message: `Typed into [${args.index}]` };
      }
      return { ok: false, message: 'No selector or index' };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'type failed' };
    }
  }

  async scroll(args: { direction?: 'up' | 'down' | 'top' | 'bottom'; pixels?: number }): Promise<{ ok: boolean; message?: string }> {
    await this.ensure();
    const dir = args.direction;
    const px = args.pixels;
    await this.page.evaluate(
      ({ dir, px }: { dir: any; px: any }) => {
        if (typeof px === 'number') return window.scrollBy(0, px);
        if (dir === 'top') return window.scrollTo({ top: 0 });
        if (dir === 'bottom') return window.scrollTo({ top: document.body.scrollHeight });
        if (dir === 'up') return window.scrollBy(0, -500);
        if (dir === 'down') return window.scrollBy(0, 500);
      },
      { dir, px }
    );
    return { ok: true, message: 'Scrolled' };
  }

  async waitFor(args: { selector?: string; text?: string; ms?: number }): Promise<{ ok: boolean; message?: string }> {
    await this.ensure();
    const timeout = Math.min(Math.max(args.ms || 3000, 100), 10_000);
    try {
      if (args.selector) {
        await this.page.waitForSelector(args.selector, { timeout });
        return { ok: true, message: `Selector appeared: ${args.selector}` };
      }
      if (args.text) {
        await this.page.waitForFunction(
          (t: string) => document.body && document.body.innerText.includes(t),
          args.text,
          { timeout }
        );
        return { ok: true, message: `Text appeared: ${args.text}` };
      }
      await new Promise((r) => setTimeout(r, timeout));
      return { ok: true, message: `Waited ${timeout}ms` };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'wait timed out' };
    }
  }

  async extract(args: { selector?: string }): Promise<{ ok: boolean; text: string }> {
    await this.ensure();
    const text = await this.page.evaluate((sel: string) => {
      if (sel) {
        const nodes = document.querySelectorAll(sel);
        return Array.from(nodes).map((n: any) => (n.innerText || n.textContent || '').trim()).filter(Boolean).join('\n').slice(0, 6000);
      }
      return (document.body ? document.body.innerText : '').slice(0, 6000);
    }, args.selector || '');
    return { ok: true, text };
  }

  async screenshot(): Promise<{ ok: boolean; data?: string; message?: string }> {
    await this.ensure();
    try {
      const buf: Buffer = await this.page.screenshot({ type: 'png', fullPage: false });
      return { ok: true, data: buf.toString('base64') };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'screenshot failed' };
    }
  }

  async listInteractive(): Promise<AgentElement[]> {
    const obs = await this.observe({ withScreenshot: false });
    return obs.elements;
  }

  async close() {
    try { await this.context?.close(); } catch { /* ignore */ }
    this.context = null;
    this.page = null;
    this.browser = null;
  }
}
