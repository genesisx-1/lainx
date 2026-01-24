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

    // Check for bundled Ollama binary
    const binaryPath = this.getOllamaBinaryPath();
    this.isInstalled = fs.existsSync(binaryPath);
    return this.isInstalled;
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

    const totalSize = parseInt(response.headers.get('content-length') || '0');
    let downloadedSize = 0;

    // Ensure directory exists
    if (!fs.existsSync(this.ollamaPath)) {
      fs.mkdirSync(this.ollamaPath, { recursive: true });
    }

    const fileStream = fs.createWriteStream(
      path.join(this.ollamaPath, 'ollama-installer')
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Cannot read download stream');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedSize += value.length;
      fileStream.write(value);

      const progress = (downloadedSize / totalSize) * 100;
      onProgress(progress, `Downloading... ${Math.round(progress)}%`);
    }

    fileStream.close();
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

    const binaryPath = this.getOllamaBinaryPath();

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
   * Download a specific model
   */
  async downloadModel(
    modelName: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      body: JSON.stringify({ name: modelName, stream: true })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const progress = (data.completed / data.total) * 100;
            onProgress(progress);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * List downloaded models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data: any = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      return [];
    }
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
