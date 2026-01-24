import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { TerminalService } from './services/terminal.service';
import { EmbeddedAIService } from './services/embedded-ai.service';
import { StorageService } from './services/storage.service';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export function registerIPCHandlers(
  terminalService: TerminalService,
  aiService: EmbeddedAIService,
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

  // Embedded AI handlers (gracefully handle if AI not ready)
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK_INSTALLATION, async () => {
    try {
      return await aiService.isModelDownloaded();
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_INSTALL, async (event) => {
    try {
      await aiService.initialize((status: string, progress: number) => {
        event.sender.send('ollama:install-progress', { progress, status });
      });
      return { success: true };
    } catch (error) {
      console.error('AI initialization error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_DOWNLOAD_MODEL, async (event, modelName: string) => {
    try {
      await aiService.initialize((status: string, progress: number) => {
        event.sender.send('ollama:model-progress', { modelName, progress });
      });
      return { success: true };
    } catch (error) {
      console.error('AI model download error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_LIST_MODELS, async () => {
    try {
      return aiService.isReady() ? ['qwen2.5:0.5b (embedded)'] : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_START_SERVER, async () => {
    // No server needed for embedded AI
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_STOP_SERVER, async () => {
    // No server to stop
    return { success: true };
  });

  // AI handlers (gracefully handle if AI not ready)
  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (event, messages: any[], model?: string) => {
    try {
      if (!aiService.isReady()) {
        throw new Error('AI is not initialized. Please set up AI from the menu.');
      }
      const response = await aiService.chat(messages);
      return { message: { content: response } };
    } catch (error: any) {
      console.error('AI chat error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_SUMMARIZE_PAGE, async (event, html: string, url: string) => {
    try {
      if (!aiService.isReady()) {
        return 'AI features are not available. Enable AI from Settings to use page summarization.';
      }
      return await aiService.summarizePage(html, url);
    } catch (error: any) {
      console.error('AI summarize error:', error);
      return 'Unable to summarize page. AI features may not be fully initialized.';
    }
  });

  ipcMain.handle(IPC_CHANNELS.AI_EXPLAIN_OUTPUT, async (event, output: string) => {
    try {
      if (!aiService.isReady()) {
        return 'AI features are not available. Enable AI from Settings to explain terminal output.';
      }
      return await aiService.explainTerminalOutput(output);
    } catch (error: any) {
      console.error('AI explain error:', error);
      return 'Unable to explain output. AI features may not be fully initialized.';
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
