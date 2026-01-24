import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalService } from './services/terminal.service';
import { AIService } from './services/ai.service';
import { OllamaManagerService } from './services/ollama-manager.service';
import { StorageService } from './services/storage.service';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export function registerIPCHandlers(
  terminalService: TerminalService,
  aiService: AIService,
  ollamaManager: OllamaManagerService,
  storageService: StorageService
) {
  // Terminal handlers
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (event, options: { id: string; cwd?: string }) => {
    const terminal = terminalService.createTerminal(options.id, options.cwd);
    
    // Forward terminal output to renderer
    terminal.onData((data) => {
      event.sender.send(IPC_CHANNELS.TERMINAL_DATA, options.id, data);
    });

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (event, id: string, data: string) => {
    terminalService.writeToTerminal(id, data);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (event, id: string, cols: number, rows: number) => {
    terminalService.resizeTerminal(id, cols, rows);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (event, id: string) => {
    terminalService.destroyTerminal(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_OPEN_NATIVE, async (event, options: {
    cwd?: string;
    command?: string;
    preferredApp?: string;
  }) => {
    await terminalService.openNativeTerminal(options);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_SYNC_NATIVE, async (event, terminalId: string) => {
    await terminalService.syncToNativeTerminal(terminalId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_AVAILABLE, async () => {
    const terminals = await terminalService.getAvailableTerminals();
    return terminals;
  });

  // Ollama handlers
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION, async () => {
    return await ollamaManager.checkInstallation();
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_INSTALL, async (event) => {
    await ollamaManager.downloadAndInstall((progress: number, status: string) => {
      event.sender.send('ollama:install-progress', { progress, status });
    });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_DOWNLOAD_MODEL, async (event, modelName: string) => {
    console.log(`[IPC] Starting model download: ${modelName}`);
    await ollamaManager.downloadModel(modelName, (progress: number) => {
      console.log(`[IPC] Model ${modelName} progress: ${Math.round(progress)}%`);
      event.sender.send('ollama:model-progress', { modelName, progress });
    });
    console.log(`[IPC] Model download complete: ${modelName}`);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_LIST_MODELS, async () => {
    return await ollamaManager.listModels();
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_START_SERVER, async () => {
    await ollamaManager.startServer();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_STOP_SERVER, async () => {
    await ollamaManager.stopServer();
    return { success: true };
  });

  // AI handlers (Ollama)
  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (event, messages: any[], model?: string) => {
    // Use the provided model, or fall back to first available model
    let modelToUse = model;
    if (!modelToUse) {
      const models = await ollamaManager.listModels();
      modelToUse = models?.[0] || 'qwen2.5:0.5b';
    }
    const response: any = await aiService.chat(messages, modelToUse, false);
    return { message: { content: response?.message?.content || '' } };
  });

  ipcMain.handle(IPC_CHANNELS.AI_SUMMARIZE_PAGE, async (event, html: string, url: string) => {
    try {
      return await aiService.summarizePage(html, url);
    } catch (error: any) {
      console.error('AI summarize error:', error);
      return 'Unable to summarize page. Ensure Ollama is installed, running, and a model is downloaded.';
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_EXPLAIN_OUTPUT, async (event, output: string) => {
    try {
      return await aiService.explainTerminalOutput(output);
    } catch (error: any) {
      console.error('AI explain error:', error);
      return 'Unable to explain output. Ensure Ollama is installed, running, and a model is downloaded.';
    }
  });

  // Storage handlers
  ipcMain.handle(IPC_CHANNELS.STORAGE_ADD_HISTORY, async (event, url: string, title: string) => {
    storageService.addToHistory(url, title);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_HISTORY, async (event, limit?: number) => {
    return storageService.getHistory(limit);
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_ADD_COMMAND, async (
    event,
    command: string,
    output: string,
    exitCode: number,
    workingDir: string,
    capsuleId?: string
  ) => {
    storageService.addCommandHistory(command, output, exitCode, workingDir, capsuleId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_COMMANDS, async (event, limit?: number) => {
    return storageService.getCommandHistory(limit);
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_SEARCH_COMMANDS, async (event, query: string) => {
    return storageService.searchCommandHistory(query);
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_CREATE_CAPSULE, async (event, capsule: any) => {
    storageService.createCapsule(capsule);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_CAPSULES, async () => {
    return storageService.getCapsules();
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_ADD_BOOKMARK, async (
    event,
    id: string,
    url: string,
    title: string,
    folder?: string,
    tags?: string[]
  ) => {
    storageService.addBookmark(id, url, title, folder, tags);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_BOOKMARKS, async () => {
    return storageService.getBookmarks();
  });
}
