// ============================================================
// DiscussionSystem.ts — 讨论系统核心逻辑
// ============================================================

import { AgentState, DiscussionTopic, TOPIC_LABELS,
         type DiscussionGroup, type Strategy } from '../types';
import {
  DISCUSSION_MIN_AGENTS, DISCUSSION_MAX_AGENTS,
  DISCUSSION_DURATION_MIN, DISCUSSION_DURATION_MAX,
  DISCUSSION_TURN_INTERVAL, DISCUSSION_CHECK_INTERVAL,
  DISCUSSION_CENTER_X, DISCUSSION_CENTER_Y,
} from '../config';
import type { Agent } from '../entities/Agent';
import type { EntitySystem } from './EntitySystem';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { BubbleFactory } from '../ui/BubbleFactory';
import { generateDialogue, randomTopic } from '../data/DiscussionTopics';
import { randomInt } from '../utils/MathUtils';

let groupCounter = 0;

export class DiscussionSystem {
  private scene: Phaser.Scene;
  private entitySystem: EntitySystem;
  private store: GameStore;
  private eventBus: EventBus;

  /** 活跃的讨论小组 */
  private activeGroups: Map<string, DiscussionGroup> = new Map();
  /** 等待讨论的 Agent ID 集合 */
  private waitingAgents: Set<string> = new Set();

  constructor(
    scene: Phaser.Scene,
    entitySystem: EntitySystem,
    store: GameStore,
    eventBus: EventBus,
  ) {
    this.scene = scene;
    this.entitySystem = entitySystem;
    this.store = store;
    this.eventBus = eventBus;

    // 定时检查是否可以组队讨论
    scene.time.addEvent({
      delay: DISCUSSION_CHECK_INTERVAL,
      callback: this.checkAndStart,
      callbackScope: this,
      loop: true,
    });
  }

  /** 将 Agent 标记为等待讨论 */
  addWaiting(agentId: string): void {
    this.waitingAgents.add(agentId);
  }

  /** 从等待列表移除 */
  removeWaiting(agentId: string): void {
    this.waitingAgents.delete(agentId);
  }

  /** 检查等待列表，尝试组建讨论 */
  private checkAndStart(): void {
    if (this.waitingAgents.size < DISCUSSION_MIN_AGENTS) return;

    // 从等待列表中选 2-3 个
    const candidates = [...this.waitingAgents].filter(id => {
      const agent = this.entitySystem.agents.get(id);
      return agent && !agent.inDiscussion;
    });

    if (candidates.length < DISCUSSION_MIN_AGENTS) return;

    const count = Math.min(
      randomInt(DISCUSSION_MIN_AGENTS, DISCUSSION_MAX_AGENTS),
      candidates.length,
    );

    // 随机选取
    const selected: string[] = [];
    const pool = [...candidates];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    this.startDiscussion(selected);
  }

  /** 启动讨论 */
  private startDiscussion(agentIds: string[]): void {
    const agents = agentIds
      .map(id => this.entitySystem.agents.get(id))
      .filter((a): a is Agent => !!a);

    if (agents.length < DISCUSSION_MIN_AGENTS) return;

    // 从等待列表移除
    agentIds.forEach(id => this.waitingAgents.delete(id));

    // 固定讨论中心（神殿位置）
    const centerX = DISCUSSION_CENTER_X;
    const centerY = DISCUSSION_CENTER_Y;

    // 选话题
    const topic = randomTopic();
    const strategies = agents.map(a => a.strategy);

    // 生成对话内容
    const dialogues = generateDialogue(topic, strategies);
    if (!dialogues.length) return;

    const groupId = `disc_${++groupCounter}`;

    const group: DiscussionGroup = {
      id: groupId,
      agentIds,
      topic,
      centerX,
      centerY,
      currentTurn: 0,
      totalTurns: dialogues.length,
      dialogues,
      startTime: this.scene.time.now,
    };

    this.activeGroups.set(groupId, group);

    // 让 Agent 进入讨论模式，围成圈
    agents.forEach((agent, idx) => {
      const angle = (2 * Math.PI * idx) / agents.length;
      agent.enterDiscussion(centerX, centerY, angle);
    });

    // 发射讨论开始事件
    this.eventBus.emit('discussion:started', { groupId, agents: agentIds, topic });
    this.store.addEvent(
      agents.map(a => a.strategy.name).join('、'),
      `开始讨论「${TOPIC_LABELS[topic]}」`,
    );
    this.eventBus.emit('ui:refresh');

    // 逐轮发言
    this.scheduleTurns(group);

    // 设定讨论结束时间
    const duration = randomInt(DISCUSSION_DURATION_MIN, DISCUSSION_DURATION_MAX);
    this.scene.time.delayedCall(duration, () => {
      this.endDiscussion(groupId);
    });
  }

  /** 按轮次安排发言 */
  private scheduleTurns(group: DiscussionGroup): void {
    group.dialogues.forEach((line, idx) => {
      this.scene.time.delayedCall(DISCUSSION_TURN_INTERVAL * (idx + 1), () => {
        if (!this.activeGroups.has(group.id)) return; // 已结束
        this.executeTurn(group, idx);
      });
    });
  }

  /** 执行一轮发言 */
  private executeTurn(group: DiscussionGroup, turnIdx: number): void {
    const line = group.dialogues[turnIdx];
    const agent = this.entitySystem.agents.get(line.agentId);
    if (!agent) return;

    // 显示讨论气泡（带策略类别颜色边框）
    const cfg = BubbleFactory.discussionConfig(agent.strategy.category);
    this.entitySystem.showBubble(agent.id, line.text, cfg);

    // 发射事件
    this.eventBus.emit('discussion:turn', {
      groupId: group.id,
      agentId: line.agentId,
      agentName: agent.strategy.name,
      text: line.text,
    });
  }

  /** 结束讨论 */
  private endDiscussion(groupId: string): void {
    const group = this.activeGroups.get(groupId);
    if (!group) return;

    this.activeGroups.delete(groupId);

    // 让所有 Agent 退出讨论模式，恢复漫游
    group.agentIds.forEach(id => {
      const agent = this.entitySystem.agents.get(id);
      if (agent) {
        agent.exitDiscussion();
      }
    });

    // 发射结束事件
    this.eventBus.emit('discussion:ended', { groupId, agents: group.agentIds });

    const names = group.agentIds
      .map(id => this.store.getStrategy(id)?.name)
      .filter(Boolean)
      .join('、');
    this.store.addEvent(names, `讨论结束「${TOPIC_LABELS[group.topic]}」`);
    this.eventBus.emit('ui:refresh');
  }

  /** 获取 Agent 所在的讨论小组 */
  getGroupForAgent(agentId: string): DiscussionGroup | undefined {
    for (const group of this.activeGroups.values()) {
      if (group.agentIds.includes(agentId)) return group;
    }
    return undefined;
  }

  /** 获取指定小组 */
  getGroup(groupId: string): DiscussionGroup | undefined {
    return this.activeGroups.get(groupId);
  }

  /** 是否有任何活跃讨论 */
  get hasActiveDiscussions(): boolean {
    return this.activeGroups.size > 0;
  }
}
