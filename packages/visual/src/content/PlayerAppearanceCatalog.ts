import { Direction } from '../types';

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
  originX: number;
  originY: number;
  worldOffsetY: number;
  indoorOffsetY: number;
  previewFrame?: number;
};

export const DEFAULT_PLAYER_APPEARANCE_ID = 'observer_robed';

export const PLAYER_APPEARANCES: PlayerAppearanceDef[] = [
  {
    id: 'observer_robed',
    name: '观察者道袍',
    description: '当前默认主角形象，小体型武侠行走帧。',
    textureKey: 'player_walk',
    src: 'assets/characters/player/player_walk1.png',
    frameWidth: 28,
    frameHeight: 45,
    frameCount: 7,
    directionRows: {
      [Direction.Up]: 0,
      [Direction.Right]: 1,
      [Direction.Left]: 2,
      [Direction.Down]: 3,
    },
    scale: 3,
    originX: 0.5,
    originY: 1,
    worldOffsetY: 14,
    indoorOffsetY: 0,
    previewFrame: 21,
  },
  {
    id: 'lpc_swordsman',
    name: 'LPC 游侠',
    description: '64x64 通用四方向行走帧，适合后续扩展换装。',
    textureKey: 'lpc_e2',
    src: 'assets/characters/lpc/char01-walk-4dir.png',
    frameWidth: 64,
    frameHeight: 64,
    frameCount: 8,
    directionRows: {
      [Direction.Up]: 3,
      [Direction.Right]: 2,
      [Direction.Left]: 1,
      [Direction.Down]: 0,
    },
    scale: 1.95,
    originX: 0.5,
    originY: 0.92,
    worldOffsetY: 12,
    indoorOffsetY: 0,
    previewFrame: 0,
  },
  {
    id: 'player2_daoshi',
    name: '青袍道长',
    description: 'player2 目录新增道长行走图，四方向七帧。',
    textureKey: 'player2_daoshi_walk',
    src: 'assets/characters/player2/道长行走图.png',
    frameWidth: 45,
    frameHeight: 80,
    frameCount: 7,
    directionRows: {
      [Direction.Up]: 0,
      [Direction.Right]: 3,
      [Direction.Left]: 2,
      [Direction.Down]: 1,
    },
    scale: 1.75,
    originX: 0.5,
    originY: 0.95,
    worldOffsetY: 10,
    indoorOffsetY: 0,
    previewFrame: 7,
  },
  {
    id: 'player3_white_swordsman',
    name: '白衣少侠',
    description: 'player3 十二张单帧合成，四方向三帧行走。',
    textureKey: 'player3_white_swordsman_walk',
    src: 'assets/characters/player3/player3_walk.png',
    frameWidth: 22,
    frameHeight: 50,
    frameCount: 3,
    frameSequence: [0, 1, 0, 2],
    directionRows: {
      [Direction.Up]: 1,
      [Direction.Right]: 3,
      [Direction.Left]: 2,
      [Direction.Down]: 0,
    },
    scale: 2.6,
    originX: 0.5,
    originY: 0.95,
    worldOffsetY: 10,
    indoorOffsetY: 0,
    previewFrame: 0,
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
