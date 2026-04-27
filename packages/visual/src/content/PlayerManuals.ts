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
};

export function getPlayerManualDef(manualId: string): PlayerManualDef | undefined {
  return PLAYER_MANUALS[manualId];
}

export function getPlayerManualDefByItemId(itemId: string): PlayerManualDef | undefined {
  return Object.values(PLAYER_MANUALS).find((manual) => manual.itemId === itemId);
}
