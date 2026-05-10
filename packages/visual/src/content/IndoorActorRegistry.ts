import { Direction, type NPCDef, type Strategy } from '../types';
import { getIndoorCharacterDefs, type IndoorCharacterDef } from './IndoorCharacterLayout';
import type { StrategyNpcSlot } from './StrategyNpcPlacement';
import { getStrategyNpcVisual } from './StrategyNpcVisuals';
import type { IndoorActorDef } from './IndoorActorTypes';

const DEFAULT_STRATEGY_NPC_COLLIDER_RADIUS = 0.55;
const DEFAULT_STORY_NPC_COLLIDER_RADIUS = 0.5;

export function createStrategyNpcIndoorActor(
  buildingId: string,
  strategy: Strategy,
  slot: StrategyNpcSlot,
): IndoorActorDef {
  return {
    id: `strategy_${strategy.id}`,
    sourceId: strategy.id,
    buildingId,
    kind: 'strategy_npc',
    name: strategy.name,
    position: {
      x: slot.mapX,
      y: slot.mapY,
      direction: slot.direction,
    },
    visual: getStrategyNpcVisual(strategy),
    collider: {
      type: 'circle',
      radius: DEFAULT_STRATEGY_NPC_COLLIDER_RADIUS,
    },
    interactions: ['chat', 'gift', 'battle', 'profile'],
  };
}

export function getIndoorActorCollisionRadius(actor: IndoorActorDef): number | undefined {
  return actor.collider?.type === 'circle' ? actor.collider.radius : undefined;
}

export function getIndoorActorCollisionBounds(
  actor: IndoorActorDef,
): { x: number; y: number; radius?: number; width?: number; height?: number } {
  if (actor.collider?.type === 'rect') {
    return {
      x: actor.position.x + (actor.collider.offsetX ?? 0),
      y: actor.position.y + (actor.collider.offsetY ?? 0),
      width: actor.collider.width,
      height: actor.collider.height,
    };
  }
  return {
    x: actor.position.x,
    y: actor.position.y,
    radius: actor.collider?.type === 'circle' ? actor.collider.radius : DEFAULT_STRATEGY_NPC_COLLIDER_RADIUS,
  };
}

export function createStoryNpcIndoorActor(npc: NPCDef): IndoorActorDef {
  const isAtlasCharacter = npc.charKey === 'player' || npc.charKey.startsWith('char_');
  return {
    id: npc.id,
    sourceId: npc.id,
    buildingId: npc.mapId,
    kind: 'story_npc',
    name: npc.name,
    position: {
      x: npc.mapX,
      y: npc.mapY,
      direction: npc.defaultDir,
    },
    visual: isAtlasCharacter
      ? {
          kind: 'chars_atlas',
          charKey: npc.charKey,
          scale: npc.scale ?? 0.78,
          offsetY: npc.pixelOffsetY ?? 0,
        }
      : {
          kind: 'static_texture',
          textureKey: npc.charKey,
          scale: npc.scale ?? (npc.charKey.startsWith('smap_') ? 2.2 : 0.54),
          offsetY: npc.pixelOffsetY ?? 0,
        },
    collider: {
      type: 'circle',
      radius: DEFAULT_STORY_NPC_COLLIDER_RADIUS,
    },
    interactions: ['dialogue', 'gift'],
  };
}

export function createStaticIndoorCharacterActor(character: IndoorCharacterDef): IndoorActorDef {
  const width = character.collider
    ? Math.max(0.1, character.collider.maxLocalX - character.collider.minLocalX)
    : 1.1;
  const height = character.collider
    ? Math.max(0.1, character.collider.maxLocalY - character.collider.minLocalY)
    : 1.1;
  const offsetX = character.collider
    ? (character.collider.minLocalX + character.collider.maxLocalX) / 2 - character.localX
    : 0;
  const offsetY = character.collider
    ? (character.collider.minLocalY + character.collider.maxLocalY) / 2 - character.localY
    : 0;

  return {
    id: character.id,
    sourceId: character.id,
    buildingId: character.buildingId,
    kind: 'decorative_character',
    name: character.id,
    position: {
      x: character.localX,
      y: character.localY,
      direction: Direction.Down,
    },
    visual: {
      kind: 'static_texture',
      textureKey: character.textureKey,
      scale: character.scale ?? 1,
      offsetY: character.pixelOffsetY ?? 0,
    },
    collider: {
      type: 'rect',
      width,
      height,
      offsetX,
      offsetY,
    },
    interactions: [],
  };
}

export function getStaticIndoorCharacterActors(buildingId: string): IndoorActorDef[] {
  return getIndoorCharacterDefs(buildingId).map(createStaticIndoorCharacterActor);
}
