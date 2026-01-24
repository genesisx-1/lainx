-- Capsules (saved workspaces)
CREATE TABLE IF NOT EXISTS capsules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    layout_config TEXT, -- JSON: panel positions, sizes
    pinned_tabs TEXT,   -- JSON: array of URLs
    ai_role TEXT,       -- AI personality/role for this capsule
    tool_permissions TEXT, -- JSON: allowed tools
    hotkeys TEXT,       -- JSON: custom shortcuts
    created_at INTEGER,
    last_used INTEGER
);

-- Browser history
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    visit_count INTEGER DEFAULT 1,
    last_visit INTEGER,
    favicon TEXT
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    folder TEXT,
    tags TEXT, -- JSON array
    created_at INTEGER
);

-- AI task history
CREATE TABLE IF NOT EXISTS ai_tasks (
    id TEXT PRIMARY KEY,
    type TEXT, -- 'summarize', 'extract', 'automate', etc.
    input TEXT,
    output TEXT,
    page_url TEXT,
    created_at INTEGER,
    capsule_id TEXT,
    FOREIGN KEY (capsule_id) REFERENCES capsules(id)
);

-- Command history (terminal)
CREATE TABLE IF NOT EXISTS command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    output TEXT,
    exit_code INTEGER,
    working_dir TEXT,
    executed_at INTEGER,
    capsule_id TEXT,
    FOREIGN KEY (capsule_id) REFERENCES capsules(id)
);

-- Permission grants
CREATE TABLE IF NOT EXISTS permission_grants (
    id TEXT PRIMARY KEY,
    tool_name TEXT NOT NULL, -- 'terminal', 'clipboard', 'download', etc.
    scope TEXT,              -- specific command, URL pattern, etc.
    granted BOOLEAN,
    granted_at INTEGER,
    expires_at INTEGER
);
