// ============================================================
// GameStore.ts — 集中式游戏状态
// ============================================================

import { AgentState, type Strategy, type EventEntry } from '../types';
import { INITIAL_STRATEGIES, STATE_REGIONS } from '../config';
import { EventBus } from './EventBus';

export class GameStore {
  strategies: Strategy[] = [];
  selectedStrategyId: string | null = null;
  playerPosition = { x: 50, y: 50 };
  eventLog: EventEntry[] = [];
  dayCount = 0;

  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.strategies = INITIAL_STRATEGIES.map(s => {
      let state: AgentState;
      if (s.returnPct > 20) state = AgentState.Profitable;
      else if (s.returnPct > 0) state = AgentState.Competing;
      else if (s.returnPct > -10) state = AgentState.Discussing;
      else state = AgentState.Idle;

      return { ...s, state } as Strategy;
    });
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
