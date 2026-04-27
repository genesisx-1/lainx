# Building LAIN for Windows - Complete Guide

This document contains all the information you need to build the Windows version of LAIN.

## Prerequisites for Windows Build

On your Windows machine, you'll need:
- Node.js 18+ (https://nodejs.org/)
- npm (comes with Node.js)
- Git (optional, for cloning the repository)
- Windows Build Tools: Run `npm install --global windows-build-tools` in PowerShell as Administrator

## Step-by-Step Instructions

### 1. Clone and Setup
```powershell
git clone <your-repo-url>
cd lain
npm install
```

### 2. Build the Application
```powershell
npm run build:win
```

### 3. Locate Built Files
After successful build, find your Windows installers in:
- `release/` directory
- Files will be named like: `LAIN Setup x.x.x.exe`

## Automated Build Options

### GitHub Actions (Recommended)
Create `.github/workflows/build.yml` in your repository:

```yaml
name: Build Windows App

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build for Windows
      run: npm run build:win
      
    - name: Upload Artifacts
      uses: actions/upload-artifact@v4
      with:
        name: windows-build
        path: release/
```

### Alternative: Portable Executable
If you prefer a portable version instead of an installer, modify the `package.json`:

```json
"win": {
  "icon": "resources/icon.ico",
  "target": [
    {
      "target": "portable",
      "arch": ["x64"]
    }
  ]
}
```

## Troubleshooting Common Issues

### Issue: node-gyp errors
Solution: Install Windows Build Tools
```powershell
npm install --global windows-build-tools
```

### Issue: node-pty compilation fails
Solution: Make sure Python 3.11+ is installed and in PATH

### Issue: Missing Visual Studio components
Solution: Install Visual Studio Build Tools with C++ support

## Verification Steps

Once built, verify your Windows executable:
1. Run the installer on a Windows machine
2. Launch the application
3. Test browser functionality
4. Test integrated terminal (should launch PowerShell)
5. Test AI features if configured

## Distribution

Your built Windows application will be located in the `release/` folder and will include:
- NSIS installer (LAIN-Setup-x.x.x.exe)
- Portable version (if configured)
- Digital signatures (if configured)

## Notes

- The build process creates both x64 and ARM64 installers
- Total build time typically takes 10-20 minutes depending on hardware
- The installer includes all necessary dependencies
- The application follows Windows UI conventions once built