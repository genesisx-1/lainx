import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { AgentTab } from './AgentTab';
import { ProviderSettings } from './ProviderSettings';

type Tab = 'chat' | 'agent';

export function AssistantSidebar() {
  const [tab, setTab] = useState<Tab>('agent');
  const [showProviders, setShowProviders] = useState(false);

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-1 bg-bg-panel/70 backdrop-blur rounded-lg border border-border p-1">
          <TabButton active={tab === 'agent'} onClick={() => setTab('agent')}>Agent</TabButton>
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>Chat</TabButton>
        </div>
        <button
          onClick={() => setShowProviders(true)}
          className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded border border-border bg-bg-panel/60"
          title="Configure AI providers"
        >
          Providers
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'agent' ? <AgentTab onOpenProviders={() => setShowProviders(true)} /> : <ChatPanel />}
      </div>
      {showProviders && <ProviderSettings onClose={() => setShowProviders(false)} />}
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        'px-3 py-1 text-xs rounded-md transition ' +
        (active ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary')
      }
    >
      {children}
    </button>
  );
}
