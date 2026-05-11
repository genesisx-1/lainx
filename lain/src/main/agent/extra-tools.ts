import type { ToolImpl } from './types';
import { ComputerService } from '../computer/computer.service';
import { IMessageService } from '../imessage/imessage.service';
import type { SecureStoreService } from '../services/secure-store.service';

// Tools that talk to the host OS. They are only registered when the user has
// explicitly enabled them in Settings — that's enforced both by gating the
// registration call (orchestrator only registers what's allowed) and by each
// tool re-checking `secureStore.getPermission` before running.

export function buildComputerTools(secureStore: SecureStoreService): ToolImpl[] {
  const svc = new ComputerService();
  const guard = () => secureStore.getPermission('computer-use') === 'allow';
  return [
    {
      schema: {
        name: 'computer_screenshot',
        description: 'Take a screenshot of the user\'s primary display (not just the browser tab). Returns PNG.',
        input_schema: { type: 'object', properties: {} },
      },
      async execute() {
        if (!guard()) return { ok: false, output: 'computer-use disabled by user' };
        const r = await svc.screenshot();
        return { ok: r.ok, output: r.ok ? 'desktop screenshot captured' : (r.message || 'failed'), data: r.data ? { screenshot: r.data } : undefined };
      },
    },
    {
      schema: {
        name: 'computer_mouse_move',
        description: 'Move the OS mouse pointer to absolute screen coordinates (x,y).',
        input_schema: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] },
      },
      async execute(input) {
        if (!guard()) return { ok: false, output: 'computer-use disabled by user' };
        const r = await svc.mouseMove(Number(input.x), Number(input.y));
        return { ok: r.ok, output: r.message || (r.ok ? 'ok' : 'fail') };
      },
    },
    {
      schema: {
        name: 'computer_mouse_click',
        description: 'Click the OS mouse (left/right/middle).',
        input_schema: { type: 'object', properties: { button: { type: 'string', enum: ['left', 'right', 'middle'] } } },
      },
      async execute(input) {
        if (!guard()) return { ok: false, output: 'computer-use disabled by user' };
        const r = await svc.mouseClick((input.button as any) || 'left');
        return { ok: r.ok, output: r.message || (r.ok ? 'ok' : 'fail') };
      },
    },
    {
      schema: {
        name: 'computer_type',
        description: 'Type text via the OS keyboard (synthetic events). Use computer_key for modifiers/special keys.',
        input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      },
      async execute(input) {
        if (!guard()) return { ok: false, output: 'computer-use disabled by user' };
        const r = await svc.typeText(String(input.text || ''));
        return { ok: r.ok, output: r.message || (r.ok ? 'ok' : 'fail') };
      },
    },
    {
      schema: {
        name: 'computer_key',
        description: 'Press an OS keyboard combo such as "cmd+space" or "ctrl+c".',
        input_schema: { type: 'object', properties: { combo: { type: 'string' } }, required: ['combo'] },
      },
      async execute(input) {
        if (!guard()) return { ok: false, output: 'computer-use disabled by user' };
        const r = await svc.keyCombo(String(input.combo || ''));
        return { ok: r.ok, output: r.message || (r.ok ? 'ok' : 'fail') };
      },
    },
    {
      schema: {
        name: 'computer_run_shell',
        description: 'Run a shell command on the host. DANGEROUS — only enabled when the user grants shell access.',
        input_schema: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] },
      },
      dangerous: true,
      async execute(input) {
        if (secureStore.getPermission('computer-shell') !== 'allow')
          return { ok: false, output: 'shell access not granted' };
        const r = await svc.runShell(String(input.cmd || ''));
        return { ok: r.ok, output: r.output };
      },
    },
  ];
}

export function buildImessageTools(secureStore: SecureStoreService): ToolImpl[] {
  const svc = new IMessageService();
  if (!svc.isSupported()) return [];
  const guard = () => secureStore.getPermission('imessage') === 'allow';
  return [
    {
      schema: {
        name: 'imessage_send',
        description: 'Send an iMessage to a contact (phone number or email handle). macOS only.',
        input_schema: { type: 'object', properties: { to: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'body'] },
      },
      dangerous: true,
      async execute(input) {
        if (!guard()) return { ok: false, output: 'iMessage disabled by user' };
        const r = await svc.send(String(input.to || ''), String(input.body || ''));
        return { ok: r.ok, output: r.message || (r.ok ? 'sent' : 'failed') };
      },
    },
    {
      schema: {
        name: 'imessage_read_recent',
        description: 'Read recent iMessage history with a contact. macOS only.',
        input_schema: { type: 'object', properties: { handle: { type: 'string' }, limit: { type: 'integer' } }, required: ['handle'] },
      },
      async execute(input) {
        if (!guard()) return { ok: false, output: 'iMessage disabled by user' };
        const r = await svc.readRecent(String(input.handle || ''), Number(input.limit || 20));
        if (!r.ok) return { ok: false, output: r.message || 'failed' };
        const lines = r.messages.map((m) => `${new Date(m.ts).toISOString()}  ${m.from}: ${m.text}`);
        return { ok: true, output: lines.join('\n') || '(no messages)' };
      },
    },
  ];
}
