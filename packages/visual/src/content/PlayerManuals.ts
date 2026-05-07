import type { PlayerAttributes, PlayerVitals } from '../types';

export interface PlayerManualDef {
  id: string;
  name: string;
  itemId: string;
  description: string;
  attributeBonus?: Partial<PlayerAttributes>;
  vitalsBonus?: Partial<Pick<PlayerVitals, 'maxHp' | 'maxMp'>>;
}

export const PLAYER_MANUALS: Record<string, PlayerManualDef> = {
  manual_tuna_intro: {
    id: 'manual_tuna_intro',
    name: '吐纳入门',
    itemId: 'manual_tuna_intro',
    description: '基础调息秘籍。研读后可为后续内功体系打底。',
    vitalsBonus: { maxMp: 10 },
  },
  manual_digital_fumo_intro: {
    id: 'manual_digital_fumo_intro',
    name: '金刚伏魔入门',
    itemId: 'manual_digital_fumo_intro',
    description: '数字掌门传下的实盘护体心法。研读后可提升防御与内力上限。',
    attributeBonus: { defense: 2, understanding: 1 },
    vitalsBonus: { maxMp: 20 },
  },
  manual_strategy_deduction_notes: {
    id: 'manual_strategy_deduction_notes',
    name: '实盘推演札记',
    itemId: 'manual_strategy_deduction_notes',
    description: '记录实盘复盘、回撤控制与行情心跳的策略札记。研读后可提升悟性与内力上限。',
    attributeBonus: { understanding: 2 },
    vitalsBonus: { maxMp: 15 },
  },
};

export function getPlayerManualDef(manualId: string): PlayerManualDef | undefined {
  return PLAYER_MANUALS[manualId];
}

export function getPlayerManualDefByItemId(itemId: string): PlayerManualDef | undefined {
  return Object.values(PLAYER_MANUALS).find((manual) => manual.itemId === itemId);
}
