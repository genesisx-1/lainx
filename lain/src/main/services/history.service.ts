export class HistoryService {
  private histories = new Map<string, Array<{ url: string; title: string; timestamp: number }>>();
  private indices = new Map<string, number>();
  private maxEntries = 100;

  private ensure(tabId: string) {
    if (!this.histories.has(tabId)) this.histories.set(tabId, []);
    if (!this.indices.has(tabId)) this.indices.set(tabId, -1);
  }

  addEntry(tabId: string, url: string, title: string) {
    this.ensure(tabId);
    const history = this.histories.get(tabId)!;
    let currentIndex = this.indices.get(tabId)!;

    // When navigating to new page, remove any forward history
    const trimmed = history.slice(0, currentIndex + 1);

    // De-dupe consecutive identical URL
    const last = trimmed[trimmed.length - 1];
    if (last?.url === url) {
      last.title = title || last.title;
      last.timestamp = Date.now();
      this.histories.set(tabId, trimmed);
      this.indices.set(tabId, trimmed.length - 1);
      return;
    }

    trimmed.push({ url, title, timestamp: Date.now() });
    currentIndex = trimmed.length - 1;

    // Limit
    while (trimmed.length > this.maxEntries) {
      trimmed.shift();
      currentIndex--;
    }

    this.histories.set(tabId, trimmed);
    this.indices.set(tabId, currentIndex);
  }

  canGoBack(tabId: string): boolean {
    this.ensure(tabId);
    return (this.indices.get(tabId) ?? -1) > 0;
  }

  canGoForward(tabId: string): boolean {
    this.ensure(tabId);
    const history = this.histories.get(tabId)!;
    const idx = this.indices.get(tabId)!;
    return idx >= 0 && idx < history.length - 1;
  }

  goBack(tabId: string): string | null {
    if (this.canGoBack(tabId)) {
      const next = (this.indices.get(tabId) ?? 0) - 1;
      this.indices.set(tabId, next);
      return this.histories.get(tabId)![next].url;
    }
    return null;
  }

  goForward(tabId: string): string | null {
    if (this.canGoForward(tabId)) {
      const next = (this.indices.get(tabId) ?? -1) + 1;
      this.indices.set(tabId, next);
      return this.histories.get(tabId)![next].url;
    }
    return null;
  }

  getCurrentUrl(tabId: string): string | null {
    this.ensure(tabId);
    const idx = this.indices.get(tabId)!;
    const history = this.histories.get(tabId)!;
    return history[idx]?.url || null;
  }
}

