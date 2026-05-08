export type BattleCharacterVisualId = 'player3' | 'digital_master';
export type BattleCharacterStance = 'idle' | 'attack' | 'hit' | 'defense';

export interface BattleImageAsset {
  key: string;
  src: string;
}

export interface BattleActionAnimationDef {
  stance: BattleCharacterStance;
  frameRoot: string;
  frameCount: number;
  frameIntervalMs: number;
}

export interface BattleCharacterVisualDef {
  id: BattleCharacterVisualId;
  texturePrefix: string;
  actionRoot: string;
  animations?: BattleActionAnimationDef[];
}

export const BATTLE_CHARACTER_VISUALS: BattleCharacterVisualDef[] = [
  {
    id: 'player3',
    texturePrefix: 'battle_character_player3',
    actionRoot: 'assets/characters/player3/battle/actions/cutout',
    animations: [
      {
        stance: 'attack',
        frameRoot: 'assets/characters/player3/battle/actions/cutout/attack_frames',
        frameCount: 7,
        frameIntervalMs: 140,
      },
    ],
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
  return BATTLE_CHARACTER_VISUALS.flatMap(visual => [
    ...BATTLE_CHARACTER_STANCES.map(stance => ({
      key: `${visual.texturePrefix}_${stance}`,
      src: `${visual.actionRoot}/${stance}.png?v=1`,
    })),
    ...(visual.animations ?? []).flatMap(animation =>
      Array.from({ length: animation.frameCount }, (_, index) => ({
        key: getBattleCharacterAnimationFrameKey(visual, animation.stance, index),
        src: `${animation.frameRoot}/${String(index).padStart(3, '0')}.png?v=1`,
      })),
    ),
  ]);
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

export function getBattleCharacterAnimation(
  actorId: string,
  stance: BattleCharacterStance,
): { frameKeys: string[]; frameIntervalMs: number } | null {
  const visual = getBattleCharacterVisualForActor(actorId);
  const animation = visual?.animations?.find(item => item.stance === stance);
  if (!visual || !animation) return null;

  return {
    frameKeys: Array.from({ length: animation.frameCount }, (_, index) =>
      getBattleCharacterAnimationFrameKey(visual, stance, index),
    ),
    frameIntervalMs: animation.frameIntervalMs,
  };
}

function getBattleCharacterAnimationFrameKey(
  visual: BattleCharacterVisualDef,
  stance: BattleCharacterStance,
  index: number,
): string {
  return `${visual.texturePrefix}_${stance}_frame_${String(index).padStart(3, '0')}`;
}

function resolveBattleCharacterVisualId(actorId: string): BattleCharacterVisualId | null {
  if (actorId === 'player') return 'player3';
  if (actorId === 'digital_master') return 'digital_master';
  return null;
}
