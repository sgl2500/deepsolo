import { ASSET_CATALOG } from '../../content/AssetCatalog';
import { getIndoorCharacterDefs } from '../../content/IndoorCharacterLayout';
import { getIndoorFurnitureDefs, toLocalIndoorMapPosition } from '../../content/IndoorFurnitureLayout';
import { getIndoorInteractables } from '../../content/IndoorInteractables';
import type { IndoorActorColliderDef, IndoorActorDef, IndoorActorVisualDef } from '../../content/IndoorActorTypes';
import type { IndoorFloorTileOverride } from '../../systems/map/IndoorTileEditorPersistence';
import type { IndoorInteractableAction, IndoorInteractableZone } from '../../types';
import type {
  EditableSceneSnapshot,
  PlacedSceneObject,
  SceneCollider,
  SceneInteraction,
} from '../schema/SceneSchema';

const assetIdByTextureKey = new Map(ASSET_CATALOG.map((asset) => [asset.textureKey, asset.id]));
const assetNameByTextureKey = new Map(ASSET_CATALOG.map((asset) => [asset.textureKey, asset.name]));

export function createIndoorEditableSceneSnapshot(
  buildingId: string,
  options: { floorTileOverrides?: IndoorFloorTileOverride[]; indoorActors?: IndoorActorDef[] } = {},
): EditableSceneSnapshot {
  const objects: PlacedSceneObject[] = [
    ...getIndoorFurnitureDefs(buildingId).map((item): PlacedSceneObject => {
      const isWallDecor = item.renderLayer === 'wall';
      return {
        id: item.id,
        sceneId: buildingId,
        sceneType: 'indoor',
        assetId: assetIdByTextureKey.get(item.textureKey),
        kind: isWallDecor ? 'wallDecor' : 'indoorFurniture',
        layer: isWallDecor ? 'wall' : 'object',
        position: { x: item.localX, y: item.localY },
        transform: compactObject({
          scale: item.scale,
          rotation: item.rotation,
          originX: item.originX,
          originY: item.originY,
          alpha: item.alpha,
          pixelOffsetX: item.pixelOffsetX,
          pixelOffsetY: item.pixelOffsetY,
        }),
        depth: {
          mode: isWallDecor ? 'behindActor' : 'ySort',
          point: {
            x: item.depthLocalX ?? item.localX,
            y: item.depthLocalY ?? item.localY,
          },
          bias: item.depthBias,
        },
        collider: item.collider ? rectFromLocalBounds(item.collider) : undefined,
        metadata: compactObject({
          legacyType: 'IndoorFurnitureDef',
          name: assetNameByTextureKey.get(item.textureKey) ?? item.id,
          textureKey: item.textureKey,
          occluderMask: item.occluderMask?.map((point) => ({ ...point })),
        }),
      };
    }),
    ...getIndoorCharacterDefs(buildingId).map((item): PlacedSceneObject => ({
      id: item.id,
      sceneId: buildingId,
      sceneType: 'indoor',
      assetId: assetIdByTextureKey.get(item.textureKey),
      kind: 'indoorCharacter',
      layer: 'character',
      position: { x: item.localX, y: item.localY },
      transform: compactObject({
        scale: item.scale,
        originX: item.originX,
        originY: item.originY,
        alpha: item.alpha,
        pixelOffsetX: item.pixelOffsetX,
        pixelOffsetY: item.pixelOffsetY,
      }),
      depth: {
        mode: 'ySort',
        point: {
          x: item.depthLocalX ?? item.localX,
          y: item.depthLocalY ?? item.localY,
        },
        bias: item.depthBias,
      },
      collider: item.collider ? rectFromLocalBounds(item.collider) : undefined,
      metadata: compactObject({
        legacyType: 'IndoorCharacterDef',
        name: assetNameByTextureKey.get(item.textureKey) ?? item.id,
        textureKey: item.textureKey,
      }),
    })),
    ...getIndoorInteractables(buildingId).map((item): PlacedSceneObject => {
      const localPosition = toLocalIndoorMapPosition(buildingId, item.mapX, item.mapY);
      return {
        id: item.id,
        sceneId: buildingId,
        sceneType: 'indoor',
        kind: 'interactable',
        layer: 'interaction',
        position: { x: localPosition.localX, y: localPosition.localY },
        interaction: createSceneInteraction(item.action, item.interactRadius, item.interactionZone),
        metadata: compactObject({
          legacyType: 'IndoorInteractableDef',
          name: item.name,
          prompt: item.prompt,
          dialogueId: item.dialogueId,
          action: item.action ? { ...item.action } : undefined,
        }),
      };
    }),
    ...(options.indoorActors ?? [])
      .filter((actor) => actor.buildingId === buildingId)
      .map(createIndoorActorSceneObject),
  ];

  return {
    version: 1,
    sceneId: buildingId,
    sceneType: 'indoor',
    templateId: buildingId,
    savedAt: Date.now(),
    objects,
      metadata: {
        source: 'visual-indoor-editor',
        schemaPurpose: 'database-ready-scene-state',
        objectCount: objects.length,
        indoorActorCount: options.indoorActors?.filter((actor) => actor.buildingId === buildingId).length ?? 0,
        floorTileOverrideCount: options.floorTileOverrides?.length ?? 0,
        floorTileOverrides: options.floorTileOverrides?.map((item) => ({ ...item })),
      },
    };
}

function createIndoorActorSceneObject(actor: IndoorActorDef): PlacedSceneObject {
  return {
    id: actor.id,
    sceneId: actor.buildingId,
    sceneType: 'indoor',
    kind: 'indoorActor',
    layer: 'character',
    position: { x: actor.position.x, y: actor.position.y },
    transform: { scale: actor.visual.scale },
    depth: {
      mode: 'ySort',
      point: { x: actor.position.x, y: actor.position.y },
    },
    collider: actor.collider ? sceneColliderFromIndoorActorCollider(actor.collider, actor.position) : undefined,
    interaction: actor.interactions.length > 0
      ? {
          type: actor.interactions.includes('dialogue') || actor.interactions.includes('chat') ? 'dialogue' : 'custom',
          radius: 2,
          targetId: actor.sourceId,
          metadata: { interactions: [...actor.interactions] },
        }
      : undefined,
    locked: true,
    metadata: compactObject({
      legacyType: 'IndoorActorDef',
      actorKind: actor.kind,
      sourceId: actor.sourceId,
      name: actor.name,
      visual: compactIndoorActorVisual(actor.visual),
    }),
  };
}

function sceneColliderFromIndoorActorCollider(
  collider: IndoorActorColliderDef,
  position: { x: number; y: number },
): SceneCollider {
  if (collider.type === 'circle') {
    return {
      type: 'circle',
      x: position.x,
      y: position.y,
      radius: collider.radius,
    };
  }

  return {
    type: 'rect',
    x: position.x + (collider.offsetX ?? 0) - collider.width / 2,
    y: position.y + (collider.offsetY ?? 0) - collider.height / 2,
    width: collider.width,
    height: collider.height,
  };
}

function compactIndoorActorVisual(visual: IndoorActorVisualDef): Record<string, unknown> {
  if (visual.kind === 'spine') {
    return compactObject({
      kind: visual.kind,
      dataKey: visual.dataKey,
      atlasKey: visual.atlasKey,
      scale: visual.scale,
      flipX: visual.flipX,
      offsetY: visual.offsetY,
      defaultAnimation: visual.defaultAnimation,
      fallbackTextureKey: visual.fallbackTextureKey,
    });
  }
  if (visual.kind === 'static_texture') {
    return compactObject({
      kind: visual.kind,
      textureKey: visual.textureKey,
      scale: visual.scale,
      flipX: visual.flipX,
      offsetY: visual.offsetY,
    });
  }
  return compactObject({
    kind: visual.kind,
    charKey: visual.charKey,
    scale: visual.scale,
    flipX: visual.flipX,
    offsetY: visual.offsetY,
  });
}

function rectFromLocalBounds(bounds: {
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
}): SceneCollider {
  return {
    type: 'rect',
    x: bounds.minLocalX,
    y: bounds.minLocalY,
    width: bounds.maxLocalX - bounds.minLocalX,
    height: bounds.maxLocalY - bounds.minLocalY,
  };
}

function createSceneInteraction(
  action: IndoorInteractableAction | undefined,
  radius: number | undefined,
  zone: IndoorInteractableZone | undefined,
): SceneInteraction {
  return compactObject({
    type: mapInteractionType(action?.type),
    radius,
    zone: zone ? rectFromLocalBounds(zone) : undefined,
    targetId: getInteractionTargetId(action),
  }) as SceneInteraction;
}

function mapInteractionType(actionType: IndoorInteractableAction['type'] | undefined): SceneInteraction['type'] {
  if (actionType === 'dialogue') return 'dialogue';
  if (actionType === 'rest') return 'rest';
  return 'custom';
}

function getInteractionTargetId(action: IndoorInteractableAction | undefined): string | undefined {
  if (!action) return undefined;
  if (action.type === 'dialogue') return action.dialogueId;
  if (action.type === 'discover_manual') return action.manualId;
  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
