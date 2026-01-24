# LAIN - Desktop Browser Shell

A productivity-focused desktop browser with integrated terminal and local AI assistant.

## Features

- **Chromium Browser** - Full-featured web browsing with tabs
- **Integrated Terminal** - Real bash/zsh terminal with xterm.js
- **Local AI Assistant** - Ollama-powered AI that runs on your machine
- **Native Terminal Bridge** - Open sessions in iTerm2, Warp, or other terminal apps
- **Browser ↔ Terminal Integration** - Seamless connection between browsing and command-line work

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
