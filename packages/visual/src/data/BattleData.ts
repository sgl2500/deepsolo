// ============================================================
// BattleData.ts — 武功定义 + 战斗角色工厂
// ============================================================
//
// V1 统一战斗规则中，真实战斗属性以 CombatProfile 为准。
// data/agents/{id}/battle.json 只保留武功、移动等载具配置。
// ============================================================

import { type BattlePerson, type PlayerProgress, type Strategy, type WugongDef, WugongType, Direction } from '../types';
import { buildPlayerCombatProfile, buildStrategyCombatProfile, DEFAULT_EXISTENCE_TIER } from './CombatProfile';
import { getBattleStats, deriveBattleStats, getKnownAgentIds, type BattleStats } from './agents';

type BattleLoadout = {
  moveRange: number;
  wugongId: string;
};

// ── 武功定义 ──

export const NORMAL_ATTACK: WugongDef = {
  id: 'normal_attack',
  name: '普通攻击',
  type: WugongType.Fist,
  mpCost: 0,
  power: 40,
  hitRate: 90,
  attackRange: 1,
  effectId: '003',
  aoeSize: 1,
};

export const WUGONG_DEFS: Record<string, WugongDef> = {
  zhuihun_jian: {
    id: 'zhuihun_jian', name: '追魂剑法', type: WugongType.Sword,
    mpCost: 30, power: 120, hitRate: 85, attackRange: 2,
    effectId: '005', aoeSize: 3,
  },
  fengmo_zhang: {
    id: 'fengmo_zhang', name: '疯魔杖法', type: WugongType.Special,
    mpCost: 40, power: 150, hitRate: 75, attackRange: 1,
    effectId: '008', aoeSize: 3,
  },
  taiji_quan: {
    id: 'taiji_quan', name: '太极拳', type: WugongType.Fist,
    mpCost: 25, power: 90, hitRate: 95, attackRange: 1,
    effectId: '004', aoeSize: 3,
  },
  jingang_fumo: {
    id: 'jingang_fumo', name: '金刚伏魔功', type: WugongType.Neigong,
    mpCost: 50, power: 100, hitRate: 90, attackRange: 3,
    effectId: '001', aoeSize: 3,
  },
  luoying_shenjian: {
    id: 'luoying_shenjian', name: '落英神剑掌', type: WugongType.Fist,
    mpCost: 35, power: 130, hitRate: 80, attackRange: 2,
    effectId: '006', aoeSize: 3,
  },
  dugu_jiujian: {
    id: 'dugu_jiujian', name: '独孤九剑', type: WugongType.Sword,
    mpCost: 45, power: 160, hitRate: 80, attackRange: 2,
    effectId: '009', aoeSize: 3,
  },
};

// ── 名称映射（从 profile.json 读取，这里做 fallback） ──

const NAMES: Record<string, string> = {
  hv1: '人气追涨', hv2: '妖股追涨', hv3: '上影线追涨', hv4: '分时大票',
  nv1: '多信号综合', nv2: '早盘强势',
};

// ── 角色工厂 ──

/** 根据策略 ID 创建战斗角色。策略存在时，真实战斗属性以统一世界规则推导。 */
export function createBattlePerson(
  agentId: string,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
  displayName?: string,
  strategy?: Strategy,
): BattlePerson {
  if (strategy) {
    const combat = buildStrategyCombatProfile(strategy);
    const fallbackWugongId = strategy.sourceWorkspace ? 'jingang_fumo' : 'taiji_quan';
    const loadout = resolveBattleLoadout(agentId, combat.existenceTier >= 10 ? 4 : 3, fallbackWugongId);
    return createCombatBackedPerson(agentId, team, startPos, displayName, loadout, combat);
  }

  const legacyStats = getBattleStats(agentId);
  if (legacyStats) {
    return createLegacyBattlePerson(agentId, team, startPos, displayName, legacyStats);
  }

  return createFallbackPerson(agentId, team, startPos, displayName);
}

/** 从父母属性生成衍生 Agent 战斗角色。 */
export function createDerivedBattlePerson(
  agentId: string,
  agentName: string,
  parentAId: string,
  parentBId: string,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
): BattlePerson {
  const statsA = getBattleStats(parentAId);
  const statsB = getBattleStats(parentBId);

  let stats: BattleStats;
  if (statsA && statsB) {
    const wugongKeys = Object.keys(WUGONG_DEFS);
    const wugongId = wugongKeys[Math.floor(Math.random() * wugongKeys.length)];
    stats = deriveBattleStats(statsA, statsB, wugongId);
  } else {
    stats = randomFallbackStats();
  }

  return createLegacyBattlePerson(agentId, team, startPos, agentName, stats);
}

/** 从玩家长期档案创建战斗角色。 */
export function createPlayerBattlePerson(
  progress: PlayerProgress,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
): BattlePerson {
  const combat = buildPlayerCombatProfile(progress);
  const maxHp = Math.max(combat.maxHp, Math.round(progress.vitals.maxHp));
  const maxMp = Math.max(combat.maxMp, Math.round(progress.vitals.maxMp));

  return {
    id: 'player',
    name: progress.identity.name,
    team,
    existenceTier: combat.existenceTier,
    hp: clampValue(progress.vitals.hp, 1, maxHp),
    maxHp,
    mp: clampValue(progress.vitals.mp, 0, maxMp),
    maxMp,
    attack: combat.attack,
    defense: combat.defense,
    hitRate: combat.hitRate,
    dodgeRate: combat.dodgeRate,
    speed: combat.speed,
    moveRange: 4,
    wugong: NORMAL_ATTACK,
    pos: { ...startPos },
    facing: team === 'red' ? Direction.Down : Direction.Up,
    alive: true,
  };
}

/** 获取所有可参战的策略 ID */
export function getAvailableFighterIds(): string[] {
  return getKnownAgentIds();
}

/** 每个特效贴图的帧数 */
export const EFT_FRAME_COUNTS: Record<string, number> = {
  '000': 10,
  '001': 14,
  '002': 16,
  '003': 9,
  '004': 13,
  '005': 16,
  '006': 16,
  '007': 16,
  '008': 18,
  '009': 19,
};

function createCombatBackedPerson(
  agentId: string,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
  displayName: string | undefined,
  loadout: BattleLoadout,
  combat: ReturnType<typeof buildStrategyCombatProfile>,
): BattlePerson {
  return {
    id: agentId,
    name: displayName ?? NAMES[agentId] ?? agentId,
    team,
    existenceTier: combat.existenceTier,
    hp: combat.maxHp,
    maxHp: combat.maxHp,
    mp: combat.maxMp,
    maxMp: combat.maxMp,
    attack: combat.attack,
    defense: combat.defense,
    hitRate: combat.hitRate,
    dodgeRate: combat.dodgeRate,
    speed: combat.speed,
    moveRange: loadout.moveRange,
    wugong: WUGONG_DEFS[loadout.wugongId] ?? NORMAL_ATTACK,
    pos: { ...startPos },
    facing: team === 'red' ? Direction.Down : Direction.Up,
    alive: true,
  };
}

function createLegacyBattlePerson(
  agentId: string,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
  displayName: string | undefined,
  stats: BattleStats,
): BattlePerson {
  return {
    id: agentId,
    name: displayName ?? NAMES[agentId] ?? agentId,
    team,
    existenceTier: DEFAULT_EXISTENCE_TIER,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    mp: stats.maxMp,
    maxMp: stats.maxMp,
    attack: stats.attack,
    defense: stats.defense,
    hitRate: 10,
    dodgeRate: 10,
    speed: stats.speed,
    moveRange: clampMoveRange(stats.moveRange, 3),
    wugong: WUGONG_DEFS[stats.wugongId] ?? NORMAL_ATTACK,
    pos: { ...startPos },
    facing: team === 'red' ? Direction.Down : Direction.Up,
    alive: true,
  };
}

/** 无档案时回退随机属性 */
function createFallbackPerson(
  agentId: string,
  team: 'red' | 'blue',
  startPos: { x: number; y: number },
  displayName?: string,
): BattlePerson {
  const stats = randomFallbackStats();
  return createLegacyBattlePerson(agentId, team, startPos, displayName, stats);
}

function resolveBattleLoadout(agentId: string, defaultMoveRange: number, defaultWugongId: string): BattleLoadout {
  const stats = getBattleStats(agentId);
  return {
    moveRange: clampMoveRange(stats?.moveRange, defaultMoveRange),
    wugongId: stats?.wugongId ?? defaultWugongId,
  };
}

function randomFallbackStats(): BattleStats {
  const wugongKeys = Object.keys(WUGONG_DEFS);
  return {
    maxHp: 180 + Math.floor(Math.random() * 220),
    maxMp: 180 + Math.floor(Math.random() * 120),
    attack: 180 + Math.floor(Math.random() * 80),
    defense: 90 + Math.floor(Math.random() * 50),
    speed: 40 + Math.floor(Math.random() * 10),
    moveRange: 3 + Math.floor(Math.random() * 2),
    wugongId: wugongKeys[Math.floor(Math.random() * wugongKeys.length)],
  };
}

function clampMoveRange(value: number | undefined, fallback: number): number {
  const safe = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(6, Math.max(2, safe));
}

function clampValue(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}
