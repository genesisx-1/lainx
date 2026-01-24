import { create } from 'zustand';

export interface Download {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  receivedBytes: number;
  totalBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: number;
}

interface DownloadsState {
  downloads: Download[];
  showPanel: boolean;
  addDownload: (download: Omit<Download, 'receivedBytes' | 'state' | 'startedAt'>) => void;
  updateDownload: (id: string, updates: Partial<Download>) => void;
  removeDownload: (id: string) => void;
  clearCompleted: () => void;
  setShowPanel: (show: boolean) => void;
  togglePanel: () => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  downloads: [],
  showPanel: false,

  addDownload: (download) => {
    const newDownload: Download = {
      ...download,
      receivedBytes: 0,
      state: 'progressing',
      startedAt: Date.now()
    };
    set((state) => ({
      downloads: [newDownload, ...state.downloads],
      showPanel: true
    }));
  },

  updateDownload: (id, updates) => {
    set((state) => ({
      downloads: state.downloads.map(d =>
        d.id === id ? { ...d, ...updates } : d
      )
    }));
  },

  removeDownload: (id) => {
    set((state) => ({
      downloads: state.downloads.filter(d => d.id !== id)
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      downloads: state.downloads.filter(d => d.state === 'progressing')
    }));
  },

  setShowPanel: (show) => set({ showPanel: show }),
  togglePanel: () => set((state) => ({ showPanel: !state.showPanel }))
}));
