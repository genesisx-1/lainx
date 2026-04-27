import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export class OllamaManagerService {
  private ollamaProcess: ChildProcess | null = null;
  private ollamaPath: string;
  private isInstalled = false;
  private baseUrl = 'http://localhost:11434';

  constructor() {
    // Store Ollama in app data directory
    this.ollamaPath = path.join(app.getPath('userData'), 'ollama');
  }

  /**
   * Check if Ollama is installed
   */
  async checkInstallation(): Promise<boolean> {
    try {
      // First check if user has Ollama installed globally
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        this.isInstalled = true;
        return true;
      }
    } catch (error) {
      // Not running, check if we have local binary
    }

    // If not running, check if Ollama exists locally or on PATH.
    // 1) App-managed install
    const appBinaryPath = this.getAppManagedBinaryPath();
    if (appBinaryPath && fs.existsSync(appBinaryPath)) {
      this.isInstalled = true;
      return true;
    }

    // 2) Global install (e.g. user installed Ollama.app / CLI already)
    const existsOnPath = await this.checkOllamaOnPath();
    this.isInstalled = existsOnPath;
    return existsOnPath;
  }

  /**
   * Download and install Ollama automatically
   */
  async downloadAndInstall(
    onProgress: (progress: number, status: string) => void
  ): Promise<void> {
    const platform = process.platform;
    let downloadUrl = '';

    // Official Ollama download URLs
    if (platform === 'darwin') {
      downloadUrl = 'https://ollama.com/download/Ollama-darwin.zip';
    } else if (platform === 'win32') {
      downloadUrl = 'https://ollama.com/download/OllamaSetup.exe';
    } else if (platform === 'linux') {
      // For Linux, we'll use the install script approach
      await this.installOllamaLinux(onProgress);
      return;
    }

    onProgress(0, 'Downloading Ollama...');

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Download failed');

    const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedSize = 0;

    // Ensure directory exists
    if (!fs.existsSync(this.ollamaPath)) {
      fs.mkdirSync(this.ollamaPath, { recursive: true });
    }

    const installerPath = path.join(this.ollamaPath, 'ollama-installer');
    const fileStream = fs.createWriteStream(installerPath);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Cannot read download stream');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedSize += value.length;
      fileStream.write(value);

      if (totalSize > 0) {
        const progress = (downloadedSize / totalSize) * 100;
        onProgress(progress, `Downloading... ${Math.round(progress)}%`);
      } else {
        // content-length might be missing; still show activity
        onProgress(1, 'Downloading...');
      }
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end(() => resolve());
      fileStream.on('error', reject);
    });
    onProgress(100, 'Installing Ollama...');

    // Extract/install based on platform
    if (platform === 'darwin') {
      await this.extractAndInstallMac();
    } else if (platform === 'win32') {
      await this.runWindowsInstaller();
    }

    this.isInstalled = true;
    onProgress(100, 'Ollama installed successfully!');
  }

  /**
   * Install Ollama on Linux using official script
   */
  private async installOllamaLinux(
    onProgress: (progress: number, status: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress(50, 'Installing Ollama for Linux...');

      const installProcess = spawn('bash', [
        '-c',
        'curl -fsSL https://ollama.com/install.sh | sh'
      ]);

      installProcess.on('close', (code) => {
        if (code === 0) {
          onProgress(100, 'Ollama installed!');
          resolve();
        } else {
          reject(new Error('Installation failed'));
        }
      });
    });
  }

  /**
   * Start Ollama server
   */
  async startServer(): Promise<void> {
    if (this.ollamaProcess) {
      return; // Already running
    }

    const binaryPath = (await this.resolveOllamaBinary()) || 'ollama';

    this.ollamaProcess = spawn(binaryPath, ['serve'], {
      detached: false,
      stdio: 'pipe'
    });

    // Wait for server to be ready
    await this.waitForServer();
  }

  /**
   * Stop Ollama server
   */
  async stopServer(): Promise<void> {
    if (this.ollamaProcess) {
      this.ollamaProcess.kill();
      this.ollamaProcess = null;
    }
  }

  /**
   * Download a specific model using the CLI (more reliable than streaming API)
   */
  async downloadModel(
    modelName: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use the same resolved binary we use for `serve` so app-managed installs work.
      const binaryPath = this.getResolvedBinaryOrDefault();
      
      console.log(`[OllamaManager] Starting download of model: ${modelName}`);
      onProgress(1); // Show we've started
      
      const pullProcess = spawn(binaryPath, ['pull', modelName], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let lastProgress = 0;

      // Parse progress from stdout/stderr
      const parseOutput = (data: Buffer) => {
        const text = data.toString();
        console.log(`[OllamaManager] Output: ${text.trim()}`);
        
        // Look for percentage in output like "pulling manifest" or "100%"
        const percentMatch = text.match(/(\d+)%/);
        if (percentMatch) {
          const progress = parseInt(percentMatch[1], 10);
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress);
          }
        }
        
        // Also look for "success" message
        if (text.includes('success') || text.includes('done')) {
          onProgress(100);
        }
      };

      pullProcess.stdout?.on('data', parseOutput);
      pullProcess.stderr?.on('data', parseOutput);

      pullProcess.on('close', (code) => {
        console.log(`[OllamaManager] Pull process exited with code: ${code}`);
        if (code === 0) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Failed to download model: ${modelName} (exit code ${code})`));
        }
      });

      pullProcess.on('error', (err) => {
        console.error(`[OllamaManager] Pull process error:`, err);
        reject(err);
      });
    });
  }

  /**
   * List downloaded models - try API first, fallback to CLI
   */
  async listModels(): Promise<string[]> {
    // Try API first
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) {
        const data: any = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        console.log('[OllamaManager] Models from API:', models);
        return models;
      }
    } catch (error) {
      console.log('[OllamaManager] API failed, trying CLI...');
    }

    // Fallback to CLI
    return new Promise((resolve) => {
      const child = spawn(this.getResolvedBinaryOrDefault(), ['list']);
      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          // Parse "ollama list" output - skip header line, get model names
          const lines = output.trim().split('\n').slice(1);
          const models = lines.map(line => line.split(/\s+/)[0]).filter(Boolean);
          console.log('[OllamaManager] Models from CLI:', models);
          resolve(models);
        } else {
          console.log('[OllamaManager] CLI list failed');
          resolve([]);
        }
      });
      
      child.on('error', () => resolve([]));
    });
  }

  private getOllamaBinaryPath(): string {
    const platform = process.platform;
    if (platform === 'darwin') {
      return path.join(this.ollamaPath, 'Ollama.app/Contents/MacOS/ollama');
    } else if (platform === 'win32') {
      return path.join(this.ollamaPath, 'ollama.exe');
    } else {
      return '/usr/local/bin/ollama'; // Linux global install
    }
  }

  // Returns the app-managed binary path (if we installed Ollama into userData).
  private getAppManagedBinaryPath(): string | null {
    const platform = process.platform;
    if (platform === 'darwin') {
      return path.join(this.ollamaPath, 'Ollama.app/Contents/MacOS/ollama');
    }
    if (platform === 'win32') {
      return path.join(this.ollamaPath, 'ollama.exe');
    }
    // Linux install script installs globally; we don't manage a binary here.
    return null;
  }

  private async checkOllamaOnPath(): Promise<boolean> {
    return new Promise((resolve) => {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      const child = spawn(cmd, ['ollama']);
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private async resolveOllamaBinary(): Promise<string | null> {
    const appBinaryPath = this.getAppManagedBinaryPath();
    if (appBinaryPath && fs.existsSync(appBinaryPath)) return appBinaryPath;

    const existsOnPath = await this.checkOllamaOnPath();
    if (existsOnPath) return 'ollama';

    // Fallback to previous logic (may still work on some systems).
    return this.getOllamaBinaryPath();
  }

  // Best-effort: return app-managed path if present; else PATH `ollama`; else legacy fallback.
  // This is sync so it can be used inside Promise constructors.
  private getResolvedBinaryOrDefault(): string {
    const appBinaryPath = this.getAppManagedBinaryPath();
    if (appBinaryPath && fs.existsSync(appBinaryPath)) return appBinaryPath;
    const legacy = this.getOllamaBinaryPath();
    if (legacy && fs.existsSync(legacy)) return legacy;
    return 'ollama'; // hope it's on PATH
  }

  private async waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/version`);
        if (response.ok) return;
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Ollama server failed to start');
  }

  private async extractAndInstallMac(): Promise<void> {
    // Use unzip to extract .zip file on Mac
    return new Promise((resolve, reject) => {
      const process = spawn('unzip', [
        '-o',
        path.join(this.ollamaPath, 'ollama-installer'),
        '-d',
        this.ollamaPath
      ]);
      process.on('close', (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }

  private async runWindowsInstaller(): Promise<void> {
    // Run Windows installer silently
    return new Promise((resolve, reject) => {
      const process = spawn(
        path.join(this.ollamaPath, 'ollama-installer'),
        ['/S', `/D=${this.ollamaPath}`]
      );
      process.on('close', (code) => {
        code === 0 ? resolve() : reject();
      });
    });
  }
}
