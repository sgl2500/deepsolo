import { Direction } from '../types';

export type PlayerIsoFacingKey =
  | 'up'
  | 'upRight'
  | 'right'
  | 'downRight'
  | 'down'
  | 'downLeft'
  | 'left'
  | 'upLeft';

export type PlayerIsoStaticFrameDef = {
  frame: number;
  flipX?: boolean;
};

export type PlayerPseudoWalkDef = {
  stepIntervalMs: number;
  bobHeight: number;
  swayX: number;
  squashY: number;
  shadowWidth: number;
  shadowHeight: number;
  shadowAlpha: number;
  shadowScale: number;
};

export type PlayerAppearanceDef = {
  id: string;
  name: string;
  description: string;
  textureKey: string;
  src: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameSequence?: number[];
  directionRows: Record<Direction, number>;
  scale: number;
  indoorScale: number;
  originX: number;
  originY: number;
  worldOffsetY: number;
  indoorOffsetY: number;
  previewFrame?: number;
  isoStaticFrames?: Record<PlayerIsoFacingKey, PlayerIsoStaticFrameDef>;
  pseudoWalk?: PlayerPseudoWalkDef;
};

export const DEFAULT_PLAYER_APPEARANCE_ID = 'player3_iso_five_view_pseudo_walk';

export const PLAYER_APPEARANCES: PlayerAppearanceDef[] = [
  {
    id: 'player3_iso_five_view_pseudo_walk',
    name: '白衣少侠等距五视图',
    description: '基于 player3 新五视图，使用引擎上下浮动伪行走。',
    textureKey: 'player3_iso_five_view_pseudo_walk',
    src: 'assets/characters/player3/player3_iso_five_view_pseudo_walk.png?v=20260507-new-view',
    frameWidth: 80,
    frameHeight: 160,
    frameCount: 5,
    directionRows: {
      [Direction.Up]: 0,
      [Direction.Right]: 0,
      [Direction.Left]: 0,
      [Direction.Down]: 0,
    },
    scale: 0.95,
    indoorScale: 0.95,
    originX: 0.5,
    originY: 0.972,
    worldOffsetY: 10,
    indoorOffsetY: 0,
    previewFrame: 0,
    isoStaticFrames: {
      down: { frame: 0 },
      downRight: { frame: 1 },
      right: { frame: 2 },
      upRight: { frame: 3, flipX: true },
      up: { frame: 4 },
      downLeft: { frame: 1, flipX: true },
      left: { frame: 2, flipX: true },
      upLeft: { frame: 3 },
    },
    pseudoWalk: {
      stepIntervalMs: 260,
      bobHeight: 4,
      swayX: 1.2,
      squashY: 0.018,
      shadowWidth: 50,
      shadowHeight: 14,
      shadowAlpha: 0.28,
      shadowScale: 0.12,
    },
  },
];

export function getPlayerAppearance(id: string | null | undefined): PlayerAppearanceDef {
  return PLAYER_APPEARANCES.find((item) => item.id === id)
    ?? PLAYER_APPEARANCES.find((item) => item.id === DEFAULT_PLAYER_APPEARANCE_ID)
    ?? PLAYER_APPEARANCES[0];
}

export function getPlayerAppearanceAssets(): PlayerAppearanceDef[] {
  return PLAYER_APPEARANCES;
}
