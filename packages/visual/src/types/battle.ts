import type { Direction } from './common';

/** 手动控制子状态 */
export enum ManualPhase {
  ActionMenu   = 'action_menu',
  MoveSelect   = 'move_select',
  WugongSelect = 'wugong_select',
  TargetSelect = 'target_select',
}

/** 武功类型 */
export enum WugongType {
  Fist = 0,
  Sword = 1,
  Blade = 2,
  Special = 3,
  Neigong = 4,
}

/** 武功定义 */
export interface WugongDef {
  id: string;
  name: string;
  type: WugongType;
  mpCost: number;
  power: number;
  hitRate: number;
  attackRange: number;
  /** 对应 jy-assets/13_eft/{effectId} 特效贴图 */
  effectId: string;
  /** 范围攻击尺寸 (1=单体, 3=3x3 范围) */
  aoeSize?: number;
}

/** 战斗角色 */
export interface BattlePerson {
  id: string;
  name: string;
  team: 'red' | 'blue';
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  moveRange: number;
  wugong: WugongDef;
  pos: { x: number; y: number };
  facing: Direction;
  alive: boolean;
}

/** 战斗行动 */
export type BattleAction =
  | { type: 'move'; target: { x: number; y: number } }
  | { type: 'attack'; skill: WugongDef; targetId: string };

/** 战斗结果 */
export interface BattleResult {
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  rounds: number;
}
