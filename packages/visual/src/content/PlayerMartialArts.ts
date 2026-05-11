import type { PlayerAttributes } from '../types';
import { getAllMartialArtDefs, MARTIAL_CATEGORY_LABELS } from './martial/MartialCodex';
import type { MartialCategory } from './martial/MartialTypes';

export type MartialArtCategory = MartialCategory | 'basic';

export const MARTIAL_LEVEL_MAX = 10;

export interface PlayerMartialArtDef {
  id: string;
  name: string;
  category: MartialArtCategory;
  description: string;
  requiredManualId?: string;
  requiredAttributes?: Partial<PlayerAttributes>;
  innate?: boolean;
  effectText: string;
}

const BASIC_ATTACK: PlayerMartialArtDef = {
  id: 'basic_attack',
  name: '普通攻击',
  category: 'basic',
  innate: true,
  description: '最基础的出手方式，不成套路，却是所有战斗的起点。',
  effectText: '无需秘籍，玩家默认掌握；作为战斗兜底动作。',
};

export const PLAYER_MARTIAL_ARTS: PlayerMartialArtDef[] = [
  BASIC_ATTACK,
  ...getAllMartialArtDefs().map((art) => ({
    id: art.id,
    name: art.name,
    category: art.category,
    requiredManualId: art.unlock?.manualIds?.[0],
    requiredAttributes: art.unlock?.requiredAttributes,
    description: art.description,
    effectText: `${art.flavor} 熟练度越高，特效完成度越高。`,
  })),
];

export function getMartialCategoryLabel(category: MartialArtCategory): string {
  if (category === 'basic') return '普通';
  return MARTIAL_CATEGORY_LABELS[category] ?? '武功';
}

export function getMartialRequiredExp(level: number): number {
  if (level >= MARTIAL_LEVEL_MAX) return 0;
  return Math.max(10, level * 10);
}

export function getMartialPowerMultiplier(level: number, stack = 0): number {
  return 1 + (Math.max(1, level) - 1) * 0.08 + Math.max(0, stack) * 0.05;
}
