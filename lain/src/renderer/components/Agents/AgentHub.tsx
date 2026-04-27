// React imported via JSX transform
import { useAgentsStore } from '../../store/agents.store';
import { useUIStore } from '../../store/ui.store';
import { AgentStatusPanel } from './AgentStatusPanel';
import { TaskQueuePanel } from './TaskQueuePanel';
import { AgentChat } from './AgentChat';

export function AgentHub() {
  const { sidebarTab, setSidebarTab } = useAgentsStore();
  const { toggleSidebar } = useUIStore();

  const tabs: { id: 'chat' | 'agents' | 'tasks'; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'agents', label: 'Agents' },
    { id: 'tasks', label: 'Tasks' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between h-11 px-3 border-b border-border">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSidebarTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sidebarTab === tab.id
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-7 h-7 rounded hover:bg-bg-panel flex items-center justify-center text-text-secondary"
          title="Close panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {sidebarTab === 'chat' && <AgentChat />}
        {sidebarTab === 'agents' && <AgentStatusPanel />}
        {sidebarTab === 'tasks' && <TaskQueuePanel />}
      </div>
    </div>
  );
}
