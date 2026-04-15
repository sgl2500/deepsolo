// ============================================================
// GameStore.ts — 集中式游戏状态
// ============================================================

import { AgentState, type Strategy, type EventEntry } from '../types';
import { INITIAL_STRATEGIES, STRATEGIES_URL, POLL_INTERVAL } from '../config';
import { EventBus } from './EventBus';

export class GameStore {
  strategies: Strategy[] = [];
  selectedStrategyId: string | null = null;
  playerPosition = { x: 50, y: 50 };
  eventLog: EventEntry[] = [];
  dayCount = 0;

  private eventBus: EventBus;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    // 同步加载 fallback 数据，确保 WorldScene.create 有数据可用
    this.strategies = INITIAL_STRATEGIES.map(s => {
      const state = this.deriveState(s.returnPct);
      return { ...s, state } as Strategy;
    });
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
      try {
        const resp = await fetch(STRATEGIES_URL);
        if (!resp.ok) return;
        const data: Strategy[] = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          this.strategies = data.map(s => {
            const state = this.deriveState(s.returnPct);
            return { ...s, state } as Strategy;
          });
          this.eventBus.emit('strategy:loaded', this.strategies);
        }
      } catch {
        // 忽略轮询错误
      }
    }, POLL_INTERVAL);
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

  tickDay(): void {
    this.dayCount++;
    this.eventBus.emit('day:tick', this.dayCount);
  }
}
