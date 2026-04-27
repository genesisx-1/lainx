# LAIN - Desktop Browser Shell

A productivity-focused desktop browser with integrated terminal and local AI assistant.

## Features

- **Chromium Browser** - Full-featured web browsing with tabs
- **Integrated Terminal** - Real bash/zsh terminal with xterm.js
- **Local AI Assistant** - Ollama-powered AI that runs on your machine (auto-install + model download onboarding)
- **Native Terminal Bridge** - Open in iTerm2/Warp/Terminal and **Continue** (same folder + last command)
- **Browser ↔ Terminal Integration** - Run selected text in terminal; terminal URLs are clickable
- **Focus Mode** - Timer + blocklist + Break Glass + single-tab lock
- **Capsules** - Save/restore workspaces; manage/export/import capsules

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
npm run dev

# (Optional) build main process only
# npm run build:electron
```

## Keyboard Shortcuts

- **Cmd+K**: Command palette
- **Cmd+`**: Toggle terminal
- **Cmd+Shift+A**: Toggle AI sidebar
- **Cmd+T / Cmd+W**: New / close tab (disabled in Focus Mode)
- **Cmd+F**: Find in page
- **Cmd+Y**: History
- **Cmd++ / Cmd+- / Cmd+0**: Zoom in / out / reset

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
# Build for production (macOS)
npm run build

# Build for Windows (requires building on Windows machine)
npm run build:win

# Build for Linux
npm run build:linux

# Build for all platforms (requires platform-specific machines)
npm run build:all

# Start production app
npm start
```

## Building for Windows

Building for Windows requires compilation on a Windows machine due to native dependencies like `node-pty`. Cross-compilation from macOS/Linux is not supported.

For detailed Windows build instructions, see [BUILD_WINDOWS.md](BUILD_WINDOWS.md).

## Platform Support

- **macOS**: Full support for development and building
- **Windows**: Requires building on Windows machine due to native modules
- **Linux**: Full support for development and building

## Current Status

This repo has working implementations of:
- browser tabs + context menu + downloads + find-in-page
- integrated terminal (history search via `/`, clickable URLs)
- local AI onboarding (Ollama auto-install + model pulls)
- Focus Mode enforcement
- Capsules (save/restore + manage/export/import)

## Notes

- **SQLite**: Temporarily using electron-store instead of better-sqlite3 due to native module compilation issues. Will add SQLite back later for better performance.
- **Ollama**: Auto-installation feature requires user to have download permissions and sufficient disk space.

## License

MIT
