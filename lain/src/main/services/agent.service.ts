import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentId, AgentStatus, AgentTask } from '../../shared/types';

const TASKS_PATH = path.join(process.env.HOME || '~', 'agent-office', 'tasks.json');

// Map agent IDs to their process names for detection
const AGENT_PROCESS_MAP: Record<AgentId, string[]> = {
  claude: ['claude'],
  codex: ['codex'],
  cursor: ['agent'],      // cursor CLI is "agent"
  gemini: ['gemini'],
  qwen: ['qwen'],
};

// Map agent IDs to their CLI commands
const AGENT_COMMANDS: Record<AgentId, string> = {
  claude: 'claude',
  codex: 'codex',
  cursor: 'agent',
  gemini: 'gemini',
  qwen: 'qwen',
};

export class AgentService {
  private runningProcesses: Map<string, ChildProcess> = new Map();

  /**
   * Check if an agent CLI process is currently running
   */
  async checkAgentStatus(agentId: AgentId): Promise<{ status: AgentStatus; pid: number | null }> {
    try {
      const processNames = AGENT_PROCESS_MAP[agentId];
      if (!processNames) return { status: 'offline', pid: null };

      // Use ps to check for running processes
      const psOutput = execSync(
        'ps axo pid,comm 2>/dev/null || true',
        { encoding: 'utf8', timeout: 5000 }
      );

      for (const procName of processNames) {
        const lines = psOutput.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const pid = parseInt(parts[0], 10);
            const comm = parts.slice(1).join(' ');
            // Match exact command name or path ending with the name
            if (comm === procName || comm.endsWith(`/${procName}`)) {
              return { status: 'online', pid };
            }
          }
        }
      }

      return { status: 'offline', pid: null };
    } catch {
      return { status: 'offline', pid: null };
    }
  }

  /**
   * Check all agents' statuses at once
   */
  async checkAllStatuses(): Promise<Record<AgentId, { status: AgentStatus; pid: number | null }>> {
    const agents: AgentId[] = ['claude', 'codex', 'cursor', 'gemini', 'qwen'];
    const results: Record<string, { status: AgentStatus; pid: number | null }> = {};

    // Single ps call for all agents
    try {
      const psOutput = execSync(
        'ps axo pid,comm 2>/dev/null || true',
        { encoding: 'utf8', timeout: 5000 }
      );
      const lines = psOutput.split('\n');

      for (const agentId of agents) {
        const processNames = AGENT_PROCESS_MAP[agentId];
        let found = false;

        for (const procName of processNames) {
          for (const line of lines) {
            const trimmed = line.trim();
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              const pid = parseInt(parts[0], 10);
              const comm = parts.slice(1).join(' ');
              if (comm === procName || comm.endsWith(`/${procName}`)) {
                results[agentId] = { status: 'online', pid };
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }

        if (!found) {
          results[agentId] = { status: 'offline', pid: null };
        }
      }
    } catch {
      for (const agentId of agents) {
        results[agentId] = { status: 'offline', pid: null };
      }
    }

    return results as Record<AgentId, { status: AgentStatus; pid: number | null }>;
  }

  /**
   * Run an agent CLI command and return the output
   */
  async runAgentCommand(
    agentId: AgentId,
    prompt: string,
    onOutput?: (data: string) => void
  ): Promise<string> {
    const command = AGENT_COMMANDS[agentId];
    if (!command) throw new Error(`Unknown agent: ${agentId}`);

    // Build command based on agent type
    let args: string[];
    switch (agentId) {
      case 'gemini':
        args = ['-p', prompt, '--yolo', '-o', 'text'];
        break;
      case 'codex':
        args = ['exec', prompt];
        break;
      case 'cursor':
        args = ['-p', prompt, '--yolo', '--output-format', 'text'];
        break;
      case 'qwen':
        args = ['-p', prompt, '--yolo'];
        break;
      case 'claude':
        args = ['-p', prompt, '--output-format', 'text'];
        break;
      default:
        args = ['-p', prompt];
    }

    return new Promise((resolve, reject) => {
      let output = '';
      const proc = spawn(command, args, {
        shell: true,
        env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin` },
        cwd: process.env.HOME,
      });

      const key = `${agentId}-${Date.now()}`;
      this.runningProcesses.set(key, proc);

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        onOutput?.(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        onOutput?.(text);
      });

      proc.on('close', (code) => {
        this.runningProcesses.delete(key);
        if (code === 0 || output.length > 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Agent ${agentId} exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        this.runningProcesses.delete(key);
        reject(err);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.runningProcesses.has(key)) {
          proc.kill();
          this.runningProcesses.delete(key);
          resolve(output.trim() || 'Agent command timed out after 5 minutes.');
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Read tasks from the task queue file
   */
  async getTasks(): Promise<AgentTask[]> {
    try {
      if (!fs.existsSync(TASKS_PATH)) return [];
      const raw = fs.readFileSync(TASKS_PATH, 'utf8');
      const data = JSON.parse(raw);
      return (data.tasks || []).map((t: any) => ({
        id: t.id || `task-${Date.now()}`,
        title: t.title || 'Untitled',
        agent: t.agent || 'codex',
        status: t.status || 'pending',
        prompt: t.prompt || '',
        result: t.result || '',
        createdAt: t.createdAt || Date.now(),
        updatedAt: t.updatedAt || Date.now(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create a new task in the queue
   */
  async createTask(task: Partial<AgentTask>): Promise<AgentTask> {
    const tasks = await this.getTasks();
    const newTask: AgentTask = {
      id: task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: task.title || 'New Task',
      agent: task.agent || 'codex',
      status: task.status || 'pending',
      prompt: task.prompt || '',
      result: task.result || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
    return newTask;
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | null> {
    const tasks = await this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() };
    this.saveTasks(tasks);
    return tasks[idx];
  }

  private saveTasks(tasks: AgentTask[]) {
    const dir = path.dirname(TASKS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TASKS_PATH, JSON.stringify({ tasks }, null, 2), 'utf8');
  }
}
