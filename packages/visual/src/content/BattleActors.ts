import { Direction } from '../types';

export type BattleActorAnimKey = 'idle' | 'attack' | 'walk';
export type BattleActorDirectionKey = 'upRight' | 'downRight' | 'upLeft' | 'downLeft';

export interface BattleActorAnimFrames {
  start: number;
  end: number;
  frameIntervalMs: number;
  loop?: boolean;
}

export interface BattleActorDef {
  id: string;
  texturePrefix: string;
  walkTexturePrefix?: string;
  scale: number;
  originX: number;
  originY: number;
  walkScale?: number;
  walkOriginX?: number;
  walkOriginY?: number;
  animations: {
    idle: Record<BattleActorDirectionKey, BattleActorAnimFrames>;
    attack: Record<BattleActorDirectionKey, BattleActorAnimFrames>;
    walk?: Record<BattleActorDirectionKey, BattleActorAnimFrames>;
  };
}

export const DIRECTION_TO_BATTLE_ACTOR_DIR: Record<number, BattleActorDirectionKey> = {
  [Direction.Up]: 'upRight',
  [Direction.Right]: 'downRight',
  [Direction.Left]: 'upLeft',
  [Direction.Down]: 'downLeft',
};

export const BATTLE_ACTORS: Record<string, BattleActorDef> = {
  fight000: {
    id: 'fight000',
    texturePrefix: 'fight000',
    walkTexturePrefix: 'battle_walk',
    scale: 2,
    originX: 0.5,
    originY: 0.85,
    walkScale: 2.35,
    walkOriginX: 0.5,
    walkOriginY: 0.88,
    animations: {
      idle: {
        upRight: { start: 40, end: 40, frameIntervalMs: 50 },
        downRight: { start: 52, end: 52, frameIntervalMs: 50 },
        upLeft: { start: 64, end: 64, frameIntervalMs: 50 },
        downLeft: { start: 76, end: 76, frameIntervalMs: 50 },
      },
      attack: {
        upRight: { start: 40, end: 51, frameIntervalMs: 50 },
        downRight: { start: 52, end: 63, frameIntervalMs: 50 },
        upLeft: { start: 64, end: 75, frameIntervalMs: 50 },
        downLeft: { start: 76, end: 87, frameIntervalMs: 50 },
      },
      walk: {
        upRight: { start: 2501, end: 2507, frameIntervalMs: 120, loop: true },
        downRight: { start: 2508, end: 2514, frameIntervalMs: 120, loop: true },
        upLeft: { start: 2515, end: 2521, frameIntervalMs: 120, loop: true },
        downLeft: { start: 2522, end: 2528, frameIntervalMs: 120, loop: true },
      },
    },
  },
};

export function getBattleActorDef(actorId = 'fight000'): BattleActorDef {
  return BATTLE_ACTORS[actorId] ?? BATTLE_ACTORS.fight000;
}

export function getBattleActorTextureKey(actor: BattleActorDef, frameIdx: number, texturePrefix = actor.texturePrefix): string {
  return `${texturePrefix}_${String(frameIdx).padStart(4, '0')}`;
}
