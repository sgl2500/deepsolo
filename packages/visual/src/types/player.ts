export interface PlayerVitals {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export interface PlayerIdentity {
  name: string;
  title?: string;
}

export interface PlayerAttributes {
  attack: number;
  defense: number;
  speed: number;
  understanding: number;
  fortune: number;
}

export interface PlayerInventoryStack {
  itemId: string;
  count: number;
  acquiredAt?: number;
}

export interface PlayerManualProgress {
  manualId: string;
  learned: boolean;
  progress: number;
}

export interface PlayerMartialProgress {
  martialId: string;
  level: number;
  exp: number;
  totalUses: number;
  hitCount: number;
  whiffCount: number;
  stack: number;
}

export interface PlayerEquipment {
  weapon?: string;
  armor?: string;
  accessory?: string;
}

export interface PlayerCurrencies {
  yuanbao: number;
}

export interface PlayerNpcAffinity {
  npcId: string;
  favor: number;
  giftedYuanbaoTotal: number;
  giftCount: number;
  lastGiftAt?: number;
  stage?: number;
}

export interface PlayerProgress {
  version: number;
  identity: PlayerIdentity;
  vitals: PlayerVitals;
  attributes: PlayerAttributes;
  currencies: PlayerCurrencies;
  npcAffinities: Record<string, PlayerNpcAffinity>;
  inventory: PlayerInventoryStack[];
  manuals: PlayerManualProgress[];
  martials: PlayerMartialProgress[];
  equipment: PlayerEquipment;
  flags: Record<string, boolean>;
}
