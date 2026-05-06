import type { PlayerProgress, Strategy } from '../types';

export const DEFAULT_EXISTENCE_TIER = 1;
export const LIVE_EXISTENCE_TIER = 10;
export const NEUTRAL_DRAWDOWN_PCT = 20;
const BASE_ATTRIBUTE = 10;
const BASE_COMBAT_ATTR = 10;

export interface CombatProfile {
  existenceTier: number;
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  hpAttr: number;
  mpAttr: number;
  attackAttr: number;
  defenseAttr: number;
  hitRate: number;
  dodgeRate: number;
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  constitutionBonus: number;
  attackBonus: number;
}

type CombatProfileInput = {
  existenceTier?: number;
  returnPct?: number;
  maxDrawdownPct?: number;
  strength?: number;
  intelligence?: number;
  agility?: number;
  constitution?: number;
  hpAttr?: number;
  mpAttr?: number;
  attackAttr?: number;
  defenseAttr?: number;
  hitRate?: number;
  dodgeRate?: number;
};

export function getStrategyExistenceTier(strategy: Pick<Strategy, 'sourceWorkspace' | 'existenceTier'>): number {
  return strategy.existenceTier ?? (strategy.sourceWorkspace ? LIVE_EXISTENCE_TIER : DEFAULT_EXISTENCE_TIER);
}

export function buildStrategyCombatProfile(strategy: Pick<
  Strategy,
  'returnPct' | 'maxDrawdownPct' | 'sourceWorkspace' | 'existenceTier'
>): CombatProfile {
  return buildCombatProfile({
    existenceTier: getStrategyExistenceTier(strategy),
    returnPct: strategy.returnPct,
    maxDrawdownPct: strategy.maxDrawdownPct,
  });
}

export function buildPlayerCombatProfile(progress: PlayerProgress): CombatProfile {
  return buildCombatProfile({
    existenceTier: DEFAULT_EXISTENCE_TIER,
    returnPct: 0,
    maxDrawdownPct: NEUTRAL_DRAWDOWN_PCT,
    strength: progress.attributes.attack,
    intelligence: progress.attributes.understanding,
    agility: progress.attributes.speed,
    constitution: progress.attributes.defense,
    hpAttr: BASE_COMBAT_ATTR,
    mpAttr: BASE_COMBAT_ATTR,
    attackAttr: BASE_COMBAT_ATTR,
    defenseAttr: BASE_COMBAT_ATTR,
    hitRate: BASE_COMBAT_ATTR,
    dodgeRate: BASE_COMBAT_ATTR,
  });
}

export function buildCombatProfile(input: CombatProfileInput): CombatProfile {
  const existenceTier = Math.max(DEFAULT_EXISTENCE_TIER, Math.round(input.existenceTier ?? DEFAULT_EXISTENCE_TIER));
  const returnPct = safeNumber(input.returnPct, 0);
  const maxDrawdownPct = clamp(safeNumber(input.maxDrawdownPct, NEUTRAL_DRAWDOWN_PCT), 0, 100);

  const strength = Math.max(1, Math.round(input.strength ?? BASE_ATTRIBUTE));
  const intelligence = Math.max(1, Math.round(input.intelligence ?? BASE_ATTRIBUTE));
  const agility = Math.max(1, Math.round(input.agility ?? BASE_ATTRIBUTE));
  const baseConstitution = Math.max(1, Math.round(input.constitution ?? BASE_ATTRIBUTE));

  const hpAttr = Math.max(1, Math.round(input.hpAttr ?? BASE_COMBAT_ATTR));
  const mpAttr = Math.max(1, Math.round(input.mpAttr ?? BASE_COMBAT_ATTR));
  const baseAttackAttr = Math.max(1, Math.round(input.attackAttr ?? BASE_COMBAT_ATTR));
  const baseDefenseAttr = Math.max(1, Math.round(input.defenseAttr ?? BASE_COMBAT_ATTR));
  const hitRate = Math.max(1, Math.round(input.hitRate ?? BASE_COMBAT_ATTR));
  const dodgeRate = Math.max(1, Math.round(input.dodgeRate ?? BASE_COMBAT_ATTR));

  const constitutionBonus = Math.max(0, Math.floor((20 - maxDrawdownPct) / 2));
  const constitution = baseConstitution + constitutionBonus;

  const liveAttackBonus = Math.floor((existenceTier - 1) / 4);
  const attackStep = Math.max(20, Math.round(60 - ((existenceTier - 1) * 40) / 9));
  const returnAttackBonus = Math.floor(Math.max(returnPct, 0) / attackStep);
  const strengthBonus = Math.max(0, strength - BASE_ATTRIBUTE);
  const constitutionAttrBonus = Math.max(0, baseConstitution - BASE_ATTRIBUTE);
  const intelligenceBonus = Math.max(0, intelligence - BASE_ATTRIBUTE);
  const agilityBonus = Math.max(0, agility - BASE_ATTRIBUTE);

  const attackBonus = liveAttackBonus + returnAttackBonus;
  const attackAttr = baseAttackAttr + strengthBonus + attackBonus;
  const defenseAttr = baseDefenseAttr + constitutionAttrBonus + constitutionBonus;
  const maxHp = Math.max(100 * existenceTier, Math.round(existenceTier * (200 + returnPct)));
  const maxMp = Math.max(100, mpAttr * 20 + intelligenceBonus * 10);
  const attack = Math.max(60, attackAttr * 20);
  const defense = Math.max(40, defenseAttr * 10);
  const speed = Math.max(20, 40 + agilityBonus * 4 + liveAttackBonus * 2);

  return {
    existenceTier,
    strength,
    intelligence,
    agility,
    constitution,
    hpAttr,
    mpAttr,
    attackAttr,
    defenseAttr,
    hitRate,
    dodgeRate,
    maxHp,
    maxMp,
    attack,
    defense,
    speed,
    constitutionBonus,
    attackBonus,
  };
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
