import { safeStorage } from 'electron';
import Store from 'electron-store';
import type { ProviderId, ModelPair } from '../../shared/types';

interface SecureStoreSchema {
  // base64 of safeStorage.encryptString output, keyed by provider id
  encryptedKeys: Record<string, string>;
  // Plain-text fallback for environments where safeStorage is unavailable
  // (e.g. Linux without keyring). Keys are persisted in user profile only.
  plainKeys: Record<string, string>;
  // Per-provider model pair overrides
  modelOverrides: Record<string, ModelPair>;
  // Default provider id used when none specified by caller
  defaultProvider: ProviderId;
  // Control server config
  controlServer: { enabled: boolean; port: number; token: string };
  // Per-tool/per-domain permissions
  permissions: Record<string, 'allow' | 'deny' | 'ask'>;
  // Cost cap in USD per day across all tasks
  costCapDailyUsd: number;
}

// Lazy-initialized so tests/runtime imports don't crash before app ready.
export class SecureStoreService {
  private store: Store<SecureStoreSchema> | null = null;

  private get s(): Store<SecureStoreSchema> {
    if (!this.store) {
      this.store = new Store<SecureStoreSchema>({
        name: 'lain-secure',
        defaults: {
          encryptedKeys: {},
          plainKeys: {},
          modelOverrides: {},
          defaultProvider: 'ollama',
          controlServer: {
            enabled: false,
            port: 7878,
            token: '',
          },
          permissions: {},
          costCapDailyUsd: 5,
        },
      });
    }
    return this.store;
  }

  private encryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  setApiKey(provider: ProviderId, key: string): void {
    if (!key || !key.trim()) {
      this.clearApiKey(provider);
      return;
    }
    const trimmed = key.trim();
    if (this.encryptionAvailable()) {
      const buf = safeStorage.encryptString(trimmed);
      const all = this.s.get('encryptedKeys');
      all[provider] = buf.toString('base64');
      this.s.set('encryptedKeys', all);
      // also wipe any plain fallback
      const plain = this.s.get('plainKeys');
      if (plain[provider]) {
        delete plain[provider];
        this.s.set('plainKeys', plain);
      }
    } else {
      const plain = this.s.get('plainKeys');
      plain[provider] = trimmed;
      this.s.set('plainKeys', plain);
    }
  }

  getApiKey(provider: ProviderId): string | null {
    const enc = this.s.get('encryptedKeys')[provider];
    if (enc && this.encryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'));
      } catch {
        return null;
      }
    }
    const plain = this.s.get('plainKeys')[provider];
    return plain || null;
  }

  hasApiKey(provider: ProviderId): boolean {
    const enc = this.s.get('encryptedKeys')[provider];
    if (enc) return true;
    return !!this.s.get('plainKeys')[provider];
  }

  clearApiKey(provider: ProviderId): void {
    const enc = this.s.get('encryptedKeys');
    if (enc[provider]) {
      delete enc[provider];
      this.s.set('encryptedKeys', enc);
    }
    const plain = this.s.get('plainKeys');
    if (plain[provider]) {
      delete plain[provider];
      this.s.set('plainKeys', plain);
    }
  }

  getModelOverride(provider: ProviderId): ModelPair | null {
    return this.s.get('modelOverrides')[provider] || null;
  }

  setModelOverride(provider: ProviderId, models: ModelPair): void {
    const all = this.s.get('modelOverrides');
    all[provider] = models;
    this.s.set('modelOverrides', all);
  }

  getDefaultProvider(): ProviderId {
    return this.s.get('defaultProvider');
  }

  setDefaultProvider(p: ProviderId): void {
    this.s.set('defaultProvider', p);
  }

  getControlServerConfig() {
    return this.s.get('controlServer');
  }

  setControlServerConfig(cfg: Partial<SecureStoreSchema['controlServer']>) {
    const current = this.s.get('controlServer');
    this.s.set('controlServer', { ...current, ...cfg });
  }

  getCostCapDailyUsd(): number {
    return this.s.get('costCapDailyUsd');
  }

  setCostCapDailyUsd(usd: number): void {
    this.s.set('costCapDailyUsd', Math.max(0, usd));
  }

  getPermission(key: string): 'allow' | 'deny' | 'ask' {
    return this.s.get('permissions')[key] || 'ask';
  }

  setPermission(key: string, value: 'allow' | 'deny' | 'ask'): void {
    const all = this.s.get('permissions');
    all[key] = value;
    this.s.set('permissions', all);
  }
}
