import Store from 'electron-store';

interface StoreSchema {
  capsules: any[];
  history: any[];
  bookmarks: any[];
  commandHistory: any[];
  permissionGrants: any[];
}

export class StorageService {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      defaults: {
        capsules: [],
        history: [],
        bookmarks: [],
        commandHistory: [],
        permissionGrants: []
      }
    });
  }

  // Capsule operations
  createCapsule(capsule: any) {
    const capsules = this.store.get('capsules');
    capsules.push({
      ...capsule,
      created_at: Date.now(),
      last_used: Date.now()
    });
    this.store.set('capsules', capsules);
  }

  getCapsules() {
    return this.store.get('capsules').sort((a, b) => b.last_used - a.last_used);
  }

  updateCapsule(id: string, updates: any) {
    const capsules = this.store.get('capsules');
    const idx = capsules.findIndex((c: any) => c.id === id);
    if (idx === -1) throw new Error('Capsule not found');
    capsules[idx] = { ...capsules[idx], ...updates, last_used: Date.now() };
    this.store.set('capsules', capsules);
  }

  deleteCapsule(id: string) {
    const capsules = this.store.get('capsules');
    this.store.set(
      'capsules',
      capsules.filter((c: any) => c.id !== id)
    );
  }

  touchCapsuleLastUsed(id: string) {
    const capsules = this.store.get('capsules');
    const idx = capsules.findIndex((c: any) => c.id === id);
    if (idx === -1) return;
    capsules[idx] = { ...capsules[idx], last_used: Date.now() };
    this.store.set('capsules', capsules);
  }

  // History operations
  addToHistory(url: string, title: string) {
    const history = this.store.get('history');
    const existing = history.find((h: any) => h.url === url);
    
    if (existing) {
      existing.visit_count++;
      existing.last_visit = Date.now();
    } else {
      history.push({
        id: Date.now(),
        url,
        title,
        visit_count: 1,
        last_visit: Date.now()
      });
    }
    
    this.store.set('history', history);
  }

  getHistory(limit = 50) {
    const history = this.store.get('history');
    return history
      .sort((a: any, b: any) => b.last_visit - a.last_visit)
      .slice(0, limit);
  }

  // Command history operations
  addCommandHistory(command: string, output: string, exitCode: number, workingDir: string, capsuleId?: string) {
    const commands = this.store.get('commandHistory');
    commands.push({
      id: Date.now(),
      command,
      output,
      exit_code: exitCode,
      working_dir: workingDir,
      executed_at: Date.now(),
      capsule_id: capsuleId
    });
    
    // Keep only last 1000 commands
    if (commands.length > 1000) {
      commands.shift();
    }
    
    this.store.set('commandHistory', commands);
  }

  getCommandHistory(limit = 100) {
    const commands = this.store.get('commandHistory');
    return commands
      .sort((a: any, b: any) => b.executed_at - a.executed_at)
      .slice(0, limit);
  }

  searchCommandHistory(query: string) {
    const commands = this.store.get('commandHistory');
    return commands
      .filter((cmd: any) => cmd.command.toLowerCase().includes(query.toLowerCase()))
      .sort((a: any, b: any) => b.executed_at - a.executed_at)
      .slice(0, 50);
  }

  // Bookmark operations
  addBookmark(id: string, url: string, title: string, folder?: string, tags?: string[]) {
    const bookmarks = this.store.get('bookmarks');
    bookmarks.push({
      id,
      url,
      title,
      folder,
      tags,
      created_at: Date.now()
    });
    this.store.set('bookmarks', bookmarks);
  }

  getBookmarks() {
    const bookmarks = this.store.get('bookmarks');
    return bookmarks.sort((a: any, b: any) => b.created_at - a.created_at);
  }

  // Permission operations
  grantPermission(toolName: string, scope: string, granted: boolean, expiresAt?: number) {
    const permissions = this.store.get('permissionGrants');
    permissions.push({
      id: `${toolName}-${scope}-${Date.now()}`,
      tool_name: toolName,
      scope,
      granted,
      granted_at: Date.now(),
      expires_at: expiresAt
    });
    this.store.set('permissionGrants', permissions);
  }

  checkPermission(toolName: string, scope: string): boolean {
    const permissions = this.store.get('permissionGrants');
    const grant = permissions
      .filter((p: any) => p.tool_name === toolName && p.scope === scope && p.granted)
      .filter((p: any) => !p.expires_at || p.expires_at > Date.now())
      .sort((a: any, b: any) => b.granted_at - a.granted_at)[0];
    
    return !!grant;
  }

  close() {
    // electron-store doesn't need explicit closing
  }
}
