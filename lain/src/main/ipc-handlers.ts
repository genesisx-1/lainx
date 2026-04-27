import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import { TerminalService } from './services/terminal.service';
import { AIService } from './services/ai.service';
import { OllamaManagerService } from './services/ollama-manager.service';
import { StorageService } from './services/storage.service';
import { HistoryService } from './services/history.service';
import { AgentService } from './services/agent.service';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const historyService = new HistoryService();
const agentService = new AgentService();

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

  ipcMain.handle(IPC_CHANNELS.TERMINAL_SYNC_NATIVE, async (_event, options: {
    terminalId: string;
    preferredApp?: string;
  }) => {
    await terminalService.syncToNativeTerminal(options.terminalId, options.preferredApp);
    return { success: true };
  });

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_SET_LAST_COMMAND,
    async (_event, terminalId: string, command: string) => {
      terminalService.setLastCommand(terminalId, command);
      return { success: true };
    }
  );

  ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_CWD, async (_event, terminalId: string) => {
    return await terminalService.getTerminalCwd(terminalId);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_LAST_COMMAND, async (_event, terminalId: string) => {
    return terminalService.getLastCommand(terminalId);
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

  ipcMain.handle(IPC_CHANNELS.STORAGE_UPDATE_CAPSULE, async (_event, id: string, updates: any) => {
    storageService.updateCapsule(id, updates);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_DELETE_CAPSULE, async (_event, id: string) => {
    storageService.deleteCapsule(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_EXPORT_CAPSULE, async (_event, id: string) => {
    const capsules = storageService.getCapsules();
    const capsule = capsules.find((c: any) => c.id === id);
    if (!capsule) throw new Error('Capsule not found');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Capsule',
      defaultPath: `${capsule.name || 'capsule'}.lain-capsule.json`,
      filters: [{ name: 'LAIN Capsule', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    fs.writeFileSync(filePath, JSON.stringify(capsule, null, 2), 'utf8');
    return { success: true, filePath };
  });

  ipcMain.handle(IPC_CHANNELS.STORAGE_IMPORT_CAPSULE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Capsule',
      properties: ['openFile'],
      filters: [{ name: 'LAIN Capsule', extensions: ['json'] }]
    });
    if (canceled || !filePaths?.[0]) return { success: false, canceled: true };

    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid capsule file');
    if (!parsed.id) parsed.id = `cap-${Date.now()}`;
    if (!parsed.name) parsed.name = 'Imported Capsule';
    storageService.createCapsule(parsed);
    return { success: true, capsule: parsed };
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

  // Browser navigation history (main-process)
  ipcMain.handle(IPC_CHANNELS.BROWSER_NAVIGATE, async (_event, _tabId: string, _url: string) => {
    // webview handles actual navigation; keep this for symmetry/future
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_ADD_HISTORY, async (_event, tabId: string, url: string, title: string) => {
    historyService.addEntry(tabId, url, title);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_BACK, async (_event, tabId: string) => {
    return historyService.goBack(tabId);
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_FORWARD, async (_event, tabId: string) => {
    return historyService.goForward(tabId);
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_CAN_GO_BACK, async (_event, tabId: string) => {
    return historyService.canGoBack(tabId);
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_CAN_GO_FORWARD, async (_event, tabId: string) => {
    return historyService.canGoForward(tabId);
  });

  // Agent Orchestration handlers
  ipcMain.handle(IPC_CHANNELS.AGENT_CHECK_STATUS, async () => {
    return await agentService.checkAllStatuses();
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_RUN_COMMAND, async (event, agentId: string, prompt: string) => {
    return await agentService.runAgentCommand(agentId as any, prompt, (data) => {
      event.sender.send(IPC_CHANNELS.AGENT_COMMAND_OUTPUT, { agentId, data });
    });
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_GET_TASKS, async () => {
    return await agentService.getTasks();
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_CREATE_TASK, async (_event, task: any) => {
    return await agentService.createTask(task);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_UPDATE_TASK, async (_event, id: string, updates: any) => {
    return await agentService.updateTask(id, updates);
  });
}
