import { desktopCapturer, screen } from 'electron';
import { spawn } from 'child_process';

// Cross-platform computer-use. Mouse/keyboard come from `@nut-tree-fork/nut-js`
// when installed (npm i @nut-tree-fork/nut-js), otherwise the methods reply
// with a clear "not installed" error. Screenshots use Electron's
// `desktopCapturer` so they always work on every OS we ship.

let nutModule: any | null = null;
let nutTried = false;
function loadNut(): any | null {
  if (nutTried) return nutModule;
  nutTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nutModule = require('@nut-tree-fork/nut-js');
  } catch {
    try {
      // fallback to legacy package name if present
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nutModule = require('@nut-tree/nut-js');
    } catch {
      nutModule = null;
    }
  }
  return nutModule;
}

export class ComputerService {
  enabled = false; // gated by user consent

  async screenshot(): Promise<{ ok: boolean; data?: string; message?: string }> {
    try {
      const primary = screen.getPrimaryDisplay();
      const { width, height } = primary.size;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height },
      });
      const src = sources.find((s) => s.display_id === String(primary.id)) || sources[0];
      if (!src) return { ok: false, message: 'No screen source available' };
      const url = src.thumbnail.toDataURL();
      const comma = url.indexOf(',');
      return { ok: true, data: comma >= 0 ? url.slice(comma + 1) : url };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'screenshot failed' };
    }
  }

  async mouseMove(x: number, y: number): Promise<{ ok: boolean; message?: string }> {
    const nut = loadNut();
    if (!nut) return { ok: false, message: 'computer-use deps not installed (npm i @nut-tree-fork/nut-js)' };
    try {
      await nut.mouse.setPosition(new nut.Point(x, y));
      return { ok: true, message: `mouse → (${x},${y})` };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  async mouseClick(button: 'left' | 'right' | 'middle' = 'left'): Promise<{ ok: boolean; message?: string }> {
    const nut = loadNut();
    if (!nut) return { ok: false, message: 'computer-use deps not installed' };
    try {
      const map: any = { left: nut.Button.LEFT, right: nut.Button.RIGHT, middle: nut.Button.MIDDLE };
      await nut.mouse.click(map[button]);
      return { ok: true, message: `click ${button}` };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  async typeText(text: string): Promise<{ ok: boolean; message?: string }> {
    const nut = loadNut();
    if (!nut) return { ok: false, message: 'computer-use deps not installed' };
    try {
      await nut.keyboard.type(text);
      return { ok: true, message: `typed ${text.length} chars` };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  async keyCombo(combo: string): Promise<{ ok: boolean; message?: string }> {
    const nut = loadNut();
    if (!nut) return { ok: false, message: 'computer-use deps not installed' };
    try {
      const parts = combo.split('+').map((p) => p.trim());
      const keyMap: Record<string, any> = {};
      const k = nut.Key;
      const aliases: Record<string, any> = {
        cmd: k.LeftSuper, meta: k.LeftSuper, super: k.LeftSuper,
        ctrl: k.LeftControl, control: k.LeftControl,
        shift: k.LeftShift, alt: k.LeftAlt, option: k.LeftAlt,
        enter: k.Enter, esc: k.Escape, escape: k.Escape,
        tab: k.Tab, space: k.Space, backspace: k.Backspace,
        up: k.Up, down: k.Down, left: k.Left, right: k.Right,
      };
      const resolved = parts.map((p) => aliases[p.toLowerCase()] || (k[p.toUpperCase() as keyof typeof k]) || k[(p as any)]);
      void keyMap;
      await nut.keyboard.pressKey(...resolved);
      await nut.keyboard.releaseKey(...resolved);
      return { ok: true, message: `combo ${combo}` };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  // Run a shell command. Always dangerous — caller (orchestrator) must gate
  // this behind user consent.
  runShell(cmd: string, timeoutMs = 15_000): Promise<{ ok: boolean; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd]);
      let out = '';
      let err = '';
      const t = setTimeout(() => { try { proc.kill(); } catch {/* ignore */} }, timeoutMs);
      proc.stdout.on('data', (b) => (out += b.toString()));
      proc.stderr.on('data', (b) => (err += b.toString()));
      proc.on('close', (code) => {
        clearTimeout(t);
        resolve({ ok: code === 0, output: `exit ${code}\n${out}\n${err}`.slice(0, 4000) });
      });
      proc.on('error', (e) => resolve({ ok: false, output: e.message }));
    });
  }
}
