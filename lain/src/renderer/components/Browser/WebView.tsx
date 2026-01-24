import React, { useEffect, useRef } from 'react';
import { useBrowserStore } from '../../store/browser.store';
import { WelcomePage } from './WelcomePage';

export function WebView() {
  const { tabs, activeTabId, updateTab, setWebviewApi } = useBrowserStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const webviewsByIdRef = useRef<Record<string, any>>({});
  const cleanupByIdRef = useRef<Record<string, (() => void) | undefined>>({});

  const updateNavStateFor = (tabId: string, webview: any) => {
    try {
      updateTab(tabId, {
        canGoBack: webview.canGoBack?.() ?? false,
        canGoForward: webview.canGoForward?.() ?? false
      });
    } catch {
      // ignore
    }
  };

  const setWebviewRef = (tabId: string) => (el: any) => {
    // Unmount
    if (!el) {
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
      updateTab(tabId, {
        isLoading: false,
        title: webview.getTitle?.() || 'New Tab',
        url: webview.getURL?.() || ''
      });
      updateNavStateFor(tabId, webview);
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

    webview.addEventListener('did-start-loading', onDidStartLoading);
    webview.addEventListener('did-stop-loading', onDidStopLoading);
    webview.addEventListener('page-title-updated', onPageTitleUpdated);
    webview.addEventListener('did-navigate', onDidNavigate);
    webview.addEventListener('did-navigate-in-page', onDidNavigateInPage);
    webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);

    // Initial state
    updateNavStateFor(tabId, webview);

    cleanupByIdRef.current[tabId] = () => {
      webview.removeEventListener('did-start-loading', onDidStartLoading);
      webview.removeEventListener('did-stop-loading', onDidStopLoading);
      webview.removeEventListener('page-title-updated', onPageTitleUpdated);
      webview.removeEventListener('did-navigate', onDidNavigate);
      webview.removeEventListener('did-navigate-in-page', onDidNavigateInPage);
      webview.removeEventListener('page-favicon-updated', onPageFaviconUpdated);
    };
  };

  // Keep each webview's src in sync with its tab url (but preserve session state across tab switches).
  useEffect(() => {
    for (const tab of tabs) {
      if (tab.url === 'lain://welcome') continue;
      const webview = webviewsByIdRef.current[tab.id];
      if (!webview) continue;
      if (webview.src !== tab.url) webview.src = tab.url;
    }
  }, [tabs]);

  // Expose navigation controls for the active tab.
  useEffect(() => {
    if (!activeTabId) {
      setWebviewApi(null);
      return;
    }

    const webview = webviewsByIdRef.current[activeTabId];
    if (!webview) {
      setWebviewApi(null);
      return;
    }

    setWebviewApi({
      goBack: () => {
        try {
          if (webview.canGoBack?.()) webview.goBack();
        } finally {
          updateNavStateFor(activeTabId, webview);
        }
      },
      goForward: () => {
        try {
          if (webview.canGoForward?.()) webview.goForward();
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
      }
    });

    updateNavStateFor(activeTabId, webview);

    return () => setWebviewApi(null);
  }, [activeTabId, setWebviewApi]);

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
      {tabs
        .filter((t) => t.url !== 'lain://welcome')
        .map((tab) => (
          <webview
            key={tab.id}
            ref={setWebviewRef(tab.id)}
            src={tab.url}
            allowpopups="true"
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
    </div>
  );
}
