// ============================================================
// GameStore.ts — 集中式游戏状态
// ============================================================

import {
  AgentState,
  type EventEntry,
  type PlayerAttributes,
  type PlayerEquipment,
  type PlayerCurrencies,
  type PlayerInventoryStack,
  type PlayerMartialProgress,
  type PlayerManualProgress,
  type PlayerNpcAffinity,
  type PlayerProgress,
  type PlayerTradingHeartProgress,
  type PlayerVitals,
  type Strategy,
} from '../types';
import { INITIAL_STRATEGIES, STRATEGIES_URL, EVENTS_URL, POLL_INTERVAL, LS_KEY_STORY, LS_KEY_PLAYER_PROGRESS, LS_KEY_PLAYER_LOCATION } from '../config';
import { EventBus } from './EventBus';
import { getPlayerItemDef } from '../content/PlayerItems';
import { getPlayerManualDef, getPlayerManualDefByItemId } from '../content/PlayerManuals';
import { MARTIAL_LEVEL_MAX, getMartialPowerMultiplier, getMartialRequiredExp } from '../content/PlayerMartialArts';
import { buildPlayerCombatProfile, getStrategyExistenceTier } from '../data/CombatProfile';
import {
  createIndoorPlayerLocation,
  createWorldPlayerLocation,
  getPlayerLocationSignature,
  normalizePlayerLocation,
  type PlayerLocation,
} from './PlayerLocationPersistence';
import { readUserScopedStorage, removeUserScopedStorage, writeUserScopedStorage } from './UserScopedStorage';

const DEFAULT_PLAYER_PROGRESS: PlayerProgress = {
  version: 4,
  identity: { name: '无名少侠', title: '观察者' },
  vitals: { hp: 200, maxHp: 200, mp: 200, maxMp: 200 },
  attributes: {
    attack: 10,
    defense: 10,
    speed: 10,
    understanding: 10,
    fortune: 10,
  },
  currencies: { yuanbao: 100 },
  npcAffinities: {},
  inventory: [],
  manuals: [],
  martials: [{ martialId: 'basic_attack', level: 1, exp: 0, totalUses: 0, hitCount: 0, whiffCount: 0, stack: 0 }],
  tradingHeart: { unlocked: false, level: 0 },
  equipment: {},
  flags: {},
};

export interface MartialUseResult {
  martialId: string;
  level: number;
  exp: number;
  requiredExp: number;
  gainedExp: number;
  leveledUp: boolean;
  levelsGained: number;
}

export type GiftYuanbaoResult =
  | { ok: true; npcId: string; amount: number; favorBefore: number; favorAfter: number; yuanbaoBalance: number }
  | { ok: false; message: string };

export type PurchaseManualResult =
  | { ok: true; productId: string; manualId: string; price: number; learned: boolean; yuanbaoBalance: number }
  | { ok: false; message: string };

type StrategyLike = Omit<Strategy, 'state' | 'existenceTier'> & Partial<Pick<Strategy, 'state' | 'existenceTier'>>;

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
  /** 玩家上次所在稳定场景和坐标 */
  playerLocation: PlayerLocation | null = null;

  private eventBus: EventBus;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private processedEvents: Set<string> = new Set();
  private prevStrategyIds: Set<string> = new Set();
  private lastPlayerLocationSignature = '';
  private storageUsername: string | null;

  constructor(eventBus: EventBus, storageUsername: string | null = null) {
    this.eventBus = eventBus;
    this.storageUsername = storageUsername;
    this.initStoryState();
    this.initPlayerProgress();
    this.initPlayerLocation();
    this.applyUserIdentity();
    this.ensurePlayerCombatBaseline();
    // 同步加载 fallback 数据，确保 WorldScene.create 有数据可用
    this.strategies = INITIAL_STRATEGIES.map((s) => this.normalizeStrategy(s));
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
          this.strategies = this.mergeCoreStrategies(data);
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
        const newStrategies = this.mergeCoreStrategies(data);
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
    const normalized = strategy ? this.normalizeStrategy(strategy) : null;
    this.selectedStrategyId = normalized?.id ?? null;
    this.eventBus.emit('strategy:selected', normalized);
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

  getYuanbao(): number {
    return this.playerProgress.currencies.yuanbao;
  }

  grantYuanbao(amount: number, reason?: string): void {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return;
    this.playerProgress.currencies.yuanbao += safeAmount;
    this.persistPlayerProgress();
    this.eventBus.emit('player:currency-changed', {
      currency: 'yuanbao',
      amount: safeAmount,
      balance: this.playerProgress.currencies.yuanbao,
      reason,
    });
  }

  spendYuanbao(amount: number, reason?: string): boolean {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return false;
    if (this.playerProgress.currencies.yuanbao < safeAmount) return false;
    this.playerProgress.currencies.yuanbao -= safeAmount;
    this.persistPlayerProgress();
    this.eventBus.emit('player:currency-changed', {
      currency: 'yuanbao',
      amount: -safeAmount,
      balance: this.playerProgress.currencies.yuanbao,
      reason,
    });
    return true;
  }

  getNpcAffinity(npcId: string): PlayerNpcAffinity {
    const existing = this.playerProgress.npcAffinities[npcId];
    if (existing) return existing;
    const created: PlayerNpcAffinity = {
      npcId,
      favor: 0,
      giftedYuanbaoTotal: 0,
      giftCount: 0,
      stage: 0,
    };
    this.playerProgress.npcAffinities[npcId] = created;
    return created;
  }

  getNpcFavor(npcId: string): number {
    return this.getNpcAffinity(npcId).favor;
  }

  addNpcFavor(npcId: string, amount: number): { favorBefore: number; favorAfter: number } {
    const safeAmount = Math.floor(amount);
    const affinity = this.getNpcAffinity(npcId);
    const favorBefore = affinity.favor;
    affinity.favor = Math.max(0, favorBefore + safeAmount);
    affinity.stage = this.getNpcFavorStage(affinity.favor);
    this.persistPlayerProgress();
    this.eventBus.emit('npc:favor-changed', {
      npcId,
      favorBefore,
      favorAfter: affinity.favor,
      amount: safeAmount,
    });
    return { favorBefore, favorAfter: affinity.favor };
  }

  giftYuanbaoToNpc(npcId: string, amount: number): GiftYuanbaoResult {
    const safeAmount = Math.max(1, Math.floor(amount));
    if (!this.spendYuanbao(safeAmount, `gift:${npcId}`)) {
      return { ok: false, message: '元宝不足' };
    }

    const affinity = this.getNpcAffinity(npcId);
    const favorBefore = affinity.favor;
    affinity.favor += safeAmount;
    affinity.giftedYuanbaoTotal += safeAmount;
    affinity.giftCount += 1;
    affinity.lastGiftAt = Date.now();
    affinity.stage = this.getNpcFavorStage(affinity.favor);
    this.persistPlayerProgress();
    this.eventBus.emit('npc:favor-changed', {
      npcId,
      favorBefore,
      favorAfter: affinity.favor,
      amount: safeAmount,
    });

    return {
      ok: true,
      npcId,
      amount: safeAmount,
      favorBefore,
      favorAfter: affinity.favor,
      yuanbaoBalance: this.playerProgress.currencies.yuanbao,
    };
  }

  purchaseManualWithYuanbao(productId: string, manualId: string, price: number, learnImmediately = true): PurchaseManualResult {
    const safePrice = Math.max(0, Math.floor(price));
    const manualDef = getPlayerManualDef(manualId);
    if (!manualDef) return { ok: false, message: '秘籍不存在' };
    if (this.hasManual(manualId)) return { ok: false, message: '已拥有该秘籍' };
    if (this.playerProgress.currencies.yuanbao < safePrice) return { ok: false, message: '元宝不足' };

    if (safePrice > 0 && !this.spendYuanbao(safePrice, `shop:${productId}`)) {
      return { ok: false, message: '元宝不足' };
    }

    const discovered = this.discoverManual(manualId);
    if (!discovered) return { ok: false, message: '购买失败' };
    const learned = learnImmediately ? this.learnManual(manualId) : false;
    this.eventBus.emit('shop:purchase', {
      productId,
      manualId,
      price: safePrice,
      learned,
    });

    return {
      ok: true,
      productId,
      manualId,
      price: safePrice,
      learned,
      yuanbaoBalance: this.playerProgress.currencies.yuanbao,
    };
  }

  getSavedPlayerLocation(): PlayerLocation | null {
    return this.playerLocation ? { ...this.playerLocation } : null;
  }

  resetObserverIntroDebugState(): void {
    for (const flag of [
      'story.observer_intro_prompt_seen',
      'story.observer_awake',
      'story.has_observer_journal',
      'story.gushen_hub_unlocked',
      'objective.visit_teahouse',
      'objective.visit_sect',
      'world.teahouse_discussion.sects_seen',
      'world.teahouse_discussion.trial_cave_seen',
      'world.teahouse_discussion.building_seen',
      'world.unlock.a_share_clue',
      'world.unlock.trial_cave',
      'world.unlock.construction_site',
    ]) {
      delete this.storyFlags[flag];
    }
    this.completedStories.delete('observer_house_arrival_prompt');
    this.completedStories.delete('observer_house_intro_wakeup');
    this.persistStoryState();

    this.playerLocation = null;
    this.playerPosition = { x: 0, y: 0 };
    this.lastPlayerLocationSignature = '';
    removeUserScopedStorage(LS_KEY_PLAYER_LOCATION, this.storageUsername);
  }

  saveWorldPlayerLocation(x: number, y: number): void {
    const location = createWorldPlayerLocation(x, y);
    if (location) this.persistPlayerLocation(location);
  }

  saveIndoorPlayerLocation(
    buildingId: string | null | undefined,
    x: number,
    y: number,
    worldX?: number,
    worldY?: number,
  ): void {
    const location = createIndoorPlayerLocation(buildingId, x, y, worldX, worldY);
    if (location) this.persistPlayerLocation(location);
  }

  hasPlayerFlag(flag: string): boolean {
    return !!this.playerProgress.flags[flag];
  }

  setPlayerFlag(flag: string, value = true): void {
    this.playerProgress.flags[flag] = value;
    this.persistPlayerProgress();
  }

  getTradingHeartLevel(): number {
    return this.playerProgress.tradingHeart.unlocked
      ? Math.max(1, this.playerProgress.tradingHeart.level)
      : 0;
  }

  unlockTradingHeart(initialLevel = 1): boolean {
    const level = Math.max(1, Math.floor(this.safeNumber(initialLevel, 1)));
    const tradingHeart = this.playerProgress.tradingHeart;
    const changed = !tradingHeart.unlocked || tradingHeart.level !== level;
    tradingHeart.unlocked = true;
    tradingHeart.level = level;
    tradingHeart.updatedAt = Date.now();
    if (changed) this.persistPlayerProgress();
    return changed;
  }

  setTradingHeartLevel(level: number): boolean {
    const safeLevel = Math.max(0, Math.floor(this.safeNumber(level, 0)));
    const tradingHeart = this.playerProgress.tradingHeart;
    const changed = tradingHeart.level !== safeLevel || tradingHeart.unlocked !== (safeLevel > 0);
    tradingHeart.level = safeLevel;
    tradingHeart.unlocked = safeLevel > 0;
    tradingHeart.updatedAt = Date.now();
    if (changed) this.persistPlayerProgress();
    return changed;
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
    for (const martialId of manualDef?.martialUnlockIds ?? []) {
      if (!this.playerProgress.martials.some(item => item.martialId === martialId)) {
        this.playerProgress.martials.push(this.createDefaultMartialProgress(martialId));
      }
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

  getMartialProgress(martialId: string): PlayerMartialProgress {
    let progress = this.playerProgress.martials.find(item => item.martialId === martialId);
    if (!progress) {
      progress = this.createDefaultMartialProgress(martialId);
      this.playerProgress.martials.push(progress);
    }
    return progress;
  }

  getMartialPowerMultiplier(martialId: string): number {
    const progress = this.getMartialProgress(martialId);
    return getMartialPowerMultiplier(progress.level, progress.stack);
  }

  recordMartialUse(martialId: string, hit: boolean): MartialUseResult {
    const progress = this.getMartialProgress(martialId);
    const gainedExp = hit ? 2 : 1;
    const startLevel = progress.level;

    progress.totalUses += 1;
    if (hit) progress.hitCount += 1;
    else progress.whiffCount += 1;

    if (progress.level < MARTIAL_LEVEL_MAX) {
      progress.exp += gainedExp;
      while (progress.level < MARTIAL_LEVEL_MAX) {
        const required = getMartialRequiredExp(progress.level);
        if (required <= 0 || progress.exp < required) break;
        progress.exp -= required;
        progress.level += 1;
      }
      if (progress.level >= MARTIAL_LEVEL_MAX) progress.exp = 0;
    }

    this.persistPlayerProgress();
    const requiredExp = getMartialRequiredExp(progress.level);
    return {
      martialId,
      level: progress.level,
      exp: progress.exp,
      requiredExp,
      gainedExp,
      leveledUp: progress.level > startLevel,
      levelsGained: progress.level - startLevel,
    };
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

  setPlayerVitals(hp: number, mp: number, maxHp?: number, maxMp?: number): void {
    const vitals = this.playerProgress.vitals;
    if (typeof maxHp === 'number' && Number.isFinite(maxHp)) {
      vitals.maxHp = Math.max(1, Math.round(maxHp));
    }
    if (typeof maxMp === 'number' && Number.isFinite(maxMp)) {
      vitals.maxMp = Math.max(0, Math.round(maxMp));
    }
    vitals.hp = Math.max(0, Math.min(vitals.maxHp, Math.round(hp)));
    vitals.mp = Math.max(0, Math.min(vitals.maxMp, Math.round(mp)));
    this.persistPlayerProgress();
  }

  private normalizeStrategy(strategy: StrategyLike): Strategy {
    return {
      ...strategy,
      state: strategy.state ?? this.deriveState(strategy.returnPct),
      existenceTier: getStrategyExistenceTier(strategy),
    };
  }

  private mergeCoreStrategies(strategies: StrategyLike[]): Strategy[] {
    const merged = strategies.map((s) => this.normalizeStrategy(s));
    const ids = new Set(merged.map((s) => s.id));
    for (const core of INITIAL_STRATEGIES) {
      if (!ids.has(core.id)) {
        merged.push(this.normalizeStrategy(core));
        ids.add(core.id);
      }
    }
    return merged;
  }

  private ensurePlayerCombatBaseline(): void {
    const attrs = this.playerProgress.attributes;
    attrs.attack = Math.max(10, attrs.attack);
    attrs.defense = Math.max(10, attrs.defense);
    attrs.speed = Math.max(10, attrs.speed);
    attrs.understanding = Math.max(10, attrs.understanding);
    attrs.fortune = Math.max(10, attrs.fortune);

    const vitals = this.playerProgress.vitals;
    const oldMaxHp = Math.max(1, vitals.maxHp);
    const oldMaxMp = Math.max(1, vitals.maxMp);
    const hpRatio = vitals.hp / oldMaxHp;
    const mpRatio = vitals.mp / oldMaxMp;
    const baseline = buildPlayerCombatProfile(this.playerProgress);
    const nextMaxHp = Math.max(oldMaxHp, baseline.maxHp);
    const nextMaxMp = Math.max(oldMaxMp, baseline.maxMp);

    if (nextMaxHp !== oldMaxHp) {
      vitals.maxHp = nextMaxHp;
      vitals.hp = Math.max(1, Math.round(nextMaxHp * hpRatio));
    }
    if (nextMaxMp !== oldMaxMp) {
      vitals.maxMp = nextMaxMp;
      vitals.mp = Math.max(0, Math.round(nextMaxMp * mpRatio));
    }
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
      const saved = readUserScopedStorage(LS_KEY_STORY, this.storageUsername);
      if (saved) {
        const data = JSON.parse(saved);
        this.storyFlags = data.flags || {};
        this.completedStories = new Set(data.completed || []);
        this.tutorialCompleted = data.tutorialCompleted ?? false;
        this.normalizeStoryProgressionFlags();
      }
    } catch { /* ignore */ }
  }

  private normalizeStoryProgressionFlags(): void {
    let changed = false;
    const ensureFlag = (flag: string, value = true): void => {
      if (this.storyFlags[flag] === value) return;
      this.storyFlags[flag] = value;
      changed = true;
    };

    if (this.storyFlags['world.teahouse_discussion.trial_cave_seen']) {
      ensureFlag('world.unlock.trial_cave');
    }
    if (this.storyFlags['world.teahouse_discussion.sects_seen']) {
      ensureFlag('world.unlock.a_share_clue');
    }
    if (this.storyFlags['world.teahouse_discussion.building_seen']) {
      ensureFlag('world.unlock.construction_site');
    }

    if (changed) this.persistStoryState();
  }

  private initPlayerProgress(): void {
    try {
      const saved = readUserScopedStorage(LS_KEY_PLAYER_PROGRESS, this.storageUsername);
      if (!saved) return;
      this.playerProgress = this.normalizePlayerProgress(JSON.parse(saved));
    } catch { /* ignore */ }
  }

  private initPlayerLocation(): void {
    try {
      const saved = readUserScopedStorage(LS_KEY_PLAYER_LOCATION, this.storageUsername);
      if (!saved) return;
      const location = normalizePlayerLocation(JSON.parse(saved));
      if (!location) return;
      this.playerLocation = location;
      this.playerPosition = { x: location.x, y: location.y };
      this.lastPlayerLocationSignature = getPlayerLocationSignature(location);
    } catch { /* ignore */ }
  }

  private applyUserIdentity(): void {
    const name = this.storageUsername?.trim();
    if (!name) return;
    const currentName = this.playerProgress.identity.name.trim();
    if (currentName && currentName !== DEFAULT_PLAYER_PROGRESS.identity.name) return;
    this.playerProgress.identity.name = name;
  }

  setPlayerName(name: string): boolean {
    const nextName = name.trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!nextName || nextName === this.playerProgress.identity.name) return false;
    this.playerProgress.identity.name = nextName;
    this.persistPlayerProgress();
    return true;
  }

  private persistPlayerLocation(location: PlayerLocation): void {
    const normalized = normalizePlayerLocation(location);
    if (!normalized) return;
    const signature = getPlayerLocationSignature(normalized);
    if (signature === this.lastPlayerLocationSignature) return;
    this.playerLocation = normalized;
    this.playerPosition = { x: normalized.x, y: normalized.y };
    this.lastPlayerLocationSignature = signature;
    writeUserScopedStorage(LS_KEY_PLAYER_LOCATION, JSON.stringify(normalized), this.storageUsername);
    this.eventBus.emit('player:moved', { x: normalized.x, y: normalized.y });
  }

  persistPlayerProgress(): void {
    this.ensurePlayerCombatBaseline();
    writeUserScopedStorage(LS_KEY_PLAYER_PROGRESS, JSON.stringify(this.playerProgress), this.storageUsername);
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
      version: defaultProgress.version,
      identity: {
        name: typeof data.identity?.name === 'string' ? data.identity.name : defaultProgress.identity.name,
        title: typeof data.identity?.title === 'string' ? data.identity.title : defaultProgress.identity.title,
      },
      vitals,
      attributes: this.normalizeAttributes(data.attributes),
      currencies: this.normalizeCurrencies(data.currencies),
      npcAffinities: this.normalizeNpcAffinities(data.npcAffinities),
      inventory: this.normalizeInventory(data.inventory),
      manuals: this.normalizeManuals(data.manuals),
      martials: this.normalizeMartials(data.martials),
      tradingHeart: this.normalizeTradingHeart(data.tradingHeart),
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

  private normalizeCurrencies(raw: unknown): PlayerCurrencies {
    const data = raw && typeof raw === 'object' ? raw as Partial<PlayerCurrencies> : {};
    return {
      yuanbao: Math.max(0, Math.floor(this.safeNumber(data.yuanbao, DEFAULT_PLAYER_PROGRESS.currencies.yuanbao))),
    };
  }

  private normalizeTradingHeart(raw: unknown): PlayerTradingHeartProgress {
    const data = raw && typeof raw === 'object' ? raw as Partial<PlayerTradingHeartProgress> : {};
    const level = Math.max(0, Math.floor(this.safeNumber(data.level, DEFAULT_PLAYER_PROGRESS.tradingHeart.level)));
    const unlocked = Boolean(data.unlocked) || level > 0;
    return {
      unlocked,
      level: unlocked ? Math.max(1, level) : 0,
      updatedAt: this.safeNumber(data.updatedAt, 0) || undefined,
    };
  }

  private normalizeNpcAffinities(raw: unknown): Record<string, PlayerNpcAffinity> {
    if (!raw || typeof raw !== 'object') return {};
    const result: Record<string, PlayerNpcAffinity> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!key || !value || typeof value !== 'object') continue;
      const data = value as Partial<PlayerNpcAffinity>;
      const npcId = typeof data.npcId === 'string' && data.npcId ? data.npcId : key;
      const favor = Math.max(0, Math.floor(this.safeNumber(data.favor, 0)));
      result[npcId] = {
        npcId,
        favor,
        giftedYuanbaoTotal: Math.max(0, Math.floor(this.safeNumber(data.giftedYuanbaoTotal, 0))),
        giftCount: Math.max(0, Math.floor(this.safeNumber(data.giftCount, 0))),
        lastGiftAt: this.safeNumber(data.lastGiftAt, 0) || undefined,
        stage: this.getNpcFavorStage(favor),
      };
    }
    return result;
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

  private normalizeMartials(raw: unknown): PlayerMartialProgress[] {
    const martials = new Map<string, PlayerMartialProgress>();
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const data = entry as Partial<PlayerMartialProgress>;
        if (typeof data.martialId !== 'string' || !data.martialId) continue;
        martials.set(data.martialId, {
          martialId: data.martialId,
          level: Math.max(1, Math.min(MARTIAL_LEVEL_MAX, Math.floor(this.safeNumber(data.level, 1)))),
          exp: Math.max(0, Math.floor(this.safeNumber(data.exp, 0))),
          totalUses: Math.max(0, Math.floor(this.safeNumber(data.totalUses, 0))),
          hitCount: Math.max(0, Math.floor(this.safeNumber(data.hitCount, 0))),
          whiffCount: Math.max(0, Math.floor(this.safeNumber(data.whiffCount, 0))),
          stack: Math.max(0, Math.floor(this.safeNumber(data.stack, 0))),
        });
      }
    }

    if (!martials.has('basic_attack')) {
      martials.set('basic_attack', this.createDefaultMartialProgress('basic_attack'));
    }
    return Array.from(martials.values());
  }

  private createDefaultMartialProgress(martialId: string): PlayerMartialProgress {
    return { martialId, level: 1, exp: 0, totalUses: 0, hitCount: 0, whiffCount: 0, stack: 0 };
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

  private getNpcFavorStage(favor: number): number {
    if (favor >= 100) return 4;
    if (favor >= 80) return 3;
    if (favor >= 50) return 2;
    if (favor >= 20) return 1;
    return 0;
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
    writeUserScopedStorage(LS_KEY_STORY, JSON.stringify({
      flags: this.storyFlags,
      completed: Array.from(this.completedStories),
      tutorialCompleted: this.tutorialCompleted,
    }), this.storageUsername);
  }

  tickDay(): void {
    this.dayCount++;
    this.eventBus.emit('day:tick', this.dayCount);
  }
}
