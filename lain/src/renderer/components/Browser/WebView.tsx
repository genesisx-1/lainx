import React, { useEffect, useRef, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { useUIStore } from '../../store/ui.store';
import { WelcomePage } from './WelcomePage';
import { FindInPage } from './FindInPage';
import { WebViewContextMenu } from './WebViewContextMenu';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

function getHost(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

function matchBlockRule(host: string, rule: string): boolean {
  const r = (rule || '').trim().toLowerCase();
  if (!r || !host) return false;
  if (host === r) return true;
  if (host.endsWith('.' + r)) return true;
  return host.includes(r);
}

interface WebViewProps {
  showFindInPage?: boolean;
  onCloseFindInPage?: () => void;
  onNavigate?: (url: string, title: string) => void;
}

export const WebView = forwardRef<Electron.WebviewTag | null, WebViewProps>(function WebView(
  { showFindInPage, onCloseFindInPage, onNavigate },
  ref
) {
  const { tabs, activeTabId, updateTab, setWebviewApi, addTab } = useBrowserStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const webviewsByIdRef = useRef<Record<string, any>>({});
  const cleanupByIdRef = useRef<Record<string, (() => void) | undefined>>({});
  const updateTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const activeWebviewRef = useRef<Electron.WebviewTag | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    linkUrl?: string;
    imageUrl?: string;
    selectedText?: string;
  } | null>(null);

  // Expose ref to parent (typed as potentially null)
  useImperativeHandle(ref, () => activeWebviewRef.current!, [activeTabId]);

  const updateNavStateFor = useCallback((tabId: string, webview: any) => {
    // Debounce navigation state updates to avoid freezing
    if (updateTimersRef.current[tabId]) {
      clearTimeout(updateTimersRef.current[tabId]);
    }

    updateTimersRef.current[tabId] = setTimeout(() => {
      (async () => {
        try {
          const tab = useBrowserStore.getState().tabs.find((t) => t.id === tabId);
          if (tab?.isPrivate) {
            updateTab(tabId, {
              canGoBack: webview.canGoBack?.() ?? false,
              canGoForward: webview.canGoForward?.() ?? false
            });
            return;
          }

          const [canGoBack, canGoForward] = await Promise.all([
            window.electron.ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CAN_GO_BACK, tabId),
            window.electron.ipcRenderer.invoke(IPC_CHANNELS.BROWSER_CAN_GO_FORWARD, tabId)
          ]);

          updateTab(tabId, {
            canGoBack: !!canGoBack,
            canGoForward: !!canGoForward
          });
        } catch {
          // ignore
        }
      })();
      delete updateTimersRef.current[tabId];
    }, 100);
  }, [updateTab]);

  const setWebviewRef = useCallback((tabId: string) => (el: any) => {
    // Unmount
    if (!el) {
      if (updateTimersRef.current[tabId]) {
        clearTimeout(updateTimersRef.current[tabId]);
        delete updateTimersRef.current[tabId];
      }
      cleanupByIdRef.current[tabId]?.();
      delete cleanupByIdRef.current[tabId];
      delete webviewsByIdRef.current[tabId];
      return;
    }

    webviewsByIdRef.current[tabId] = el;

    // Already wired
    if (cleanupByIdRef.current[tabId]) return;

    const webview = el;

    const shouldBlockUrl = (url: string) => {
      const ui = useUIStore.getState();
      if (!ui.focusMode) return { blocked: false };
      const now = Date.now();
      if (ui.breakGlass.until && ui.breakGlass.until > now) return { blocked: false };
      const host = getHost(url);
      for (const rule of ui.focusBlocklist || []) {
        if (matchBlockRule(host, rule)) return { blocked: true, rule };
      }
      return { blocked: false };
    };

    const onDidStartLoading = () => {
      updateTab(tabId, { isLoading: true });
      updateNavStateFor(tabId, webview);
    };

    const onDidStopLoading = () => {
      const url = webview.getURL?.() || '';
      const title = webview.getTitle?.() || 'New Tab';
      updateTab(tabId, {
        isLoading: false,
        title,
        url
      });
      updateNavStateFor(tabId, webview);
      
      // Track in history
      const tab = useBrowserStore.getState().tabs.find((t) => t.id === tabId);
      if (tab?.isPrivate) return;
      if (onNavigate && url && !url.startsWith('lain://')) {
        onNavigate(url, title);
      }

      // Main-process navigation history (for back/forward)
      if (url && !url.startsWith('lain://')) {
        window.electron.ipcRenderer.invoke(IPC_CHANNELS.BROWSER_ADD_HISTORY, tabId, url, title).catch(() => {
          // ignore
        });
      }
    };

    const onPageTitleUpdated = (e: any) => {
      if (e?.title) updateTab(tabId, { title: e.title });
    };

    const onDidNavigate = (e: any) => {
      if (e?.url) updateTab(tabId, { url: e.url });
      updateNavStateFor(tabId, webview);
    };

    const onDidNavigateInPage = (e: any) => {
      if (e?.url) updateTab(tabId, { url: e.url });
      updateNavStateFor(tabId, webview);
    };

    // Focus mode: block navigation & new window.
    const onWillNavigate = (e: any) => {
      const url = e?.url || '';
      const ui = useUIStore.getState();
      if (ui.focusMode && ui.focusLockedTabId && ui.focusLockedTabId !== tabId) {
        try {
          e.preventDefault?.();
        } catch {
          // ignore
        }
        useUIStore.getState().showFocusBlocked({ url, rule: 'Focus Mode: locked to one tab' });
        return;
      }
      const res = shouldBlockUrl(url);
      if (res.blocked) {
        try {
          e.preventDefault?.();
        } catch {
          // ignore
        }
        useUIStore.getState().showFocusBlocked({ url, rule: res.rule || 'blocked' });
      }
    };

    const onNewWindow = (e: any) => {
      const url = e?.url || e?.params?.url || '';
      const ui = useUIStore.getState();
      if (!ui.focusMode) return;
      // Always prevent new-window while focusing (single tab lock).
      try {
        e.preventDefault?.();
      } catch {
        // ignore
      }
      const res = shouldBlockUrl(url);
      useUIStore.getState().showFocusBlocked({
        url: url || '(new window)',
        rule: res.blocked ? (res.rule || 'blocked') : 'Focus Mode: new windows disabled'
      });
    };

    const onPageFaviconUpdated = (e: any) => {
      const fav = Array.isArray(e?.favicons) ? e.favicons[0] : undefined;
      if (fav) updateTab(tabId, { favicon: fav });
    };

    // Tab audio indicator
    const onMediaStartedPlaying = () => {
      updateTab(tabId, { isAudioPlaying: true });
    };
    const onMediaPaused = () => {
      updateTab(tabId, { isAudioPlaying: false });
    };

    // Context menu handler
    const onContextMenu = (e: any) => {
      setContextMenu({
        x: e.params?.x || e.x || 100,
        y: e.params?.y || e.y || 100,
        linkUrl: e.params?.linkURL || undefined,
        imageUrl: e.params?.srcURL || undefined,
        selectedText: e.params?.selectionText || undefined
      });
    };

    webview.addEventListener('did-start-loading', onDidStartLoading);
    webview.addEventListener('did-stop-loading', onDidStopLoading);
    webview.addEventListener('page-title-updated', onPageTitleUpdated);
    webview.addEventListener('did-navigate', onDidNavigate);
    webview.addEventListener('did-navigate-in-page', onDidNavigateInPage);
    webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);
    webview.addEventListener('context-menu', onContextMenu);
    webview.addEventListener('will-navigate', onWillNavigate);
    webview.addEventListener('new-window', onNewWindow);
    webview.addEventListener('media-started-playing', onMediaStartedPlaying);
    webview.addEventListener('media-paused', onMediaPaused);

    // Initial state
    updateNavStateFor(tabId, webview);

    cleanupByIdRef.current[tabId] = () => {
      webview.removeEventListener('did-start-loading', onDidStartLoading);
      webview.removeEventListener('did-stop-loading', onDidStopLoading);
      webview.removeEventListener('page-title-updated', onPageTitleUpdated);
      webview.removeEventListener('did-navigate', onDidNavigate);
      webview.removeEventListener('did-navigate-in-page', onDidNavigateInPage);
      webview.removeEventListener('page-favicon-updated', onPageFaviconUpdated);
      webview.removeEventListener('context-menu', onContextMenu);
      webview.removeEventListener('will-navigate', onWillNavigate);
      webview.removeEventListener('new-window', onNewWindow);
      webview.removeEventListener('media-started-playing', onMediaStartedPlaying);
      webview.removeEventListener('media-paused', onMediaPaused);
    };
  }, [updateTab, updateNavStateFor, onNavigate]);

  // Expose navigation controls for the active tab.
  useEffect(() => {
    if (!activeTabId) {
      setWebviewApi(null);
      activeWebviewRef.current = null;
      return;
    }

    const webview = webviewsByIdRef.current[activeTabId];
    if (!webview) {
      setWebviewApi(null);
      activeWebviewRef.current = null;
      return;
    }

    activeWebviewRef.current = webview;

    setWebviewApi({
      goBack: () => {
        try {
          const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTabId);
          if (tab?.isPrivate) {
            if (webview.canGoBack?.()) webview.goBack();
            return;
          }

          window.electron.ipcRenderer
            .invoke(IPC_CHANNELS.BROWSER_BACK, activeTabId)
            .then((url: string | null) => {
              if (!url) return;
              updateTab(activeTabId, { url, isLoading: true });
              try {
                webview.loadURL?.(url);
              } catch {
                // ignore
              }
            })
            .catch(() => {
              // ignore
            });
        } finally {
          updateNavStateFor(activeTabId, webview);
        }
      },
      goForward: () => {
        try {
          const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTabId);
          if (tab?.isPrivate) {
            if (webview.canGoForward?.()) webview.goForward();
            return;
          }

          window.electron.ipcRenderer
            .invoke(IPC_CHANNELS.BROWSER_FORWARD, activeTabId)
            .then((url: string | null) => {
              if (!url) return;
              updateTab(activeTabId, { url, isLoading: true });
              try {
                webview.loadURL?.(url);
              } catch {
                // ignore
              }
            })
            .catch(() => {
              // ignore
            });
        } finally {
          updateNavStateFor(activeTabId, webview);
        }
      },
      reload: () => {
        try {
          webview.reload();
        } finally {
          updateNavStateFor(activeTabId, webview);
        }
      },
      stop: () => {
        try {
          webview.stop();
        } finally {
          updateNavStateFor(activeTabId, webview);
        }
      },
      // Extract page content for AI analysis
      getPageContent: async (): Promise<{ url: string; title: string; text: string; html: string }> => {
        try {
          const url = webview.getURL?.() || '';
          const title = webview.getTitle?.() || '';
          
          // Execute script in webview to extract page content
          const result = await webview.executeJavaScript(`
            (function() {
              // Get visible text content
              const body = document.body;
              const text = body ? body.innerText : '';
              
              // Get HTML (limited to avoid huge payloads)
              const html = document.documentElement.outerHTML.slice(0, 50000);
              
              return { text, html };
            })();
          `);
          
          return {
            url,
            title,
            text: result?.text || '',
            html: result?.html || ''
          };
        } catch (e) {
          console.error('Failed to get page content:', e);
          return { url: '', title: '', text: '', html: '' };
        }
      },

      // Get interactive elements for browser agent
      getInteractiveElements: async (): Promise<Array<{ index: number; tag: string; text: string; type?: string; placeholder?: string }>> => {
        try {
          return await webview.executeJavaScript(`
            (function() {
              const elements = [];
              const selectors = 'a, button, input, textarea, select, [role="button"], [onclick]';
              const nodes = document.querySelectorAll(selectors);
              
              nodes.forEach((el, idx) => {
                if (idx > 50) return; // Limit to first 50 elements
                
                const rect = el.getBoundingClientRect();
                // Only include visible elements
                if (rect.width > 0 && rect.height > 0) {
                  elements.push({
                    index: idx,
                    tag: el.tagName.toLowerCase(),
                    text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').slice(0, 50),
                    type: el.type || null,
                    placeholder: el.placeholder || null
                  });
                }
              });
              
              return elements;
            })();
          `);
        } catch (e) {
          console.error('Failed to get interactive elements:', e);
          return [];
        }
      },

      // Click an element by index
      clickElement: async (index: number): Promise<boolean> => {
        try {
          return await webview.executeJavaScript(`
            (function() {
              const selectors = 'a, button, input, textarea, select, [role="button"], [onclick]';
              const nodes = document.querySelectorAll(selectors);
              const el = nodes[${index}];
              if (el) {
                el.click();
                return true;
              }
              return false;
            })();
          `);
        } catch (e) {
          console.error('Failed to click element:', e);
          return false;
        }
      },

      // Type text into an element
      typeInElement: async (index: number, text: string): Promise<boolean> => {
        try {
          const escapedText = text.replace(/'/g, "\\'").replace(/\n/g, '\\n');
          return await webview.executeJavaScript(`
            (function() {
              const selectors = 'a, button, input, textarea, select, [role="button"], [onclick]';
              const nodes = document.querySelectorAll(selectors);
              const el = nodes[${index}];
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                el.focus();
                el.value = '${escapedText}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
              }
              return false;
            })();
          `);
        } catch (e) {
          console.error('Failed to type in element:', e);
          return false;
        }
      },

      // Scroll the page
      scrollPage: async (direction: 'up' | 'down'): Promise<void> => {
        try {
          const amount = direction === 'down' ? 500 : -500;
          await webview.executeJavaScript(`window.scrollBy(0, ${amount});`);
        } catch (e) {
          console.error('Failed to scroll:', e);
        }
      },

      // Execute arbitrary safe JavaScript
      executeScript: async (script: string): Promise<any> => {
        try {
          return await webview.executeJavaScript(script);
        } catch (e) {
          console.error('Failed to execute script:', e);
          return null;
        }
      }
    });

    updateNavStateFor(activeTabId, webview);

    return () => setWebviewApi(null);
  }, [activeTabId, setWebviewApi, updateNavStateFor]);

  // Apply per-tab zoom factor whenever it changes.
  useEffect(() => {
    if (!activeTabId) return;
    const webview = webviewsByIdRef.current[activeTabId];
    if (!webview) return;
    try {
      const tab = useBrowserStore.getState().tabs.find((t) => t.id === activeTabId);
      const zoom = tab?.zoomFactor ?? 1;
      if (typeof webview.setZoomFactor === 'function') {
        webview.setZoomFactor(zoom);
      }
    } catch {
      // ignore
    }
  }, [activeTabId, activeTab?.zoomFactor]);

  // Memoize tab URLs to prevent unnecessary updates
  const tabsToRender = useMemo(() => {
    return tabs.filter((t) => t.url !== 'lain://welcome');
  }, [tabs]);

  if (!activeTab) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        No active tab
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-bg-primary relative">
      {/* Keep one webview per tab so tab state is preserved */}
      {tabsToRender.map((tab) => (
        <webview
          key={tab.id}
          ref={setWebviewRef(tab.id)}
          src={tab.url}
          partition={tab.isPrivate ? 'incognito' : undefined}
          allowpopups={true as any}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: tab.isActive ? 'flex' : 'none',
            background: '#ffffff'
          }}
        />
      ))}

      {/* Welcome page overlays when active tab is welcome */}
      {activeTab.url === 'lain://welcome' && (
        <div className="absolute inset-0">
          <WelcomePage />
        </div>
      )}

      {/* Find in page */}
      {showFindInPage && activeWebviewRef.current && (
        <FindInPage
          webviewRef={activeWebviewRef as React.RefObject<Electron.WebviewTag>}
          onClose={() => onCloseFindInPage?.()}
        />
      )}

      {/* Context menu */}
      {contextMenu && activeTab && (
        <WebViewContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          linkUrl={contextMenu.linkUrl}
          imageUrl={contextMenu.imageUrl}
          selectedText={contextMenu.selectedText}
          pageUrl={activeTab.url}
          pageTitle={activeTab.title}
          onClose={() => setContextMenu(null)}
          onNavigate={(url) => updateTab(activeTabId!, { url, isLoading: true })}
          onOpenInNewTab={(url) => addTab(url)}
        />
      )}
    </div>
  );
});
