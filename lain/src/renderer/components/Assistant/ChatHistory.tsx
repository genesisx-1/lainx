import React from 'react';
import { useAIStore } from '../../store/ai.store';

interface ChatHistoryProps {
  onClose: () => void;
}

export function ChatHistory({ onClose }: ChatHistoryProps) {
  const { 
    conversations, 
    currentConversationId, 
    loadConversation, 
    deleteConversation,
    startNewConversation 
  } = useAIStore();

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleLoad = (id: string) => {
    loadConversation(id);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteConversation(id);
    }
  };

  const handleNewChat = () => {
    startNewConversation();
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-bg-secondary z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Chat History</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
        >
          ×
        </button>
      </div>

      {/* New Chat button */}
      <div className="p-3 border-b border-border">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>New Conversation</span>
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-bg-panel border border-border flex items-center justify-center text-text-muted">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m11-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg mb-1 text-text-primary">No saved conversations</p>
            <p className="text-sm">Your chat history will appear here.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => handleLoad(convo.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                  currentConversationId === convo.id
                    ? 'bg-accent/20 border border-accent/40'
                    : 'bg-bg-panel hover:bg-bg-primary border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {convo.title}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {formatDate(convo.updatedAt)} · {convo.messages.length} messages
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, convo.id)}
                    className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete conversation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                {/* Preview of last message */}
                {convo.messages.length > 0 && (
                  <div className="text-xs text-text-secondary mt-2 line-clamp-2">
                    {convo.messages[convo.messages.length - 1].content.slice(0, 100)}
                    {convo.messages[convo.messages.length - 1].content.length > 100 && '...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border text-center text-xs text-text-muted">
        {conversations.length} saved conversation{conversations.length !== 1 ? 's' : ''}
        <br />
        All data stored locally on your device.
      </div>
    </div>
  );
}
