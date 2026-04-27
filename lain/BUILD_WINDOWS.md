# Building LAIN for Windows

Since LAIN uses native modules like `node-pty`, cross-compilation from macOS to Windows is not possible. Follow these steps to build for Windows:

## Option 1: Build on Windows (Recommended)

1. Clone the repository on a Windows machine:
```bash
git clone <repository-url>
cd lain
```

2. Install dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run build:win
```

## Option 2: Using a Windows Virtual Machine or CI/CD

You can also set up automated builds using GitHub Actions or similar CI/CD platforms that provide Windows runners.

Example GitHub Actions workflow:

```yaml
name: Build Windows App

on:
  push:
    branches: [ main ]

jobs:
  build-windows:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build for Windows
      run: npm run build:win
```

## Important Notes

- The `node-pty` module requires compilation for the target platform
- Cross-platform compilation from macOS to Windows is not supported by node-gyp
- The Windows build will create installers in the `release` directory
- Supported architectures: x64 and arm64

## Alternative: Portable Windows Version

If you need a portable version that doesn't require installation, you can modify the package.json to build an AppImage-like executable:

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

Then run: `npm run build:win`