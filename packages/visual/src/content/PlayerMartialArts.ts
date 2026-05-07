import type { PlayerAttributes } from '../types';

export type MartialArtCategory = 'inner' | 'fist' | 'sword' | 'blade' | 'lightness';

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

export const PLAYER_MARTIAL_ARTS: PlayerMartialArtDef[] = [
  {
    id: 'basic_attack',
    name: '普通攻击',
    category: 'fist',
    innate: true,
    description: '最基础的出手方式，不成套路，却是所有战斗的起点。',
    effectText: '无需秘籍，玩家默认掌握；后续战斗系统可作为兜底攻击动作。',
  },
  {
    id: 'tuna_qigong',
    name: '吐纳功',
    category: 'inner',
    requiredManualId: 'manual_tuna_intro',
    description: '最基础的调息内功，重在稳住气息、打通入门根基。',
    effectText: '研读后内力上限 +10。',
  },
  {
    id: 'jingang_fumo_intro',
    name: '金刚伏魔入门',
    category: 'inner',
    requiredManualId: 'manual_digital_fumo_intro',
    requiredAttributes: { defense: 10, understanding: 10 },
    description: '数字掌门将实盘风控炼成的护身内功，重在守本金、抗回撤、蓄内力。',
    effectText: '研读后防御 +2、悟性 +1、内力上限 +20。',
  },
];

export function getMartialCategoryLabel(category: MartialArtCategory): string {
  switch (category) {
    case 'inner': return '内功';
    case 'fist': return '拳掌';
    case 'sword': return '剑法';
    case 'blade': return '刀法';
    case 'lightness': return '轻功';
    default: return '武功';
  }
}

export function getMartialRequiredExp(level: number): number {
  if (level >= MARTIAL_LEVEL_MAX) return 0;
  return Math.max(10, level * 10);
}

export function getMartialPowerMultiplier(level: number, stack = 0): number {
  return 1 + (Math.max(1, level) - 1) * 0.08 + Math.max(0, stack) * 0.05;
}
