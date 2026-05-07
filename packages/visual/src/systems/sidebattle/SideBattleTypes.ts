import type { BattleResult } from '../../types';

export type SideBattleSide = 'left' | 'right';

export type SideBattleSkillType = 'normal' | 'martial' | 'inner' | 'strategy' | 'defense';

export interface SideBattleSkill {
  id: string;
  name: string;
  type: SideBattleSkillType;
  mpCost: number;
  power: number;
  hitRate: number;
  description: string;
  target: 'enemy' | 'self';
  flavor?: string;
}

export interface SideBattleActor {
  id: string;
  name: string;
  side: SideBattleSide;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  hitRate: number;
  dodgeRate: number;
  evolutionStacks: number;
  skills: SideBattleSkill[];
  defending: boolean;
  alive: boolean;
}

export interface SideBattleDamageResult {
  hit: boolean;
  damage: number;
  shieldDamage: number;
  targetShield: number;
  crit: boolean;
  targetHp: number;
}

export interface SideBattleActionResult {
  actor: SideBattleActor;
  target: SideBattleActor;
  skill: SideBattleSkill;
  damage: SideBattleDamageResult;
  battleResult: BattleResult | null;
}
