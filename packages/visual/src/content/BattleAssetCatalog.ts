export type BattleCharacterId = 'player' | 'digital_master';
export type BattleCharacterStance = 'idle' | 'attack' | 'hit' | 'defense';

export interface BattleImageAsset {
  key: string;
  src: string;
}

export const BATTLE_CHARACTER_IDS: BattleCharacterId[] = ['player', 'digital_master'];
export const BATTLE_CHARACTER_STANCES: BattleCharacterStance[] = ['idle', 'attack', 'hit', 'defense'];

export function getBattleCharacterTextureKey(id: string, stance: BattleCharacterStance): string | null {
  if (!isBattleCharacterId(id)) return null;
  return `battle_character_${id}_${stance}`;
}

export function getBattleCharacterAssets(): BattleImageAsset[] {
  return BATTLE_CHARACTER_IDS.flatMap(id =>
    BATTLE_CHARACTER_STANCES.map(stance => ({
      key: `battle_character_${id}_${stance}`,
      src: `assets/battle/characters/${id}/cutout/${stance}.png?v=1`,
    })),
  );
}

export const BATTLE_BACKGROUND_ASSETS: BattleImageAsset[] = [
  {
    key: 'battle_background_digital_sect_duel',
    src: 'assets/battle/backgrounds/digital_sect/digital_sect_duel.png?v=1',
  },
];

export const BATTLE_EFFECT_ASSETS: BattleImageAsset[] = [
  {
    key: 'battle_effect_strategy_projectile',
    src: 'assets/battle/effects/strategy/cutout/projectile.png?v=1',
  },
  {
    key: 'battle_effect_strategy_shield',
    src: 'assets/battle/effects/strategy/cutout/shield.png?v=1',
  },
  {
    key: 'battle_effect_martial_palm',
    src: 'assets/battle/effects/martial/cutout/palm.png?v=1',
  },
  {
    key: 'battle_effect_hit_burst',
    src: 'assets/battle/effects/common/cutout/hit_burst.png?v=1',
  },
];

function isBattleCharacterId(id: string): id is BattleCharacterId {
  return (BATTLE_CHARACTER_IDS as string[]).includes(id);
}
