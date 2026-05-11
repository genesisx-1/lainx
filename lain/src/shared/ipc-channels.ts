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

  // Browser navigation (main-process history)
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_ADD_HISTORY: 'browser:add-history',
  BROWSER_BACK: 'browser:back',
  BROWSER_FORWARD: 'browser:forward',
  BROWSER_CAN_GO_BACK: 'browser:can-go-back',
  BROWSER_CAN_GO_FORWARD: 'browser:can-go-forward',

  // Window/App
  SHOW_ONBOARDING: 'show-onboarding',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  ONBOARDING_SKIP: 'onboarding:skip',

  // Multi-provider AI (new agent stack)
  PROVIDER_LIST: 'provider:list',
  PROVIDER_SET_KEY: 'provider:set-key',
  PROVIDER_CLEAR_KEY: 'provider:clear-key',
  PROVIDER_TEST: 'provider:test',
  PROVIDER_SET_MODELS: 'provider:set-models',
  PROVIDER_CHAT: 'provider:chat',

  // Agent orchestrator
  AGENT_START: 'agent:start',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_CANCEL: 'agent:cancel',
  AGENT_TAKEOVER: 'agent:takeover',
  AGENT_RESPOND_USER: 'agent:respond-user',
  AGENT_LIST_TASKS: 'agent:list-tasks',
  AGENT_GET_TASK: 'agent:get-task',
  AGENT_EVENT: 'agent:event',

  // Browser primitives the agent uses
  BROWSER_SCREENSHOT: 'browser:screenshot',
  BROWSER_OBSERVE: 'browser:observe',
  BROWSER_AGENT_ACTION: 'browser:agent-action',
  BROWSER_SEND_INPUT: 'browser:send-input',

  // Local control server / CLI
  CONTROL_SERVER_GET_INFO: 'control-server:get-info',
  CONTROL_SERVER_REGENERATE_TOKEN: 'control-server:regenerate-token',
  CONTROL_SERVER_SET_ENABLED: 'control-server:set-enabled',
} as const;
