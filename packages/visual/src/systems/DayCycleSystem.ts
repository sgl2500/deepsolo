// ============================================================
// DayCycleSystem.ts — 策略状态机 + 时间推进
// ============================================================

import { AgentState, STATE_TRANSITIONS } from '../types';
import { STATE_CYCLE_INTERVAL, BUBBLE_CYCLE_INTERVAL, BUBBLE_TEXTS } from '../config';
import type { GameStore } from '../core/GameStore';
import type { EntitySystem } from './EntitySystem';
import type { EventBus } from '../core/EventBus';
import type { DiscussionSystem } from './DiscussionSystem';
import { randomInt, randomPick } from '../utils/MathUtils';

export class DayCycleSystem {
  private scene: Phaser.Scene;
  private store: GameStore;
  private entitySystem: EntitySystem;
  private eventBus: EventBus;
  private discussionSystem: DiscussionSystem;

  constructor(
    scene: Phaser.Scene,
    store: GameStore,
    entitySystem: EntitySystem,
    eventBus: EventBus,
    discussionSystem: DiscussionSystem,
  ) {
    this.scene = scene;
    this.store = store;
    this.entitySystem = entitySystem;
    this.eventBus = eventBus;
    this.discussionSystem = discussionSystem;

    // 状态循环定时器
    scene.time.addEvent({
      delay: STATE_CYCLE_INTERVAL,
      callback: this.cycleState,
      callbackScope: this,
      loop: true,
    });

    // 气泡循环定时器
    scene.time.addEvent({
      delay: BUBBLE_CYCLE_INTERVAL,
      callback: this.showRandomBubble,
      callbackScope: this,
      loop: true,
    });
  }

  private cycleState(): void {
    const active = this.store.getActiveStrategies();
    if (!active.length) return;

    const s = active[randomInt(0, active.length - 1)];
    const agent = this.entitySystem.agents.get(s.id);
    if (!agent || agent.inDiscussion) return; // 讨论中不切换状态

    const allowed = STATE_TRANSITIONS[s.state];
    if (!allowed.length) return;

    const newState = randomPick(allowed);

    // 低收益策略有概率被淘汰
    if (s.returnPct < -15 && s.state !== AgentState.Retired && Math.random() < 0.1) {
      const oldState = s.state;
      this.store.changeAgentState(s.id, AgentState.Retired);
      agent.moveToStateRegion(AgentState.Retired);
      this.store.addEvent(s.name, `${this.stateLabel(oldState)}→${this.stateLabel(AgentState.Retired)}`);
      this.eventBus.emit('ui:refresh');
      return;
    }

    const oldState = s.state;
    this.store.changeAgentState(s.id, newState);
    agent.moveToStateRegion(newState);
    this.store.addEvent(s.name, `${this.stateLabel(oldState)}→${this.stateLabel(newState)}`);

    // 如果进入讨论状态，加入等待列表
    if (newState === AgentState.Discussing) {
      this.discussionSystem.addWaiting(s.id);
    }

    this.eventBus.emit('ui:refresh');
  }

  private showRandomBubble(): void {
    const active = this.store.getActiveStrategies();
    if (!active.length) return;

    const s = active[randomInt(0, active.length - 1)];
    const agent = this.entitySystem.agents.get(s.id);
    if (!agent || agent.inDiscussion) return; // 讨论中由讨论系统管气泡

    const pool = BUBBLE_TEXTS[s.state];
    if (!pool.length) return;

    const text = randomPick<string>(pool);
    this.entitySystem.showBubble(s.id, text);
  }

  private stateLabel(state: AgentState): string {
    const labels: Record<AgentState, string> = {
      [AgentState.Idle]: '待命',
      [AgentState.Backtesting]: '回测',
      [AgentState.Evolving]: '进化',
      [AgentState.Competing]: '竞争',
      [AgentState.Discussing]: '讨论',
      [AgentState.Profitable]: '盈利',
      [AgentState.Retired]: '淘汰',
    };
    return labels[state];
  }
}
