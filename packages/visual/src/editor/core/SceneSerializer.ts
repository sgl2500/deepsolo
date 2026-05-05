import { ASSET_CATALOG } from '../../content/AssetCatalog';
import { getIndoorCharacterDefs } from '../../content/IndoorCharacterLayout';
import { getIndoorFurnitureDefs, toLocalIndoorMapPosition } from '../../content/IndoorFurnitureLayout';
import { getIndoorInteractables } from '../../content/IndoorInteractables';
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
  options: { floorTileOverrides?: IndoorFloorTileOverride[] } = {},
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
        floorTileOverrideCount: options.floorTileOverrides?.length ?? 0,
        floorTileOverrides: options.floorTileOverrides?.map((item) => ({ ...item })),
      },
    };
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
