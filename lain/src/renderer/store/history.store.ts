import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
  favicon?: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (url: string, title: string, favicon?: string) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  searchHistory: (query: string) => HistoryEntry[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (url: string, title: string, favicon?: string) => {
        if (!url || url.startsWith('lain://')) return;
        
        const entry: HistoryEntry = {
          id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          title: title || url,
          visitedAt: Date.now(),
          favicon
        };

        set((state) => ({
          entries: [entry, ...state.entries.filter(e => e.url !== url)].slice(0, 1000)
        }));
      },

      removeEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.filter(e => e.id !== id)
        }));
      },

      clearHistory: () => set({ entries: [] }),

      searchHistory: (query: string) => {
        const q = query.toLowerCase();
        return get().entries.filter(
          e => e.url.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
        );
      }
    }),
    { name: 'lain.history' }
  )
);
