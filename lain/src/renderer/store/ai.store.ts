import { create } from 'zustand';
import type { Message } from '../../shared/types';

interface AIState {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, { ...message, timestamp: Date.now() }]
    }));
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  clearMessages: () => set({ messages: [] })
}));
