// ============================================================
// GameStore.ts — 集中式游戏状态
// ============================================================

import { AgentState, type Strategy, type EventEntry } from '../types';
import { INITIAL_STRATEGIES, STRATEGIES_URL, EVENTS_URL, POLL_INTERVAL, LS_KEY_STORY } from '../config';
import { EventBus } from './EventBus';

export class GameStore {
  strategies: Strategy[] = [];
  selectedStrategyId: string | null = null;
  playerPosition = { x: 50, y: 50 };
  eventLog: EventEntry[] = [];
  dayCount = 0;
  /** 剧情标记（key=flag名, value=true） */
  storyFlags: Record<string, boolean> = {};
  /** 已完成的剧情 ID */
  completedStories: Set<string> = new Set();
  /** 新手教程是否完成 */
  tutorialCompleted = false;

  private eventBus: EventBus;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private processedEvents: Set<string> = new Set();
  private prevStrategyIds: Set<string> = new Set();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initStoryState();
    // 同步加载 fallback 数据，确保 WorldScene.create 有数据可用
    this.strategies = INITIAL_STRATEGIES.map(s => {
      const state = this.deriveState(s.returnPct);
      return { ...s, state } as Strategy;
    });
    this.prevStrategyIds = new Set(this.strategies.map(s => s.id));
    // 异步尝试从后端 JSON 加载真实数据
    this.fetchFromBackend();
  }

  private deriveState(returnPct: number): AgentState {
    if (returnPct > 20) return AgentState.Profitable;
    if (returnPct > 0) return AgentState.Competing;
    if (returnPct > -10) return AgentState.Discussing;
    return AgentState.Idle;
  }

  private async fetchFromBackend(): Promise<void> {
    try {
      const resp = await fetch(STRATEGIES_URL);
      if (resp.ok) {
        const data: Strategy[] = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          this.strategies = data.map(s => {
            const state = this.deriveState(s.returnPct);
            return { ...s, state } as Strategy;
          });
          this.prevStrategyIds = new Set(this.strategies.map(s => s.id));
          this.eventBus.emit('strategy:loaded', this.strategies);
          this.startPolling();
          return;
        }
      }
    } catch {
      // fetch 失败，继续使用 fallback 数据
    }
  }

  /** 定时轮询后端 JSON */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      await this.pollStrategies();
      await this.pollEvents();
    }, POLL_INTERVAL);
  }

  /** 轮询策略数据，diff 检测增删 */
  private async pollStrategies(): Promise<void> {
    try {
      const resp = await fetch(STRATEGIES_URL);
      if (!resp.ok) return;
      const data: Strategy[] = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const newStrategies = data.map(s => {
          const state = this.deriveState(s.returnPct);
          return { ...s, state } as Strategy;
        });
        const newIds = new Set(newStrategies.map(s => s.id));

        // 检测被移除的 Agent（天道消灭）
        for (const oldId of this.prevStrategyIds) {
          if (!newIds.has(oldId)) {
            const oldStrategy = this.strategies.find(s => s.id === oldId);
            if (oldStrategy) {
              this.eventBus.emit('agent:eliminated', {
                id: oldId,
                name: oldStrategy.name,
                reason: '天道消灭',
                detail: `${oldStrategy.name} 已被天道审查消灭`,
              });
              this.addEvent(oldStrategy.name, '被天道消灭');
            }
          }
        }

        // 检测新增的 Agent（策略诞生）
        for (const newId of newIds) {
          if (!this.prevStrategyIds.has(newId)) {
            const newStrategy = newStrategies.find(s => s.id === newId)!;
            this.eventBus.emit('agent:born', {
              id: newId,
              name: newStrategy.name,
              parents: newStrategy.parents,
              detail: newStrategy.description,
            });
            this.addEvent(newStrategy.name, '新策略诞生!');
          }
        }

        this.strategies = newStrategies;
        this.prevStrategyIds = newIds;
        this.eventBus.emit('strategy:loaded', this.strategies);
      }
    } catch {
      // 忽略轮询错误
    }
  }

  /** 轮询事件文件，发射后端驱动的事件 */
  private async pollEvents(): Promise<void> {
    try {
      const resp = await fetch(EVENTS_URL);
      if (!resp.ok) return;
      const events: any[] = await resp.json();
      if (!Array.isArray(events)) return;

      for (const evt of events) {
        if (!evt.id || this.processedEvents.has(evt.id)) continue;
        this.processedEvents.add(evt.id);

        if (evt.type === 'heaven_eliminate') {
          this.eventBus.emit('agent:eliminated', {
            id: evt.agents?.[0] || '',
            name: evt.agent_name || '',
            reason: evt.reason || '天道消灭',
            detail: evt.detail || '',
          });
        } else if (evt.type === 'agent_born') {
          this.eventBus.emit('agent:born', {
            id: evt.agents?.[0] || '',
            name: evt.agent_name || '',
            parents: evt.parents,
            detail: evt.detail || '',
          });
        } else if (evt.type === 'discussion') {
          this.eventBus.emit('discussion:event', {
            agents: evt.agents || [],
            agentNames: evt.agent_names || [],
            dialogues: evt.dialogues || [],
            complementary: evt.complementary || false,
          });
        }
      }
    } catch {
      // 忽略
    }
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  loadStrategies(strategies: Strategy[]): void {
    this.strategies = strategies;
    this.eventBus.emit('strategy:loaded', strategies);
  }

  getStrategy(id: string): Strategy | undefined {
    return this.strategies.find(s => s.id === id);
  }

  getStrategiesByState(state: AgentState): Strategy[] {
    return this.strategies.filter(s => s.state === state);
  }

  getActiveStrategies(): Strategy[] {
    return this.strategies.filter(s => s.state !== AgentState.Retired);
  }

  /** 获取收益最低的存活策略（用于引导 NPC） */
  getLowestReturnAgent(): Strategy | undefined {
    const active = this.strategies.filter(s => s.state !== AgentState.Retired);
    if (active.length === 0) return undefined;
    return active.reduce((min, s) => s.returnPct < min.returnPct ? s : min);
  }

  selectStrategy(strategy: Strategy | null): void {
    this.selectedStrategyId = strategy?.id ?? null;
    this.eventBus.emit('strategy:selected', strategy);
  }

  getSelectedStrategy(): Strategy | undefined {
    return this.selectedStrategyId ? this.getStrategy(this.selectedStrategyId) : undefined;
  }

  changeAgentState(id: string, newState: AgentState): void {
    const s = this.getStrategy(id);
    if (!s) return;
    const oldState = s.state;
    if (oldState === newState) return;
    s.state = newState;
    this.eventBus.emit('strategy:state-changed', { id, oldState, newState });
  }

  updatePlayerPosition(x: number, y: number): void {
    this.playerPosition.x = x;
    this.playerPosition.y = y;
    this.eventBus.emit('player:moved', { x, y });
  }

  addEvent(agentName: string, text: string): void {
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(v => String(v).padStart(2, '0')).join(':');
    this.eventLog.unshift({ time, agentName, text });
    if (this.eventLog.length > 20) this.eventLog.length = 20;
  }

  /** 从 localStorage 恢复剧情状态 */
  private initStoryState(): void {
    try {
      const saved = localStorage.getItem(LS_KEY_STORY);
      if (saved) {
        const data = JSON.parse(saved);
        this.storyFlags = data.flags || {};
        this.completedStories = new Set(data.completed || []);
        this.tutorialCompleted = data.tutorialCompleted ?? false;
      }
    } catch { /* ignore */ }
  }

  /** 持久化剧情状态到 localStorage */
  persistStoryState(): void {
    localStorage.setItem(LS_KEY_STORY, JSON.stringify({
      flags: this.storyFlags,
      completed: Array.from(this.completedStories),
      tutorialCompleted: this.tutorialCompleted,
    }));
  }

  tickDay(): void {
    this.dayCount++;
    this.eventBus.emit('day:tick', this.dayCount);
  }
}
