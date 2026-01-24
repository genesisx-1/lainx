import React from 'react';
import { useDownloadsStore, Download } from '../../store/downloads.store';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';

export function DownloadsPanel() {
  const { downloads, showPanel, removeDownload, clearCompleted, setShowPanel } = useDownloadsStore();

  if (!showPanel) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getProgress = (d: Download) => {
    if (d.totalBytes === 0) return 0;
    return Math.round((d.receivedBytes / d.totalBytes) * 100);
  };

  const cancelDownload = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, id);
    } catch (e) {
      console.error('Failed to cancel download:', e);
    }
  };

  const openFile = (path: string) => {
    window.electron.ipcRenderer.invoke('shell:open-path', path);
  };

  return (
    <div className="fixed bottom-16 right-4 w-80 bg-bg-primary border border-border rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-medium text-text-primary">Downloads</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={clearCompleted}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
          <button
            onClick={() => setShowPanel(false)}
            className="p-1 text-text-muted hover:text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Downloads List */}
      <div className="max-h-64 overflow-y-auto">
        {downloads.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-muted">
            No downloads
          </div>
        ) : (
          downloads.map((d) => (
            <div key={d.id} className="p-3 border-b border-border last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{d.filename}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {d.state === 'completed' ? (
                      <span className="text-green-400">Completed</span>
                    ) : d.state === 'cancelled' ? (
                      <span className="text-red-400">Cancelled</span>
                    ) : (
                      <>
                        {formatBytes(d.receivedBytes)} / {formatBytes(d.totalBytes)}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {d.state === 'completed' ? (
                    <button
                      onClick={() => openFile(d.savePath)}
                      className="p-1 text-text-muted hover:text-accent"
                      title="Open file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  ) : d.state === 'progressing' ? (
                    <button
                      onClick={() => cancelDownload(d.id)}
                      className="p-1 text-text-muted hover:text-red-400"
                      title="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    onClick={() => removeDownload(d.id)}
                    className="p-1 text-text-muted hover:text-text-primary"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {d.state === 'progressing' && (
                <div className="mt-2 h-1 bg-bg-secondary rounded overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${getProgress(d)}%` }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
