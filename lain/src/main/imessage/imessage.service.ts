import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// iMessage automation, macOS-only. send → AppleScript via osascript.
// read_recent → SQLite read of ~/Library/Messages/chat.db.
//
// On non-macOS, every method short-circuits with a "requires macOS" error.

export class IMessageService {
  isSupported(): boolean {
    return process.platform === 'darwin';
  }

  send(handle: string, message: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.isSupported()) return Promise.resolve({ ok: false, message: 'iMessage requires macOS' });
    return new Promise((resolve) => {
      const escMsg = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const escHandle = handle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const script = `tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${escHandle}" of targetService
  send "${escMsg}" to targetBuddy
end tell`;
      const proc = spawn('osascript', ['-e', script]);
      let err = '';
      proc.stderr.on('data', (b) => (err += b.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true, message: 'sent' });
        else resolve({ ok: false, message: err.trim() || `osascript exit ${code}` });
      });
      proc.on('error', (e) => resolve({ ok: false, message: e.message }));
    });
  }

  // Best-effort recent message read. Returns up to `limit` rows. Falls back
  // gracefully if better-sqlite3 isn't available or chat.db can't be opened.
  async readRecent(handle: string, limit = 20): Promise<{ ok: boolean; messages: Array<{ from: string; text: string; ts: number }>; message?: string }> {
    if (!this.isSupported()) return { ok: false, messages: [], message: 'iMessage requires macOS' };
    let Database: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require('better-sqlite3');
    } catch (e: any) {
      return { ok: false, messages: [], message: `better-sqlite3 not loadable: ${e?.message}` };
    }
    const dbPath = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
    if (!fs.existsSync(dbPath)) return { ok: false, messages: [], message: 'chat.db not found' };
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      const sql = `
        SELECT m.is_from_me, m.date, m.text, h.id as handle
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE h.id = ?
        ORDER BY m.date DESC
        LIMIT ?
      `;
      const rows = db.prepare(sql).all(handle, limit) as any[];
      db.close();
      const messages = rows.map((r) => ({
        from: r.is_from_me ? 'me' : r.handle,
        text: r.text || '',
        // chat.db uses Apple's epoch (2001-01-01) in nanoseconds since macOS High Sierra.
        ts: 978307200000 + Math.round(Number(r.date || 0) / 1_000_000),
      })).reverse();
      return { ok: true, messages };
    } catch (e: any) {
      return { ok: false, messages: [], message: e?.message };
    }
  }
}
