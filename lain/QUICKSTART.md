# LAIN Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- macOS, Windows, or Linux

### Installation

```bash
cd /Users/savanna/lainx/lain
npm install
```

### Running LAIN

**Option 1: Using the dev script (recommended)**
```bash
./dev.sh
```

**Option 2: Manual start**
```bash
# Terminal 1 - Start Vite dev server
npm run dev:vite

# Terminal 2 - Start Electron
NODE_ENV=development npx electron .
```

### What You Should See

1. **Electron window opens** with LAIN interface
2. **Browser area** at the top with tabs and address bar
3. **Terminal panel** at the bottom (black background)
4. **AI Chat sidebar** on the right (purple accent)

## 🧪 Testing the MVP

### Test 1: Browser Tabs
- Click the **+** button to add new tabs
- Click on tabs to switch between them
- Click **×** on a tab to close it

### Test 2: Address Bar
- Type a URL in the address bar (e.g., `https://google.com`)
- Press Enter to navigate

### Test 3: Terminal
- Click in the terminal area
- Type a command (e.g., `ls`, `pwd`, `echo "Hello LAIN"`)
- Press Enter to execute
- Check if output appears

### Test 4: AI Chat (requires Ollama)
- Type a message in the AI chat input
- Click Send
- If Ollama is not installed, you'll see the onboarding screen

### Test 5: Native Terminal Integration
- Look for the "Open in [iTerm2/Warp/etc]" button in terminal toolbar
- Click it to open your native terminal app
- Verify it opens in the correct directory

## 🐛 Troubleshooting

### App doesn't launch
```bash
# Check if Vite is running
curl http://localhost:5173

# Rebuild Electron main process
npm run build:electron

# Try again
NODE_ENV=development npx electron .
```

### Terminal doesn't work
- Check console for errors (Electron DevTools will be open)
- Verify node-pty installed correctly
- Check IPC communication in console

### WebView is blank
- Open DevTools (should open automatically in dev mode)
- Check for CORS or security policy errors
- Try a different URL

### Ollama errors
- Ollama service is optional for initial testing
- You can skip the onboarding to test other features
- Install Ollama manually: `https://ollama.com/download`

## 📝 Development Tips

### Hot Reload
- Renderer (React) code hot reloads automatically
- Main process changes require restart:
  1. Close Electron window
  2. Run `npm run build:electron`
  3. Restart Electron

### Debugging
- **Renderer**: DevTools will open automatically
- **Main Process**: Use `console.log()` - output appears in terminal
- **IPC**: Log in both preload and main process

### File Structure
```
src/
├── main/          # Backend (Node.js/Electron)
│   ├── index.ts   # Start here for main process
│   └── services/  # Backend services
├── renderer/      # Frontend (React)
│   ├── App.tsx    # Start here for UI
│   └── components/
└── shared/        # Shared between main & renderer
```

## 🎯 Quick Wins to Test

1. **Tab Management**
   - Add 5 tabs
   - Close middle tab
   - Switch between tabs
   - Verify active tab highlights

2. **Terminal Basics**
   - Type `pwd` → should show current directory
   - Type `ls` → should list files
   - Type `echo "test"` → should print "test"

3. **UI Responsiveness**
   - Resize window → terminal should resize
   - Toggle sidebar (if implemented)
   - Check if layout stays intact

4. **Navigation**
   - Enter `https://example.com` in address bar
   - Verify page loads in WebView
   - Check tab title updates

## 🔄 Next Development Session

After testing the MVP, focus on:

1. **Fix any crashes or errors** found during testing
2. **Implement terminal search** (/ key overlay)
3. **Add browser → terminal** integration
4. **Test Ollama flow** end-to-end
5. **Polish UI interactions**

## 📚 Useful Commands

```bash
# Install new package
npm install <package-name>

# Rebuild main process
npm run build:electron

# Build for production
npm run build

# Clean install (if issues)
rm -rf node_modules package-lock.json
npm install

# Check Vite status
npm run dev:vite
# Opens on http://localhost:5173
```

## 🎉 Success Criteria

You'll know the MVP is working when:
- ✅ App launches without errors
- ✅ You can create and close tabs
- ✅ Terminal accepts input
- ✅ Commands execute and show output
- ✅ AI chat interface is responsive
- ✅ Layout is clean and functional

## 🆘 Getting Help

If you encounter issues:

1. **Check BUILD_SUMMARY.md** for known issues
2. **Check console output** in both terminal and DevTools
3. **Verify all dependencies** are installed
4. **Try clean reinstall** of node_modules
5. **Check that Vite is running** on port 5173

---

**Ready to build the future of productivity? Let's ship LAIN! 🚀**
