# LAIN - Agentic Desktop Browser

A Comet-style agentic browser with integrated terminal and a multi-provider AI
stack. Read [`../AGENT.md`](../AGENT.md) first if you (or your AI assistant)
need the full architecture.

## Features

- **Agent mode** - Anthropic / OpenAI / OpenRouter / local Ollama drive the
  browser through a structured tool-calling loop (`browser_observe`,
  `browser_click`, `browser_type`, `browser_screenshot`, …) with optional
  vision and an Opus-plans-Sonnet-acts dual-model setup.
- **Live tab takeover** - Watch the agent click around the real tab, grab
  the mouse anytime to take over.
- **Headless background mode** - Playwright-driven Chromium for long-running
  jobs that shouldn't steal your screen.
- **Omnibox** - Single bar that morphs between URL, Ask, and Agent modes
  (⌘L to focus, click the chip to switch).
- **CLI / HTTP** - `lainx` binary + local control server on `127.0.0.1:7878`
  so any shell, script, or other AI can drive the browser.
- **Computer-use** - Optional OS-level mouse/keyboard/screen via nut-js +
  Electron `desktopCapturer`, behind explicit consent.
- **iMessage** - macOS-only `send` and `read_recent` tools via AppleScript
  and `~/Library/Messages/chat.db`.
- **Chromium browser** - Tabs, bookmarks, history, downloads, find-in-page.
- **Integrated terminal** - Real bash/zsh terminal with xterm.js + native
  bridge to iTerm2/Warp/Windows Terminal.

## Tech Stack

- **Electron 28+** - Desktop framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **xterm.js + node-pty** - Terminal emulation
- **Zustand** - State management
- **electron-store** - Data persistence
- **Ollama** - Local AI models

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
./dev.sh

# Or manually:
# Terminal 1: npm run dev:vite
# Terminal 2: NODE_ENV=development npx electron .
```

### Project Structure

```
lain/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Main entry point
│   │   ├── preload.ts     # Preload script
│   │   ├── ipc-handlers.ts
│   │   └── services/      # Backend services
│   ├── renderer/          # React frontend
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── store/
│   │   └── styles/
│   └── shared/            # Shared types/constants
└── database/              # Database schema
```

## Building

```bash
# Build for production
npm run build

# Start production app
npm start
```

## Current Status (MVP - Week 1)

✅ Project structure created
✅ Electron + React setup
✅ Terminal service with native app integration
✅ Ollama manager service
✅ AI service
✅ Storage service (electron-store)
✅ IPC communication layer
✅ Browser UI (tabs, address bar, webview)
✅ Terminal panel with xterm.js
✅ AI chat sidebar
✅ Onboarding for Ollama setup

### Next Steps

- [ ] Test terminal command execution
- [ ] Test Ollama installation flow
- [ ] Implement terminal search (/)
- [ ] Add browser → terminal integration
- [ ] Add terminal → browser URL detection
- [ ] Implement Focus Mode
- [ ] Add Capsules/workspaces

## Notes

- **SQLite**: Temporarily using electron-store instead of better-sqlite3 due to native module compilation issues. Will add SQLite back later for better performance.
- **Ollama**: Auto-installation feature requires user to have download permissions and sufficient disk space.

## License

MIT
