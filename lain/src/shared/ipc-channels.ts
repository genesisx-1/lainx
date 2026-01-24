// IPC Channel names - shared between main and renderer

export const IPC_CHANNELS = {
  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_OPEN_NATIVE: 'terminal:open-native',
  TERMINAL_SYNC_NATIVE: 'terminal:sync-to-native',
  TERMINAL_GET_AVAILABLE: 'terminal:get-available',

  // Ollama
  OLLAMA_CHECK_INSTALLATION: 'ollama:check-installation',
  OLLAMA_INSTALL: 'ollama:install',
  OLLAMA_DOWNLOAD_MODEL: 'ollama:download-model',
  OLLAMA_LIST_MODELS: 'ollama:list-models',
  OLLAMA_START_SERVER: 'ollama:start-server',
  OLLAMA_STOP_SERVER: 'ollama:stop-server',

  // AI
  AI_CHAT: 'ai:chat',
  AI_SUMMARIZE_PAGE: 'ai:summarize-page',
  AI_EXPLAIN_OUTPUT: 'ai:explain-output',

  // Storage
  STORAGE_ADD_HISTORY: 'storage:add-history',
  STORAGE_GET_HISTORY: 'storage:get-history',
  STORAGE_ADD_COMMAND: 'storage:add-command',
  STORAGE_GET_COMMANDS: 'storage:get-commands',
  STORAGE_SEARCH_COMMANDS: 'storage:search-commands',
  STORAGE_CREATE_CAPSULE: 'storage:create-capsule',
  STORAGE_GET_CAPSULES: 'storage:get-capsules',
  STORAGE_ADD_BOOKMARK: 'storage:add-bookmark',
  STORAGE_GET_BOOKMARKS: 'storage:get-bookmarks',

  // Downloads
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',

  // Window/App
  SHOW_ONBOARDING: 'show-onboarding',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  ONBOARDING_SKIP: 'onboarding:skip',
} as const;
