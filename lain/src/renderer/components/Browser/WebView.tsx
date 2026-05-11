import React, { useEffect, useRef, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { WelcomePage } from './WelcomePage';
import { FindInPage } from './FindInPage';
import { WebViewContextMenu } from './WebViewContextMenu';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

interface WebViewProps {
  showFindInPage?: boolean;
  onCloseFindInPage?: () => void;
  onNavigate?: (url: string, title: string) => void;
}

export const WebView = forwardRef<Electron.WebviewTag | null, WebViewProps>(function WebView(
  { showFindInPage, onCloseFindInPage, onNavigate },
  ref
) {
  const { tabs, activeTabId, updateTab, setWebviewApi, addTab, agentDrivingTabId } = useBrowserStore();
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

    const onPageFaviconUpdated = (e: any) => {
      const fav = Array.isArray(e?.favicons) ? e.favicons[0] : undefined;
      if (fav) updateTab(tabId, { favicon: fav });
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

      // Get interactive elements for browser agent (richer: ARIA, role, rect)
      getInteractiveElements: async (): Promise<any[]> => {
        try {
          return await webview.executeJavaScript(`
            (function() {
              const elements = [];
              const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [contenteditable="true"], [onclick], summary';
              const nodes = Array.from(document.querySelectorAll(selectors));
              let kept = 0;
              for (let i = 0; i < nodes.length && kept < 200; i++) {
                const el = nodes[i];
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
                const inViewport = rect.bottom > 0 && rect.right > 0 && rect.top < (window.innerHeight + 200) && rect.left < (window.innerWidth + 200);
                if (!inViewport) continue;
                elements.push({
                  index: i,
                  tag: el.tagName.toLowerCase(),
                  text: (el.innerText || el.value || '').slice(0, 80).replace(/\\s+/g, ' ').trim(),
                  type: el.getAttribute('type') || null,
                  placeholder: el.getAttribute('placeholder') || null,
                  ariaLabel: el.getAttribute('aria-label') || null,
                  role: el.getAttribute('role') || null,
                  href: el.getAttribute('href') || null,
                  rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
                  visible: true
                });
                kept++;
              }
              return elements;
            })();
          `);
        } catch (e) {
          console.error('Failed to get interactive elements:', e);
          return [];
        }
      },
      screenshot: async (): Promise<string | null> => {
        try {
          const img = await (webview as any).capturePage?.();
          if (!img) return null;
          // NativeImage in the renderer: toDataURL() returns "data:image/png;base64,..."
          const url: string | undefined = typeof img.toDataURL === 'function' ? img.toDataURL() : undefined;
          if (!url) return null;
          const comma = url.indexOf(',');
          return comma >= 0 ? url.slice(comma + 1) : url;
        } catch (e) {
          console.error('Failed to capture screenshot:', e);
          return null;
        }
      },
      clickBySelector: async (selector: string): Promise<boolean> => {
        try {
          const escaped = selector.replace(/'/g, "\\'");
          return await webview.executeJavaScript(`
            (function() {
              const el = document.querySelector('${escaped}');
              if (el) { el.click(); return true; }
              return false;
            })();
          `);
        } catch {
          return false;
        }
      },
      typeBySelector: async (selector: string, text: string, submit?: boolean): Promise<boolean> => {
        try {
          const escSel = selector.replace(/'/g, "\\'");
          const escText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
          return await webview.executeJavaScript(`
            (function() {
              const el = document.querySelector('${escSel}');
              if (!el) return false;
              el.focus();
              if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = '${escText}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              } else if (el.isContentEditable) {
                el.textContent = '${escText}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                return false;
              }
              ${submit ? `el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); if (el.form) el.form.submit?.();` : ''}
              return true;
            })();
          `);
        } catch {
          return false;
        }
      },
      scrollTo: async (dest: 'top' | 'bottom' | number): Promise<void> => {
        try {
          if (dest === 'top') {
            await webview.executeJavaScript(`window.scrollTo({ top: 0, behavior: 'instant' });`);
          } else if (dest === 'bottom') {
            await webview.executeJavaScript(`window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });`);
          } else {
            await webview.executeJavaScript(`window.scrollBy(0, ${Number(dest) || 0});`);
          }
        } catch {
          // ignore
        }
      },
      waitFor: async ({ selector, text, ms }: { selector?: string; text?: string; ms?: number }): Promise<boolean> => {
        const timeout = Math.min(Math.max(ms || 3000, 100), 10000);
        const escSel = (selector || '').replace(/'/g, "\\'");
        const escText = (text || '').replace(/'/g, "\\'");
        try {
          return await webview.executeJavaScript(`
            (function() {
              return new Promise((resolve) => {
                const deadline = Date.now() + ${timeout};
                function check() {
                  if (${selector ? `document.querySelector('${escSel}')` : 'false'}) return resolve(true);
                  if (${text ? `(document.body && document.body.innerText.indexOf('${escText}') !== -1)` : 'false'}) return resolve(true);
                  if (Date.now() > deadline) return resolve(false);
                  setTimeout(check, 150);
                }
                check();
              });
            })();
          `);
        } catch {
          return false;
        }
      },
      extractText: async (selector?: string): Promise<string> => {
        const escSel = (selector || '').replace(/'/g, "\\'");
        try {
          return await webview.executeJavaScript(`
            (function() {
              if (${selector ? `'${escSel}'.length > 0` : 'false'}) {
                const nodes = document.querySelectorAll('${escSel}');
                return Array.from(nodes).map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean).join('\\n').slice(0, 6000);
              }
              return (document.body ? document.body.innerText : '').slice(0, 6000);
            })();
          `);
        } catch {
          return '';
        }
      },
      pressEnter: async (): Promise<void> => {
        try {
          await webview.executeJavaScript(`
            (function() {
              const el = document.activeElement;
              if (!el) return;
              const e = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
              el.dispatchEvent(e);
              if (el.form) try { el.form.submit?.(); } catch {}
            })();
          `);
        } catch {
          // ignore
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

  // Renderer side of the BROWSER_AGENT_ACTION RPC. The main-process
  // orchestrator sends action requests here; we dispatch them against the
  // active webview's API and reply with the result.
  useEffect(() => {
    const handle = async (payload: { requestId: string; tabId: string; action: string; args: any }) => {
      const { requestId, tabId, action, args } = payload || ({} as any);
      const reply = (result?: any, error?: string) => {
        window.electron.ipcRenderer.send(`${IPC_CHANNELS.BROWSER_AGENT_ACTION}:result`, {
          requestId,
          result,
          error,
        });
      };
      try {
        // Resolve the target webview. We prefer the one specified by tabId; if
        // it's not available right now, fall back to the active webview.
        const webview = (tabId && webviewsByIdRef.current[tabId]) || activeWebviewRef.current;
        if (!webview) {
          reply(undefined, 'No webview available');
          return;
        }
        const api = useBrowserStore.getState().webviewApi;
        switch (action) {
          case 'navigate': {
            const url: string = args?.url || '';
            if (!url) return reply({ ok: false, message: 'No URL' });
            try {
              await webview.loadURL?.(url);
              useBrowserStore.getState().updateTab(tabId, { url, isLoading: true });
              reply({ ok: true, message: `Navigating to ${url}` });
            } catch (e: any) {
              reply({ ok: false, message: e?.message || 'Navigation failed' });
            }
            return;
          }
          case 'observe': {
            const elements = (await api?.getInteractiveElements?.()) || [];
            const content = (await api?.getPageContent?.()) || { url: '', title: '', text: '', html: '' };
            const screenshot = args?.withScreenshot && api?.screenshot ? await api.screenshot() : undefined;
            reply({
              url: content.url,
              title: content.title,
              text: (content.text || '').slice(0, 6000),
              elements,
              screenshot: screenshot || undefined,
            });
            return;
          }
          case 'click': {
            if (typeof args?.index === 'number') {
              const ok = await api?.clickElement?.(args.index);
              return reply({ ok: !!ok, message: ok ? `Clicked [${args.index}]` : `Click failed for [${args.index}]` });
            }
            if (typeof args?.selector === 'string' && api?.clickBySelector) {
              const ok = await api.clickBySelector(args.selector);
              return reply({ ok, message: ok ? `Clicked ${args.selector}` : `Click failed for ${args.selector}` });
            }
            return reply({ ok: false, message: 'No index or selector provided' });
          }
          case 'type': {
            const text = String(args?.text || '');
            if (typeof args?.index === 'number') {
              const ok = await api?.typeInElement?.(args.index, text);
              if (ok && args?.submit && api?.pressEnter) await api.pressEnter();
              return reply({ ok: !!ok, message: ok ? `Typed into [${args.index}]` : `Type failed for [${args.index}]` });
            }
            if (typeof args?.selector === 'string' && api?.typeBySelector) {
              const ok = await api.typeBySelector(args.selector, text, !!args?.submit);
              return reply({ ok, message: ok ? `Typed into ${args.selector}` : `Type failed for ${args.selector}` });
            }
            return reply({ ok: false, message: 'No index or selector provided' });
          }
          case 'scroll': {
            const dir = args?.direction;
            const pixels = args?.pixels;
            if (typeof pixels === 'number' && api?.scrollTo) {
              await api.scrollTo(pixels);
              return reply({ ok: true, message: `Scrolled ${pixels}px` });
            }
            if ((dir === 'top' || dir === 'bottom') && api?.scrollTo) {
              await api.scrollTo(dir);
              return reply({ ok: true, message: `Scrolled to ${dir}` });
            }
            if ((dir === 'up' || dir === 'down') && api?.scrollPage) {
              await api.scrollPage(dir);
              return reply({ ok: true, message: `Scrolled ${dir}` });
            }
            return reply({ ok: false, message: 'No scroll direction/pixels' });
          }
          case 'waitFor': {
            if (!api?.waitFor) return reply({ ok: false, message: 'waitFor unsupported' });
            const ok = await api.waitFor({
              selector: typeof args?.selector === 'string' ? args.selector : undefined,
              text: typeof args?.text === 'string' ? args.text : undefined,
              ms: typeof args?.ms === 'number' ? args.ms : undefined,
            });
            return reply({ ok, message: ok ? 'Condition met' : 'Wait timed out' });
          }
          case 'extract': {
            const text = api?.extractText ? await api.extractText(args?.selector) : (await api?.getPageContent?.())?.text || '';
            return reply({ ok: true, text: (text || '').slice(0, 6000) });
          }
          case 'screenshot': {
            const data = api?.screenshot ? await api.screenshot() : null;
            return reply({ ok: !!data, data: data || undefined, message: data ? undefined : 'Screenshot unavailable' });
          }
          case 'listInteractive': {
            const elements = (await api?.getInteractiveElements?.()) || [];
            return reply(elements);
          }
          default:
            return reply(undefined, `Unknown action: ${action}`);
        }
      } catch (e: any) {
        reply(undefined, e?.message || String(e));
      }
    };
    const unsub = window.electron.ipcRenderer.on(IPC_CHANNELS.BROWSER_AGENT_ACTION, handle);
    return () => {
      try { unsub(); } catch { /* ignore */ }
    };
  }, []);

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

      {/* Agent-is-driving overlay */}
      {agentDrivingTabId === activeTabId && (
        <div className="pointer-events-none absolute inset-0 ring-2 ring-violet-500/70 animate-pulse z-10">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto px-3 py-1.5 rounded-full bg-violet-600/90 text-white text-xs shadow-lg">
            LAIN agent is driving — click here to pause
          </div>
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
