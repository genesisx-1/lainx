import React, { useEffect } from 'react';
import { useAgentsStore } from '../../store/agents.store';
import type { AgentInfo, AgentStatus } from '../../../shared/types';

function StatusDot({ status }: { status: AgentStatus }) {
  const colors: Record<AgentStatus, string> = {
    online: 'bg-green-500 shadow-green-500/50',
    offline: 'bg-zinc-600',
    busy: 'bg-amber-400 shadow-amber-400/50 animate-pulse',
    error: 'bg-red-500 shadow-red-500/50',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} ${
        status === 'online' || status === 'busy' ? 'shadow-[0_0_6px]' : ''
      }`}
    />
  );
}

function AgentCard({ agent, onSelect }: { agent: AgentInfo; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-border bg-bg-panel/50 hover:bg-bg-panel transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
        >
          {agent.icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{agent.name}</span>
            <StatusDot status={agent.status} />
            <span className="text-[10px] text-text-muted uppercase tracking-wide">
              {agent.status}
            </span>
          </div>

          {/* Role */}
          <div className="text-xs text-text-secondary mt-0.5">{agent.role}</div>

          {/* Capabilities */}
          <div className="flex flex-wrap gap-1 mt-2">
            {agent.capabilities.slice(0, 4).map((cap) => (
              <span
                key={cap}
                className="px-1.5 py-0.5 text-[10px] rounded bg-bg-secondary text-text-muted border border-border/50"
              >
                {cap}
              </span>
            ))}
          </div>

          {/* PID if online */}
          {agent.pid && (
            <div className="text-[10px] text-text-muted mt-1.5">
              PID {agent.pid}
              {agent.lastSeen && (
                <span className="ml-2">
                  seen {new Date(agent.lastSeen).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function AgentStatusPanel() {
  const { agents, pollStatuses, isPolling, lastPollAt, setActiveAgent, setSidebarTab } =
    useAgentsStore();

  // Poll on mount and every 15s
  useEffect(() => {
    pollStatuses();
    const interval = setInterval(pollStatuses, 15000);
    return () => clearInterval(interval);
  }, [pollStatuses]);

  const onlineCount = agents.filter((a) => a.status === 'online' || a.status === 'busy').length;

  return (
    <div className="h-full flex flex-col">
      {/* Summary bar */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Agent Team</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {onlineCount}/{agents.length} online
            {lastPollAt && (
              <span className="ml-2">
                updated {new Date(lastPollAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => pollStatuses()}
          disabled={isPolling}
          className="px-2.5 py-1 text-xs rounded border border-border hover:bg-bg-panel text-text-secondary disabled:opacity-50 transition-colors"
        >
          {isPolling ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {/* Chain of command */}
      <div className="px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          {agents.map((a, i) => (
            <React.Fragment key={a.id}>
              <span style={{ color: a.color }} className="font-medium">
                {a.name}
              </span>
              {i < agents.length - 1 && <span className="text-text-muted/50">&gt;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onSelect={() => {
              setActiveAgent(agent.id);
              setSidebarTab('chat');
            }}
          />
        ))}
      </div>

      {/* Delegation guide */}
      <div className="px-4 py-3 border-t border-border bg-bg-panel/50">
        <div className="text-[10px] text-text-muted leading-relaxed">
          <span className="font-medium text-text-secondary">Delegation rules:</span> Only delegate
          when the task is clearly in another agent's specialty, parallel saves time, and the prompt
          is specific enough.
        </div>
      </div>
    </div>
  );
}
