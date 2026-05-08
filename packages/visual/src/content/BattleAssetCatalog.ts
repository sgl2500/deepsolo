export type BattleCharacterVisualId = 'player3' | 'digital_master';
export type BattleCharacterStance = 'idle' | 'attack' | 'hit' | 'defense';

export interface BattleImageAsset {
  key: string;
  src: string;
}

export interface BattleCharacterVisualDef {
  id: BattleCharacterVisualId;
  texturePrefix: string;
  actionRoot: string;
}

export const BATTLE_CHARACTER_VISUALS: BattleCharacterVisualDef[] = [
  {
    id: 'player3',
    texturePrefix: 'battle_character_player3',
    actionRoot: 'assets/characters/player3/battle/actions/cutout',
  },
  {
    id: 'digital_master',
    texturePrefix: 'battle_character_digital_master',
    actionRoot: 'assets/characters/digital_master/battle/actions/cutout',
  },
];

export const BATTLE_CHARACTER_STANCES: BattleCharacterStance[] = ['idle', 'attack', 'hit', 'defense'];

export function getBattleCharacterTextureKey(id: string, stance: BattleCharacterStance): string | null {
  const visual = getBattleCharacterVisualForActor(id);
  if (!visual) return null;
  return `${visual.texturePrefix}_${stance}`;
}

export function getBattleCharacterAssets(): BattleImageAsset[] {
  return BATTLE_CHARACTER_VISUALS.flatMap(visual =>
    BATTLE_CHARACTER_STANCES.map(stance => ({
      key: `${visual.texturePrefix}_${stance}`,
      src: `${visual.actionRoot}/${stance}.png?v=1`,
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
    key: 'battle_effect_hit_burst',
    src: 'assets/battle/shared/effects/common/hit_burst.png?v=1',
  },
];

export function getBattleCharacterVisualForActor(actorId: string): BattleCharacterVisualDef | null {
  const visualId = resolveBattleCharacterVisualId(actorId);
  return BATTLE_CHARACTER_VISUALS.find(visual => visual.id === visualId) ?? null;
}

function resolveBattleCharacterVisualId(actorId: string): BattleCharacterVisualId | null {
  if (actorId === 'player') return 'player3';
  if (actorId === 'digital_master') return 'digital_master';
  return null;
}
