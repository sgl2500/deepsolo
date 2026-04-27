export type PlayerItemType = 'manual' | 'consumable' | 'quest' | 'material' | 'equipment';

export interface PlayerItemDef {
  id: string;
  name: string;
  type: PlayerItemType;
  description: string;
  stackable: boolean;
  maxStack?: number;
  iconPath?: string;
}

export const PLAYER_ITEMS: Record<string, PlayerItemDef> = {
  manual_tuna_intro: {
    id: 'manual_tuna_intro',
    name: '吐纳入门',
    type: 'manual',
    description: '一本基础内功心法，记载着最朴素的吐纳调息法门。',
    stackable: false,
    iconPath: 'assets/jy-assets/08_thing/0079.png',
  },
};

export function getPlayerItemDef(itemId: string): PlayerItemDef | undefined {
  return PLAYER_ITEMS[itemId];
}
