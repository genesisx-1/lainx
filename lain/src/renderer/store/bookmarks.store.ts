import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark } from '../../shared/types';

function normalizeBookmarkUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('lain://')) return null;

  try {
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    // Normalize root trailing slash
    if (url.pathname === '/') url.pathname = '';
    return url.toString();
  } catch {
    return null;
  }
}

interface BookmarksState {
  bookmarks: Bookmark[];
  isBookmarked: (url: string) => boolean;
  toggleBookmark: (url: string, title?: string) => void;
  removeBookmark: (url: string) => void;
}

export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      isBookmarked: (url: string) => {
        const normalized = normalizeBookmarkUrl(url);
        if (!normalized) return false;
        return get().bookmarks.some((b) => b.url === normalized);
      },

      toggleBookmark: (url: string, title?: string) => {
        const normalized = normalizeBookmarkUrl(url);
        if (!normalized) return;

        const existing = get().bookmarks.find((b) => b.url === normalized);
        if (existing) {
          set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.url !== normalized) }));
          return;
        }

        const now = Date.now();
        const bookmark: Bookmark = {
          id: `bm-${now}`,
          url: normalized,
          title: (title || normalized).trim() || normalized,
          created_at: now
        };

        set((s) => ({ bookmarks: [bookmark, ...s.bookmarks] }));
      },

      removeBookmark: (url: string) => {
        const normalized = normalizeBookmarkUrl(url);
        if (!normalized) return;
        set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.url !== normalized) }));
      }
    }),
    {
      name: 'lain.bookmarks'
    }
  )
);

