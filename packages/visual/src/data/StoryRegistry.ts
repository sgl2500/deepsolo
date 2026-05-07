// ============================================================
// StoryRegistry.ts — 条件谓词 + 动作处理器注册表
// ============================================================
//
// 扩展时只需在此文件添加 conditions.set() / actions.set()，
// 无需修改 StorySystem。
// ============================================================

import type { StoryCondition, StoryAction } from '../types';
import type { GameStore } from '../core/GameStore';
import type { EventBus } from '../core/EventBus';

type ConditionHandler = (params: Record<string, any>, store: GameStore) => boolean;
type ActionHandler = (params: Record<string, any>, store: GameStore, eventBus: EventBus) => void;

/** 条件处理器注册表 */
const conditions = new Map<string, ConditionHandler>();

/** 动作处理器注册表 */
const actions = new Map<string, ActionHandler>();

// ── 内置条件 ──

conditions.set('strategy_exists', (params, store) => {
  return !!store.getStrategy(params.strategyId);
});

conditions.set('strategy_return_gt', (params, store) => {
  const s = store.getStrategy(params.strategyId);
  return !!s && s.returnPct > (params.threshold as number);
});

conditions.set('npc_favor_gte', (params, store) => {
  return store.getNpcFavor(params.npcId as string) >= (params.favor as number);
});

conditions.set('has_yuanbao_gte', (params, store) => {
  return store.getYuanbao() >= (params.amount as number);
});

conditions.set('manual_not_owned', (params, store) => {
  return !store.hasManual(params.manualId as string);
});

conditions.set('flag_not_set', (params, store) => {
  return !store.storyFlags[params.flag as string];
});

conditions.set('flag_is', (params, store) => {
  return store.storyFlags[params.flag as string] === (params.value ?? true);
});

conditions.set('day_gt', (params, store) => {
  return store.dayCount > (params.day as number);
});

conditions.set('never_completed', (params, store) => {
  return !store.completedStories.has(params.storyId as string);
});

// ── 内置动作 ──

actions.set('set_flag', (params, store, _eventBus) => {
  store.storyFlags[params.flag as string] = params.value ?? true;
  store.persistStoryState();
});

actions.set('mark_completed', (params, store, _eventBus) => {
  store.completedStories.add(params.storyId as string);
  store.persistStoryState();
});

actions.set('add_event_log', (params, store, _eventBus) => {
  store.addEvent(params.agentName as string, params.text as string);
  _eventBus.emit('ui:refresh');
});

actions.set('grant_manual', (params, store, _eventBus) => {
  const added = store.discoverManual(params.manualId as string);
  if (added) {
    store.addEvent(params.agentName as string || '观察者', `获得秘籍《${params.manualName as string || params.manualId}》`);
    _eventBus.emit('ui:refresh');
  }
});

actions.set('grant_yuanbao', (params, store, _eventBus) => {
  store.grantYuanbao(params.amount as number, params.reason as string | undefined);
  _eventBus.emit('ui:refresh');
});

actions.set('spend_yuanbao', (params, store, _eventBus) => {
  store.spendYuanbao(params.amount as number, params.reason as string | undefined);
  _eventBus.emit('ui:refresh');
});

actions.set('add_npc_favor', (params, store, _eventBus) => {
  store.addNpcFavor(params.npcId as string, params.amount as number);
  _eventBus.emit('ui:refresh');
});

actions.set('gift_yuanbao', (params, store, _eventBus) => {
  store.giftYuanbaoToNpc(params.npcId as string, params.amount as number);
  _eventBus.emit('ui:refresh');
});

// ── 公共 API ──

/** 评估单个条件 */
export function evaluateCondition(condition: StoryCondition, store: GameStore): boolean {
  const handler = conditions.get(condition.type);
  if (!handler) {
    console.warn('[StoryRegistry] Unknown condition:', condition.type);
    return false;
  }
  return handler(condition.params, store);
}

/** 评估所有条件（AND 逻辑） */
export function evaluateAllConditions(conditionsList: StoryCondition[], store: GameStore): boolean {
  return conditionsList.every(c => evaluateCondition(c, store));
}

/** 执行单个动作 */
export function executeAction(action: StoryAction, store: GameStore, eventBus: EventBus): void {
  const handler = actions.get(action.type);
  if (!handler) {
    console.warn('[StoryRegistry] Unknown action:', action.type);
    return;
  }
  handler(action.params, store, eventBus);
}

/** 执行多个动作 */
export function executeActions(
  actionsList: StoryAction[] | undefined,
  store: GameStore,
  eventBus: EventBus,
): void {
  if (!actionsList) return;
  for (const a of actionsList) {
    executeAction(a, store, eventBus);
  }
}
