#!/usr/bin/env node
/* eslint-disable */
// `lainx` — tiny CLI for the LAIN browser's local control server.
//
// Config: ~/.lainx/config.json  → { "url": "http://127.0.0.1:7878", "token": "..." }
// You can override with env: LAINX_URL, LAINX_TOKEN.
//
// Commands:
//   lainx login --token <token> [--url http://127.0.0.1:7878]
//   lainx providers
//   lainx ask "<goal>" [--mode live|headless] [--provider anthropic|openai|openrouter|ollama]
//   lainx tasks
//   lainx task <id>
//   lainx tail <id>            # follow events for one task
//   lainx tail                 # follow events for everything
//   lainx pause|resume|cancel <id>
//   lainx ping
//
// No npm deps — uses only Node's built-in http + fs.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CFG_DIR = path.join(HOME, '.lainx');
const CFG_FILE = path.join(CFG_DIR, 'config.json');

function readConfig() {
  let url = process.env.LAINX_URL || 'http://127.0.0.1:7878';
  let token = process.env.LAINX_TOKEN || '';
  try {
    const raw = fs.readFileSync(CFG_FILE, 'utf8');
    const cfg = JSON.parse(raw);
    if (!process.env.LAINX_URL && typeof cfg.url === 'string') url = cfg.url;
    if (!process.env.LAINX_TOKEN && typeof cfg.token === 'string') token = cfg.token;
  } catch (_e) { /* no config yet */ }
  return { url, token };
}

function writeConfig(next) {
  if (!fs.existsSync(CFG_DIR)) fs.mkdirSync(CFG_DIR, { recursive: true });
  fs.writeFileSync(CFG_FILE, JSON.stringify(next, null, 2));
  try { fs.chmodSync(CFG_FILE, 0o600); } catch (_e) {/* ignore */}
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function request(method, urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c.toString()));
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, body: data ? JSON.parse(data) : null, raw: data }); }
        catch (_e) { resolve({ status: res.statusCode || 0, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function auth(token) { return token ? { authorization: `Bearer ${token}` } : {}; }

async function cmdLogin(args) {
  const token = args.token || args._[1];
  const url = args.url || 'http://127.0.0.1:7878';
  if (!token) {
    console.error('Usage: lainx login --token <token> [--url http://127.0.0.1:7878]');
    process.exit(1);
  }
  writeConfig({ url, token });
  console.log(`Saved config to ${CFG_FILE} (url=${url}).`);
  await cmdPing();
}

async function cmdPing() {
  const { url, token } = readConfig();
  const r = await request('GET', url + '/v1/health', null, auth(token)).catch((e) => ({ status: 0, err: e.message }));
  if (r.status === 200) { console.log('OK'); return; }
  console.error(`ping failed: ${r.err || r.status}`);
  process.exit(1);
}

async function cmdProviders() {
  const { url, token } = readConfig();
  const r = await request('GET', url + '/v1/providers', null, auth(token));
  if (r.status !== 200) { console.error('failed:', r.body || r.raw); process.exit(1); }
  for (const p of r.body) {
    const ready = p.requiresKey ? (p.hasKey ? 'ready' : 'no-key') : 'ready';
    console.log(`${p.id.padEnd(11)} ${ready.padEnd(8)}  planner=${p.models.planner}  executor=${p.models.executor}`);
  }
}

async function cmdAsk(args) {
  const goal = args._.slice(1).join(' ').trim() || args.goal;
  if (!goal) {
    console.error('Usage: lainx ask "<goal>" [--mode live|headless] [--provider <id>] [--tail]');
    process.exit(1);
  }
  const { url, token } = readConfig();
  const body = {
    goal,
    mode: args.mode === 'headless' ? 'headless' : 'live',
    provider: args.provider,
    with_vision: args['no-vision'] ? false : true,
    with_planner: args['no-planner'] ? false : true,
  };
  const r = await request('POST', url + '/v1/tasks', body, auth(token));
  if (r.status !== 200) { console.error('failed:', r.body || r.raw); process.exit(1); }
  console.log(`Started task ${r.body.id} (status=${r.body.status}, provider=${r.body.provider})`);
  if (args.tail) await cmdTail({ _: ['tail', r.body.id] });
}

async function cmdTasks() {
  const { url, token } = readConfig();
  const r = await request('GET', url + '/v1/tasks', null, auth(token));
  if (r.status !== 200) { console.error('failed:', r.body || r.raw); process.exit(1); }
  for (const t of r.body || []) {
    console.log(`${t.id}  ${t.status.padEnd(10)} step=${String(t.stepCount).padEnd(3)} ~$${(t.totalUsd || 0).toFixed(4)}  ${t.provider}  ${t.goal.slice(0, 80)}`);
  }
}

async function cmdTask(args) {
  const id = args._[1];
  if (!id) { console.error('Usage: lainx task <id>'); process.exit(1); }
  const { url, token } = readConfig();
  const r = await request('GET', url + '/v1/tasks/' + encodeURIComponent(id), null, auth(token));
  console.log(JSON.stringify(r.body, null, 2));
}

async function cmdPauseResumeCancel(verb, args) {
  const id = args._[1];
  if (!id) { console.error(`Usage: lainx ${verb} <id>`); process.exit(1); }
  const { url, token } = readConfig();
  const r = await request('POST', url + '/v1/tasks/' + encodeURIComponent(id) + '/' + verb, {}, auth(token));
  if (r.status !== 200) { console.error('failed:', r.body || r.raw); process.exit(1); }
  console.log('OK');
}

async function cmdTail(args) {
  const id = args._[1];
  const { url, token } = readConfig();
  const u = new URL(url + (id ? `/v1/tasks/${encodeURIComponent(id)}/events` : '/v1/events'));
  if (token) u.searchParams.set('token', token);
  const req = http.request({
    method: 'GET',
    hostname: u.hostname,
    port: u.port || 80,
    path: u.pathname + u.search,
    headers: { accept: 'text/event-stream' },
  }, (res) => {
    if (res.statusCode !== 200) {
      console.error('tail failed: HTTP', res.statusCode);
      process.exit(1);
    }
    let buf = '';
    res.on('data', (c) => {
      buf += c.toString();
      let i;
      while ((i = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        try {
          const evt = JSON.parse(dataLine.slice(6));
          const stamp = new Date(evt.ts || Date.now()).toISOString().slice(11, 19);
          const summary = describe(evt);
          console.log(`[${stamp}] ${evt.taskId.slice(-6)} ${evt.type.padEnd(16)} ${summary}`);
        } catch (_e) { /* ignore */ }
      }
    });
    res.on('end', () => process.exit(0));
  });
  req.on('error', (e) => { console.error('tail error:', e.message); process.exit(1); });
  req.end();
}

function describe(evt) {
  const d = evt.data || {};
  switch (evt.type) {
    case 'task_started': return `goal="${d.goal || ''}" mode=${d.mode} provider=${d.provider}`;
    case 'plan': return (d.plan || '').split('\n').slice(0, 6).join(' | ');
    case 'tool_call': return `${d.name}(${JSON.stringify(d.input || {}).slice(0, 160)})`;
    case 'tool_result': return `${d.name} → ${d.ok ? 'ok' : 'fail'}: ${(d.output || '').slice(0, 200)}`;
    case 'assistant_text': return (d.text || '').slice(0, 200);
    case 'cost': return `~$${(d.usd || 0).toFixed(4)}`;
    case 'task_completed': return d.summary || 'done';
    case 'task_failed': return `error: ${d.error || ''}`;
    case 'awaiting_user': return `asks: ${d.question || ''}`;
    default: return JSON.stringify(d).slice(0, 200);
  }
}

function help() {
  console.log(`lainx — control LAIN browser from the CLI

Setup:
  1. In LAIN: Settings → Control server → enable, copy token.
  2. lainx login --token <token> [--url http://127.0.0.1:7878]
  3. lainx ping

Commands:
  lainx providers
  lainx ask "<goal>" [--mode live|headless] [--provider <id>] [--tail] [--no-vision] [--no-planner]
  lainx tasks
  lainx task <id>
  lainx tail [<id>]
  lainx pause <id>
  lainx resume <id>
  lainx cancel <id>
  lainx ping
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    switch (cmd) {
      case 'login': return await cmdLogin(args);
      case 'ping': return await cmdPing();
      case 'providers': return await cmdProviders();
      case 'ask': return await cmdAsk(args);
      case 'tasks': return await cmdTasks();
      case 'task': return await cmdTask(args);
      case 'tail': return await cmdTail(args);
      case 'pause':
      case 'resume':
      case 'cancel': return await cmdPauseResumeCancel(cmd, args);
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        return help();
      default:
        console.error(`Unknown command: ${cmd}`);
        help();
        process.exit(1);
    }
  } catch (e) {
    console.error('error:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
