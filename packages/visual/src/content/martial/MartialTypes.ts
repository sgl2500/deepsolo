import type { PlayerAttributes } from '../../types';

export type MartialCategory = 'fist' | 'leg' | 'sword' | 'blade' | 'inner' | 'ultimate';
export type MartialRole = 'attack' | 'inner' | 'defense' | 'support' | 'ultimate';
export type MartialMasteryStage = 1 | 2 | 3 | 4 | 5;
export type MartialBattleMode = 'tactical' | 'horizontal';
export type MartialHorizontalPresentation = 'melee' | 'ranged' | 'self';
export type MartialTacticalShape = 'single' | 'cross' | 'line' | 'diamond' | 'circle';
export type MartialEffectAnchor = 'attacker' | 'target' | 'self' | 'area';

export interface MartialCombatDef {
  mpCost: number;
  basePower: number;
  powerGrowth: number;
  hitRate: number;
  target: 'enemy' | 'self';
}

export interface MartialTacticalDef {
  range: number;
  aoeSize: number;
  shape: MartialTacticalShape;
}

export interface MartialHorizontalDef {
  presentation: MartialHorizontalPresentation;
  spineAction?: string;
  hitDelayMs?: number;
}

export interface MartialUnlockDef {
  manualIds?: string[];
  storyFlags?: string[];
  npcIds?: string[];
  requiredMartials?: Array<{ martialId: string; level: number }>;
  requiredAttributes?: Partial<PlayerAttributes>;
}

export interface MartialProgressionDef {
  maxLevel: number;
  expCurve: 'linear' | 'rare' | 'ultimate';
  hitExp: number;
  missExp: number;
}

export interface MartialArtDef {
  id: string;
  name: string;
  category: MartialCategory;
  tier: 1 | 2 | 3 | 4 | 5;
  role: MartialRole;
  description: string;
  flavor: string;
  unlock?: MartialUnlockDef;
  progression: MartialProgressionDef;
  combat: MartialCombatDef;
  tactical: MartialTacticalDef;
  horizontal: MartialHorizontalDef;
}

export interface MartialEffectStageDef {
  stage: MartialMasteryStage;
  minLevel: number;
  variant: string;
  label: string;
  scale: number;
  alpha: number;
  durationMs: number;
  particleLevel: number;
  cameraShake: number;
  hitBurstScale: number;
  extraLayer?: string;
  castText?: string;
}

export interface MartialEffectDef {
  effectId: string;
  resourceKey: string | null;
  tacticalEffectId: string;
  anchor: MartialEffectAnchor;
  width: number;
  height: number;
  stages: MartialEffectStageDef[];
}

export interface ResolvedMartialEffect {
  martialId: string;
  effectId: string;
  stage: MartialMasteryStage;
  variant: string;
  label: string;
  resourceKey: string | null;
  tacticalEffectId: string;
  anchor: MartialEffectAnchor;
  width: number;
  height: number;
  scale: number;
  alpha: number;
  durationMs: number;
  particleLevel: number;
  cameraShake: number;
  hitBurstScale: number;
  extraLayer?: string;
  castText?: string;
}
