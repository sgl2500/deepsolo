export type BattleCharacterVisualId = 'player3' | 'digital_master' | 'digital_elder';
export type BattleCharacterStance = 'idle' | 'run' | 'attack' | 'hit' | 'defense' | 'dead';

export interface BattleImageAsset {
  key: string;
  src: string;
}

export const BATTLE_CHARACTER_STANCES: BattleCharacterStance[] = ['idle', 'run', 'attack', 'hit', 'defense', 'dead'];

export const BATTLE_BACKGROUND_ASSETS: BattleImageAsset[] = [
  {
    key: 'battle_background_digital_sect_duel',
    src: 'assets/battle/backgrounds/digital_sect/digital_sect_duel.png?v=2',
  },
];

export const BATTLE_EFFECT_ASSETS: BattleImageAsset[] = [
  {
    key: 'battle_effect_strategy_projectile',
    src: 'assets/battle/shared/effects/strategy/projectile.png?v=1',
  },
  {
    key: 'battle_effect_strategy_shield',
    src: 'assets/battle/shared/effects/strategy/shield.png?v=1',
  },
  {
    key: 'battle_effect_martial_palm',
    src: 'assets/battle/shared/effects/martial/palm.png?v=1',
  },
  {
    key: 'battle_effect_martial_flame_palm',
    src: 'assets/battle/shared/effects/martial/flame_palm.png?v=1',
  },
  {
    key: 'battle_effect_hit_burst',
    src: 'assets/battle/shared/effects/common/hit_burst.png?v=1',
  },
];
