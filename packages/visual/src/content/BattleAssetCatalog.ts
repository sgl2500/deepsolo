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
    key: 'battle_effect_martial_fist_impact',
    src: 'assets/battle/shared/effects/martial/codex/fist_impact.png?v=1',
  },
  {
    key: 'battle_effect_martial_fist_shadow',
    src: 'assets/battle/shared/effects/martial/codex/fist_shadow.png?v=1',
  },
  {
    key: 'battle_effect_martial_taiji_circle',
    src: 'assets/battle/shared/effects/martial/codex/taiji_circle.png?v=1',
  },
  {
    key: 'battle_effect_martial_leg_heavy',
    src: 'assets/battle/shared/effects/martial/codex/leg_heavy.png?v=1',
  },
  {
    key: 'battle_effect_martial_leg_shadow',
    src: 'assets/battle/shared/effects/martial/codex/leg_shadow.png?v=1',
  },
  {
    key: 'battle_effect_martial_sword_breeze',
    src: 'assets/battle/shared/effects/martial/codex/sword_breeze.png?v=1',
  },
  {
    key: 'battle_effect_martial_dugu_sword',
    src: 'assets/battle/shared/effects/martial/codex/dugu_sword.png?v=1',
  },
  {
    key: 'battle_effect_martial_gale_blade',
    src: 'assets/battle/shared/effects/martial/codex/gale_blade.png?v=1',
  },
  {
    key: 'battle_effect_martial_xueyin_blade',
    src: 'assets/battle/shared/effects/martial/codex/xueyin_blade.png?v=1',
  },
  {
    key: 'battle_effect_martial_inner_breath',
    src: 'assets/battle/shared/effects/martial/codex/inner_breath.png?v=1',
  },
  {
    key: 'battle_effect_martial_golden_bell',
    src: 'assets/battle/shared/effects/martial/codex/golden_bell.png?v=1',
  },
  {
    key: 'battle_effect_martial_taishan_pressure',
    src: 'assets/battle/shared/effects/martial/codex/taishan_pressure.png?v=1',
  },
  {
    key: 'battle_effect_hit_burst',
    src: 'assets/battle/shared/effects/common/hit_burst.png?v=1',
  },
];
