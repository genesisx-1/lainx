import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../../shared/types';

// Chat settings interface
interface ChatSettings {
  userName: string;
  systemPrompt: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  personality: string;
  preferredModel: string;
}

// Saved conversation
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface AIState {
  // Current chat
  messages: Message[];
  isLoading: boolean;
  currentConversationId: string | null;
  
  // Settings
  settings: ChatSettings;
  
  // Saved conversations
  conversations: Conversation[];
  
  // Actions - Current chat
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
  
  // Actions - Settings
  updateSettings: (settings: Partial<ChatSettings>) => void;
  
  // Actions - Conversations
  saveCurrentConversation: (title?: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  startNewConversation: () => void;
  
  // Helper to build system message
  getSystemMessage: () => string;
}

const defaultSettings: ChatSettings = {
  userName: '',
  systemPrompt: '',
  responseStyle: 'balanced',
  personality: 'helpful',
  preferredModel: ''
};

// Generate a title from first user message
function generateTitle(messages: Message[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const content = firstUserMsg.content.slice(0, 40);
    return content.length < firstUserMsg.content.length ? `${content}...` : content;
  }
  return `Chat ${new Date().toLocaleDateString()}`;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      currentConversationId: null,
      settings: defaultSettings,
      conversations: [],

      addMessage: (message: Message) => {
        set((state) => ({
          messages: [...state.messages, { ...message, timestamp: Date.now() }]
        }));
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      clearMessages: () => set({ messages: [], currentConversationId: null }),

      updateSettings: (newSettings: Partial<ChatSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },

      saveCurrentConversation: (title?: string) => {
        const state = get();
        if (state.messages.length === 0) return;

        const now = Date.now();
        const existingId = state.currentConversationId;
        
        if (existingId) {
          // Update existing conversation
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === existingId
                ? { ...c, messages: s.messages, updatedAt: now, title: title || c.title }
                : c
            )
          }));
        } else {
          // Create new conversation
          const newConvo: Conversation = {
            id: `conv-${now}`,
            title: title || generateTitle(state.messages),
            messages: state.messages,
            createdAt: now,
            updatedAt: now
          };
          set((s) => ({
            conversations: [newConvo, ...s.conversations],
            currentConversationId: newConvo.id
          }));
        }
      },

      loadConversation: (id: string) => {
        const state = get();
        const convo = state.conversations.find((c) => c.id === id);
        if (convo) {
          set({
            messages: convo.messages,
            currentConversationId: id
          });
        }
      },

      deleteConversation: (id: string) => {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          // If we deleted the current one, clear messages
          ...(state.currentConversationId === id
            ? { messages: [], currentConversationId: null }
            : {})
        }));
      },

      startNewConversation: () => {
        const state = get();
        // Auto-save current if it has messages
        if (state.messages.length > 0 && !state.currentConversationId) {
          state.saveCurrentConversation();
        }
        set({ messages: [], currentConversationId: null });
      },

      getSystemMessage: () => {
        const { settings } = get();
        let prompt = '';

        // Add personality
        if (settings.personality === 'helpful') {
          prompt = 'You are a helpful AI assistant.';
        } else if (settings.personality === 'friendly') {
          prompt = 'You are a friendly and casual AI assistant. Use a warm, conversational tone.';
        } else if (settings.personality === 'professional') {
          prompt = 'You are a professional AI assistant. Be formal and precise.';
        } else if (settings.personality === 'creative') {
          prompt = 'You are a creative AI assistant. Be imaginative and think outside the box.';
        }

        // Add response style
        if (settings.responseStyle === 'concise') {
          prompt += ' Keep your responses short and to the point. Use 1-3 sentences when possible.';
        } else if (settings.responseStyle === 'detailed') {
          prompt += ' Provide thorough, detailed responses with examples when helpful.';
        }

        // Add user name
        if (settings.userName) {
          prompt += ` The user's name is ${settings.userName}. Address them by name occasionally.`;
        }

        // Add custom system prompt
        if (settings.systemPrompt) {
          prompt += ` ${settings.systemPrompt}`;
        }

        return prompt;
      }
    }),
    {
      name: 'lain-ai-storage',
      partialize: (state) => ({
        settings: state.settings,
        conversations: state.conversations
      })
    }
  )
);
