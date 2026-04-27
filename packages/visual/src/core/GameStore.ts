// ============================================================
// GameStore.ts — 集中式游戏状态
// ============================================================

import {
  AgentState,
  type EventEntry,
  type PlayerAttributes,
  type PlayerEquipment,
  type PlayerInventoryStack,
  type PlayerManualProgress,
  type PlayerProgress,
  type PlayerVitals,
  type Strategy,
} from '../types';
import { INITIAL_STRATEGIES, STRATEGIES_URL, EVENTS_URL, POLL_INTERVAL, LS_KEY_STORY, LS_KEY_PLAYER_PROGRESS } from '../config';
import { EventBus } from './EventBus';
import { getPlayerItemDef } from '../content/PlayerItems';
import { getPlayerManualDef, getPlayerManualDefByItemId } from '../content/PlayerManuals';

const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
  version: 1,
  identity: { name: '无名少侠', title: '观察者' },
  vitals: { hp: 72, maxHp: 100, mp: 18, maxMp: 50 },
  attributes: {
    attack: 8,
    defense: 6,
    speed: 7,
    understanding: 5,
    fortune: 5,
  },
  inventory: [],
  manuals: [],
  equipment: {},
  flags: {},
};

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
  /** 玩家生命/内力/秘籍等长期状态 */
  playerProgress: PlayerProgress = structuredClone(DEFAULT_PLAYER_PROGRESS);

  private eventBus: EventBus;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private processedEvents: Set<string> = new Set();
  private prevStrategyIds: Set<string> = new Set();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initStoryState();
    this.initPlayerProgress();
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

  hasPlayerFlag(flag: string): boolean {
    return !!this.playerProgress.flags[flag];
  }

  setPlayerFlag(flag: string, value = true): void {
    this.playerProgress.flags[flag] = value;
    this.persistPlayerProgress();
  }

  hasItem(itemId: string): boolean {
    return this.getItemCount(itemId) > 0;
  }

  getItemCount(itemId: string): number {
    return this.playerProgress.inventory.find(item => item.itemId === itemId)?.count ?? 0;
  }

  grantItem(itemId: string, count = 1): boolean {
    const safeCount = Math.max(1, Math.floor(count));
    const itemDef = getPlayerItemDef(itemId);
    const stackable = itemDef?.stackable ?? true;
    const maxStack = itemDef?.maxStack ?? Number.MAX_SAFE_INTEGER;
    const existing = this.playerProgress.inventory.find(item => item.itemId === itemId);

    if (existing) {
      if (!stackable) return false;
      const nextCount = Math.min(maxStack, existing.count + safeCount);
      if (nextCount === existing.count) return false;
      existing.count = nextCount;
      this.persistPlayerProgress();
      return true;
    }

    this.playerProgress.inventory.push({
      itemId,
      count: stackable ? Math.min(maxStack, safeCount) : 1,
      acquiredAt: Date.now(),
    });
    this.persistPlayerProgress();
    return true;
  }

  consumeItem(itemId: string, count = 1): boolean {
    const safeCount = Math.max(1, Math.floor(count));
    const idx = this.playerProgress.inventory.findIndex(item => item.itemId === itemId);
    if (idx < 0) return false;
    const item = this.playerProgress.inventory[idx];
    if (item.count < safeCount) return false;
    item.count -= safeCount;
    if (item.count <= 0) this.playerProgress.inventory.splice(idx, 1);
    this.persistPlayerProgress();
    return true;
  }

  abandonItem(itemId: string): boolean {
    const idx = this.playerProgress.inventory.findIndex(item => item.itemId === itemId);
    if (idx < 0) return false;
    this.playerProgress.inventory.splice(idx, 1);

    const manualDef = getPlayerManualDefByItemId(itemId);
    if (manualDef) {
      const manual = this.playerProgress.manuals.find(item => item.manualId === manualDef.id);
      if (manual && !manual.learned) {
        this.playerProgress.manuals = this.playerProgress.manuals.filter(item => item.manualId !== manualDef.id);
      }
    }

    this.persistPlayerProgress();
    return true;
  }

  hasManual(manualId: string): boolean {
    return this.playerProgress.manuals.some(manual => manual.manualId === manualId);
  }

  discoverManual(manualId: string): boolean {
    const manualDef = getPlayerManualDef(manualId);
    const itemId = manualDef?.itemId ?? manualId;
    if (this.hasItem(itemId) || this.hasManual(manualId)) return false;

    this.grantItem(itemId, 1);
    this.playerProgress.manuals.push({
      manualId,
      learned: false,
      progress: 0,
    });
    this.persistPlayerProgress();
    return true;
  }

  learnManual(manualId: string): boolean {
    const manual = this.playerProgress.manuals.find(item => item.manualId === manualId);
    const manualDef = getPlayerManualDef(manualId);
    if (!manual || manual.learned) return false;
    const itemId = manualDef?.itemId ?? manualId;
    if (!this.hasItem(itemId)) return false;

    manual.learned = true;
    manual.progress = 100;
    this.consumeItem(itemId, 1);
    if (manualDef?.attributeBonus) {
      for (const [key, value] of Object.entries(manualDef.attributeBonus)) {
        const attrKey = key as keyof PlayerAttributes;
        this.playerProgress.attributes[attrKey] += this.safeNumber(value, 0);
      }
    }
    if (manualDef?.vitalsBonus) {
      if (manualDef.vitalsBonus.maxHp) this.playerProgress.vitals.maxHp += manualDef.vitalsBonus.maxHp;
      if (manualDef.vitalsBonus.maxMp) this.playerProgress.vitals.maxMp += manualDef.vitalsBonus.maxMp;
    }
    this.persistPlayerProgress();
    return true;
  }

  forgetManual(manualId: string): boolean {
    const manual = this.playerProgress.manuals.find(item => item.manualId === manualId);
    if (!manual || !manual.learned) return false;
    this.playerProgress.manuals = this.playerProgress.manuals.filter(item => item.manualId !== manualId);
    this.persistPlayerProgress();
    return true;
  }

  addManual(manualId: string): boolean {
    return this.discoverManual(manualId);
  }

  restPlayer(hpRecover: 'full' | number, mpRecover: 'full' | number): void {
    const vitals = this.playerProgress.vitals;
    vitals.hp = hpRecover === 'full'
      ? vitals.maxHp
      : Math.min(vitals.maxHp, vitals.hp + hpRecover);
    vitals.mp = mpRecover === 'full'
      ? vitals.maxMp
      : Math.min(vitals.maxMp, vitals.mp + mpRecover);
    this.persistPlayerProgress();
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

  private initPlayerProgress(): void {
    try {
      const saved = localStorage.getItem(LS_KEY_PLAYER_PROGRESS);
      if (!saved) return;
      this.playerProgress = this.normalizePlayerProgress(JSON.parse(saved));
    } catch { /* ignore */ }
  }

  persistPlayerProgress(): void {
    localStorage.setItem(LS_KEY_PLAYER_PROGRESS, JSON.stringify(this.playerProgress));
    this.eventBus.emit('player:progress-changed', this.playerProgress);
    this.eventBus.emit('ui:refresh');
  }

  private safeNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private normalizePlayerProgress(raw: unknown): PlayerProgress {
    if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_PLAYER_PROGRESS);
    const data = raw as Partial<PlayerProgress> & Record<string, unknown>;
    const defaultProgress = structuredClone(DEFAULT_PLAYER_PROGRESS);
    const vitals = this.normalizeVitals(data.vitals);

    return {
      version: 1,
      identity: {
        name: typeof data.identity?.name === 'string' ? data.identity.name : defaultProgress.identity.name,
        title: typeof data.identity?.title === 'string' ? data.identity.title : defaultProgress.identity.title,
      },
      vitals,
      attributes: this.normalizeAttributes(data.attributes),
      inventory: this.normalizeInventory(data.inventory),
      manuals: this.normalizeManuals(data.manuals),
      equipment: this.normalizeEquipment(data.equipment),
      flags: this.normalizeFlags(data.flags),
    };
  }

  private normalizeVitals(raw: unknown): PlayerVitals {
    const data = raw && typeof raw === 'object' ? raw as Partial<PlayerVitals> : {};
    const maxHp = Math.max(1, this.safeNumber(data.maxHp, DEFAULT_PLAYER_PROGRESS.vitals.maxHp));
    const maxMp = Math.max(0, this.safeNumber(data.maxMp, DEFAULT_PLAYER_PROGRESS.vitals.maxMp));
    return {
      hp: Math.max(0, Math.min(maxHp, this.safeNumber(data.hp, DEFAULT_PLAYER_PROGRESS.vitals.hp))),
      maxHp,
      mp: Math.max(0, Math.min(maxMp, this.safeNumber(data.mp, DEFAULT_PLAYER_PROGRESS.vitals.mp))),
      maxMp,
    };
  }

  private normalizeAttributes(raw: unknown): PlayerAttributes {
    const data = raw && typeof raw === 'object' ? raw as Partial<PlayerAttributes> : {};
    return {
      attack: this.safeNumber(data.attack, DEFAULT_PLAYER_PROGRESS.attributes.attack),
      defense: this.safeNumber(data.defense, DEFAULT_PLAYER_PROGRESS.attributes.defense),
      speed: this.safeNumber(data.speed, DEFAULT_PLAYER_PROGRESS.attributes.speed),
      understanding: this.safeNumber(data.understanding, DEFAULT_PLAYER_PROGRESS.attributes.understanding),
      fortune: this.safeNumber(data.fortune, DEFAULT_PLAYER_PROGRESS.attributes.fortune),
    };
  }

  private normalizeInventory(raw: unknown): PlayerInventoryStack[] {
    if (!Array.isArray(raw)) return [];
    const stacks = new Map<string, PlayerInventoryStack>();
    for (const entry of raw) {
      const itemId = typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as PlayerInventoryStack).itemId === 'string'
          ? (entry as PlayerInventoryStack).itemId
          : null;
      if (!itemId) continue;
      const count = typeof entry === 'object' && entry
        ? Math.max(1, Math.floor(this.safeNumber((entry as PlayerInventoryStack).count, 1)))
        : 1;
      const acquiredAt = typeof entry === 'object' && entry
        ? this.safeNumber((entry as PlayerInventoryStack).acquiredAt, Date.now())
        : Date.now();
      const existing = stacks.get(itemId);
      if (existing) {
        existing.count += count;
        existing.acquiredAt = Math.min(existing.acquiredAt ?? acquiredAt, acquiredAt);
      } else {
        stacks.set(itemId, { itemId, count, acquiredAt });
      }
    }
    return Array.from(stacks.values());
  }

  private normalizeManuals(raw: unknown): PlayerManualProgress[] {
    if (!Array.isArray(raw)) return [];
    const manuals = new Map<string, PlayerManualProgress>();
    for (const entry of raw) {
      const manualId = typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as PlayerManualProgress).manualId === 'string'
          ? (entry as PlayerManualProgress).manualId
          : null;
      if (!manualId || manuals.has(manualId)) continue;
      const progress = typeof entry === 'object' && entry
        ? Math.max(0, Math.min(100, this.safeNumber((entry as PlayerManualProgress).progress, 0)))
        : 100;
      const learned = typeof entry === 'object' && entry
        ? !!(entry as PlayerManualProgress).learned
        : true;
      manuals.set(manualId, { manualId, learned, progress });
    }
    return Array.from(manuals.values());
  }

  private normalizeEquipment(raw: unknown): PlayerEquipment {
    if (!raw || typeof raw !== 'object') return {};
    const data = raw as PlayerEquipment;
    return {
      weapon: typeof data.weapon === 'string' ? data.weapon : undefined,
      armor: typeof data.armor === 'string' ? data.armor : undefined,
      accessory: typeof data.accessory === 'string' ? data.accessory : undefined,
    };
  }

  private normalizeFlags(raw: unknown): Record<string, boolean> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>)
        .filter(([key, value]) => key && typeof value === 'boolean'),
    ) as Record<string, boolean>;
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
