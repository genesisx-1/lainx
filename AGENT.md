# LAIN — Agent / Architecture Guide

> Read this first if you are an AI assistant (or a human) opening this repo cold.
> It describes what the code is, how the pieces fit, and the commands to run /
> verify each subsystem. The plan that produced this work lives at the top of
> the repo as `LAIN_BUILD_PLAN.md` — this document is the post-build truth.

## What LAIN is

LAIN is a desktop **Electron browser** with an integrated terminal, a local
LLM stack, and an **agent mode** that can drive web pages on the user's behalf
— a Comet competitor. The agent loop is:

```
observe (DOM + screenshot) → planner LLM → executor LLM → tool_call → tool_result → repeat
```

The agent can be driven from three surfaces:

1. **In-app** — the right-sidebar **Agent** tab.
2. **Omnibox** — switch the top bar mode chip to `Agent`, type a goal, press Enter.
3. **CLI / HTTP** — the `lainx` binary or any `curl` against the local control
   server (`127.0.0.1:7878`).

## Process layout

```
┌────────────────────── Renderer (React, src/renderer) ─────────────────────┐
│  src/renderer/App.tsx                                                     │
│  ├─ Browser/                                                              │
│  │   ├─ AddressBar.tsx        ← omnibox: URL | Ask | Agent mode chip      │
│  │   ├─ TabBar.tsx, BookmarksBar.tsx, HistoryPanel.tsx, …                 │
│  │   └─ WebView.tsx           ← <webview> per tab + agent-driving overlay │
│  │                              + screenshot/extract/wait/click/type APIs │
│  ├─ Assistant/                                                            │
│  │   ├─ AssistantSidebar.tsx  ← tabs: Agent · Chat · Tasks                │
│  │   ├─ AgentTab.tsx          ← goal box, planner+vision toggles,         │
│  │   │                          live timeline, pause/resume/cancel,       │
│  │   │                          in-line task_ask_user reply UI            │
│  │   ├─ ChatTab.tsx (ChatPanel.tsx) ← legacy chat (omnibox Ask hooks in)  │
│  │   ├─ TasksTab.tsx          ← list of past + active agent tasks         │
│  │   └─ ProviderSettings.tsx  ← keys, models, permissions, control srv    │
│  ├─ Terminal/TerminalPanel.tsx                                            │
│  └─ store/                    ← zustand stores (browser, ai, ui, …)       │
└────────────────────────────────┬──────────────────────────────────────────┘
                          preload.ts / IPC
┌──────────────────────── Main (Node, src/main) ────────────────────────────┐
│  index.ts                                                                 │
│  ├─ services/secure-store.service.ts  (Electron safeStorage + estore)     │
│  ├─ services/providers/                                                   │
│  │   ├─ types.ts        ← Provider interface, PRICING table               │
│  │   ├─ manager.ts      ← picks defaults, dispatches chat()               │
│  │   ├─ anthropic.provider.ts (tool_use, vision, prompt caching)          │
│  │   ├─ openai.provider.ts    (function_calling, vision)                  │
│  │   ├─ ollama.provider.ts    (local, curl fallback, JSON tool emulation) │
│  │   └─ openai.provider.ts also exports OpenRouter via /v1 endpoint       │
│  ├─ services/ai.service.ts    ← legacy AI_CHAT router (back-compat)       │
│  ├─ services/ollama-manager.service.ts (auto-install + model pull)        │
│  ├─ services/history.service.ts, storage.service.ts, terminal.service.ts  │
│  ├─ agent/                                                                │
│  │   ├─ orchestrator.ts ← planner+executor loop, streams AGENT_EVENT      │
│  │   ├─ tool-registry.ts ← browser_observe/navigate/click/type/scroll/…   │
│  │   ├─ extra-tools.ts  ← computer_* + imessage_* (gated by permissions)  │
│  │   ├─ renderer-driver.ts ← RPC bridge: main → renderer <webview>        │
│  │   └─ types.ts                                                          │
│  ├─ browser/headless-driver.ts ← Playwright (lazy-require, headless mode) │
│  ├─ computer/computer.service.ts ← nut-js (lazy) + desktopCapturer         │
│  ├─ imessage/imessage.service.ts ← osascript + chat.db (macOS only)       │
│  └─ control-server/server.ts  ← HTTP + SSE on 127.0.0.1:7878              │
└───────────────────────────────────────────────────────────────────────────┘
```

## Mental model

- **Providers** are vendor-agnostic adapters that all return an `AIResponse`
  with the same shape (`text`, `content[]`, `toolCalls[]`, `stopReason`,
  `usage` with `estimatedUsd`). Anthropic uses `tool_use` blocks natively;
  OpenAI/OpenRouter map onto `function_calling`; Ollama emulates tools by
  asking the local model to return a JSON object.
- **Tools** live in a single registry. Every tool has a JSON-schema; the
  registry feeds those schemas to the active provider on each step. Tools
  execute through a `BrowserDriver` (the live `<webview>` or Playwright), or
  through the OS-level services for `computer_*` / `imessage_*`.
- **The orchestrator** is the only thing that talks to the LLM in agent mode.
  It runs a single planner pass (cheap one-shot, default Opus 4.7) up front,
  then loops the executor (default Sonnet 4.6) until the model calls
  `task_done` or `task_ask_user`, or hits `MAX_STEPS = 30`.
- **Vision** is opt-in per task. When on, `browser_observe` and
  `browser_screenshot` attach a PNG to the next user turn so the model can
  literally see the page. Local Ollama models skip this (no vision).
- **The control server** broadcasts every agent event (plan, tool_call,
  tool_result, cost, …) via SSE. The CLI uses it. So can your own scripts.

## Running it

```sh
cd lain
npm install
npm run dev            # vite + electron, NODE_ENV=development
```

Hotkeys:
- ⌘L (Ctrl+L on Linux/Win) — focus omnibox.
- Click the mode chip in the omnibox to cycle URL → Ask → Agent.
- ⌘⇧A — toggle the AI sidebar.
- ⌘\` — toggle the terminal.

First-run setup:
1. Open the sidebar → **Providers**.
2. Paste at least one API key (Anthropic recommended for agent quality;
   OpenRouter for cheap tokens). Ollama works with no key if you have it
   installed (it auto-installs on first launch via OllamaSetup).
3. Optional: enable the **Local control server** in Providers, copy the
   token, then `lainx login --token <token>`.
4. Optional: enable **Computer-use** / **Shell** / **iMessage** in Providers
   if you want OS-level tools.

## Using the `lainx` CLI

The CLI ships as a `bin` entry in `package.json` and lives at `lain/cli/lainx.js`.

```sh
# After enabling the control server in Settings and copying the token:
node lain/cli/lainx.js login --token <token>     # writes ~/.lainx/config.json
node lain/cli/lainx.js providers                 # show configured providers
node lain/cli/lainx.js ask "summarize this tab" --tail
node lain/cli/lainx.js tasks
node lain/cli/lainx.js tail <task_id>
node lain/cli/lainx.js pause <task_id>
node lain/cli/lainx.js cancel <task_id>
```

To get `lainx` on your `$PATH` system-wide, run `npm link` inside `lain/`
once. From there you can use `lainx ...` anywhere.

## Adding a new tool

1. Add a `ToolImpl` to `src/main/agent/tool-registry.ts` (or a separate file
   then `register()` it from the orchestrator constructor).
2. Its `schema` is plain JSON-schema — Anthropic and OpenAI both consume it
   verbatim.
3. The `execute(input, ctx)` function receives a `ToolContext` with a typed
   `BrowserDriver`, an `emit()` hook for streaming events, and an
   `askUser()` for clarification round-trips.
4. If your tool calls the OS, gate it with `secureStore.getPermission(...)`
   and mark it `dangerous: true`.

## Adding a new provider

1. Implement the `Provider` interface from `src/main/services/providers/types.ts`.
2. Register it in `ProviderManager`'s constructor.
3. Add a `defaultModels` pair and (optionally) pricing rows in `PRICING`.
4. Wire UI label/hint into `ProviderSettings.tsx`'s `FRIENDLY`/`HINTS` maps.

## Control-server HTTP API (port 7878 by default)

All endpoints under `/v1` require `Authorization: Bearer <token>`. SSE
endpoints also accept `?token=<token>` (for `EventSource`).

| Method | Path                              | Notes                          |
| ------ | --------------------------------- | ------------------------------ |
| GET    | `/v1/health`                      | unauth, used for ping          |
| GET    | `/v1/providers`                   | list providers + readiness     |
| POST   | `/v1/tasks`                       | body: goal, mode, provider, …  |
| GET    | `/v1/tasks`                       | list                           |
| GET    | `/v1/tasks/:id`                   | task status                    |
| POST   | `/v1/tasks/:id/pause`             |                                |
| POST   | `/v1/tasks/:id/resume`            |                                |
| POST   | `/v1/tasks/:id/cancel`            |                                |
| GET    | `/v1/tasks/:id/events`            | SSE — events for one task      |
| GET    | `/v1/events`                      | SSE — events for everything    |

Event types streamed: `task_started`, `plan`, `tool_call`, `tool_result`,
`assistant_text`, `cost`, `paused`, `resumed`, `user_takeover`,
`awaiting_user`, `task_completed`, `task_failed`, `task_cancelled`.

## Optional native deps

Two features need optional native packages. Build/runs without them; the
features just say "not installed" until you opt in.

```sh
# OS-level mouse/keyboard (for computer_* tools).
# Screenshots already work without this via Electron's desktopCapturer.
npm install --save-optional @nut-tree-fork/nut-js

# Playwright Chromium binary — only needed for headless agent mode.
# `playwright-core` is already in dependencies; you just need the binary.
npx playwright install chromium
```

## Build / verify

```sh
npm run build                       # tsc main + vite renderer
npm run build:mac                   # dmg + zip
npm run build:win                   # nsis
npm run build:linux                 # AppImage + deb

# Smoke tests, in order:
npm run dev
# 1. Open Settings → paste Anthropic key → Test → "ok"
# 2. Open any web page, switch omnibox to Agent, type:
#      "click the top story and summarize it"
#    Expect: timeline shows plan → browser_observe → browser_click →
#    browser_observe → task_done with a summary.
# 3. Click inside the webview while the agent is driving → Pause fires.
# 4. Enable Local control server, copy token:
#      curl -H "Authorization: Bearer <t>" http://127.0.0.1:7878/v1/health
# 5. lainx ask "what tabs do I have open" --tail
# 6. Headless mode:
#      npx playwright install chromium
#      lainx ask "fetch hacker news front page text" --mode headless --tail
```

## Cost & token hygiene

- All providers populate `usage.estimatedUsd` from `PRICING` in
  `services/providers/types.ts`. Update prices there as vendors change them.
- Anthropic system + tool list is sent with `cache_control: ephemeral` when
  `cacheSystem: true` — saves ~75% on the second step onward.
- Default daily cap is 5 USD; orchestrator does NOT enforce it yet (TODO:
  Phase 5 polish). Cost is shown in the AgentTab header + Tasks tab.

## Known limitations / phase backlog

- The orchestrator's `cleanupTask` closes the Playwright context but leaves
  the renderer-driver listening — that's harmless but should be more
  symmetric.
- Cost cap is computed but not enforced; UI shows it.
- No HTTP-side input validation library (`zod` was in the plan; skipped to
  avoid a new dep). Provider/tool inputs are loosely typed at the boundary.
- iMessage `read_recent` needs full-disk-access permission on macOS for
  `chat.db` (system dialog appears on first read).
- nut-js requires native build tools on Linux; on Wayland, screen capture
  works but synthetic input is limited.

## Where the original product vision lives

- `LAIN_BUILD_PLAN.md` — original 1700-line build plan (mostly Phase 0/1
  details).
- `lain/FEATURES.md`, `lain/README.md`, `lain/BUILD_SUMMARY.md` — pre-agent
  documentation; useful for understanding the terminal + Ollama plumbing.
- `lain/DISTRIBUTION.md` — packaging notes for macOS notarization / Windows
  signing.
- `lain/QUICKSTART.md` — outdated; use this file instead.

If something here disagrees with one of those, **this file wins** —
they predate the agent system.
