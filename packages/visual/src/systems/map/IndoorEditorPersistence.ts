import { LS_KEY_FURNITURE_EDITOR_LAYOUTS, LS_KEY_INTERACTABLE_EDITOR_LAYOUTS } from '../../config';
import type { IndoorInteractableDef, IndoorInteractableZone } from '../../types';
import { addIndoorFurnitureDef, getIndoorFurnitureDefs, type IndoorFurnitureDef } from '../../content/IndoorFurnitureLayout';
import { getIndoorInteractables } from '../../content/IndoorInteractables';

export type FurnitureEditorSnapshotItem = {
  id: string;
  textureKey?: string;
  renderLayer?: IndoorFurnitureDef['renderLayer'];
  localX: number;
  localY: number;
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
  rotation?: number;
  depthLocalX?: number;
  depthLocalY?: number;
  depthBias?: number;
  collider?: IndoorFurnitureDef['collider'];
  occluderMask?: IndoorFurnitureDef['occluderMask'];
};

type FurnitureEditorStoragePayload = {
  version: 1;
  buildingId: string;
  savedAt: number;
  items: FurnitureEditorSnapshotItem[];
};

export type InteractableEditorSnapshotItem = {
  id: string;
  mapX: number;
  mapY: number;
  interactRadius?: number;
  interactionZone?: IndoorInteractableZone;
};

type InteractableEditorStoragePayload = {
  version: 1;
  buildingId: string;
  savedAt: number;
  items: InteractableEditorSnapshotItem[];
};

export function getFurnitureEditorStorageKey(buildingId: string): string {
  return `${LS_KEY_FURNITURE_EDITOR_LAYOUTS}:${buildingId}`;
}

export function getInteractableEditorStorageKey(buildingId: string): string {
  return `${LS_KEY_INTERACTABLE_EDITOR_LAYOUTS}:${buildingId}`;
}

export function createFurnitureEditorSnapshot(buildingId: string): FurnitureEditorSnapshotItem[] {
  return getIndoorFurnitureDefs(buildingId).map((item) => ({
    id: item.id,
    textureKey: item.textureKey,
    renderLayer: item.renderLayer,
    localX: item.localX,
    localY: item.localY,
    scale: item.scale,
    alpha: item.alpha,
    originX: item.originX,
    originY: item.originY,
    pixelOffsetX: item.pixelOffsetX,
    pixelOffsetY: item.pixelOffsetY,
    rotation: item.rotation,
    depthLocalX: item.depthLocalX,
    depthLocalY: item.depthLocalY,
    depthBias: item.depthBias,
    collider: item.collider ? { ...item.collider } : undefined,
    occluderMask: item.occluderMask?.map((point) => ({ ...point })),
  }));
}

export function applyFurnitureEditorSnapshot(buildingId: string, items: FurnitureEditorSnapshotItem[]): void {
  const furnitureById = new Map(getIndoorFurnitureDefs(buildingId).map((item) => [item.id, item]));
  for (const saved of items) {
    if (!Number.isFinite(saved.localX) || !Number.isFinite(saved.localY)) continue;

    let target = furnitureById.get(saved.id);
    if (!target) {
      if (!saved.textureKey) continue;
      const template = Array.from(furnitureById.values()).find((item) => item.textureKey === saved.textureKey);
      target = {
        buildingId,
        id: saved.id,
        textureKey: saved.textureKey,
        renderLayer: saved.renderLayer ?? template?.renderLayer,
        localX: saved.localX,
        localY: saved.localY,
      };
      addIndoorFurnitureDef(target);
      furnitureById.set(target.id, target);
    }

    applyFurnitureEditorSnapshotItem(target, saved);
  }
}

function applyFurnitureEditorSnapshotItem(target: IndoorFurnitureDef, saved: FurnitureEditorSnapshotItem): void {
  target.textureKey = saved.textureKey ?? target.textureKey;
  if ('renderLayer' in saved) target.renderLayer = saved.renderLayer;
  target.localX = saved.localX;
  target.localY = saved.localY;
  target.scale = optionalNumber(saved.scale);
  target.alpha = optionalNumber(saved.alpha);
  target.originX = optionalNumber(saved.originX);
  target.originY = optionalNumber(saved.originY);
  target.pixelOffsetX = optionalNumber(saved.pixelOffsetX);
  target.pixelOffsetY = optionalNumber(saved.pixelOffsetY);
  target.rotation = optionalNumber(saved.rotation);
  target.depthLocalX = optionalNumber(saved.depthLocalX);
  target.depthLocalY = optionalNumber(saved.depthLocalY);
  target.depthBias = optionalNumber(saved.depthBias);
  target.collider = saved.collider ? { ...saved.collider } : undefined;
  target.occluderMask = Array.isArray(saved.occluderMask)
    ? saved.occluderMask.map((point) => ({ ...point }))
    : undefined;
}

export function loadFurnitureEditorSnapshot(buildingId: string): FurnitureEditorSnapshotItem[] | null {
  const raw = localStorage.getItem(getFurnitureEditorStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<FurnitureEditorStoragePayload>;
  if (payload.version !== 1 || payload.buildingId !== buildingId || !Array.isArray(payload.items)) return null;
  return payload.items;
}

export function saveFurnitureEditorSnapshot(buildingId: string, items: FurnitureEditorSnapshotItem[]): void {
  const payload: FurnitureEditorStoragePayload = {
    version: 1,
    buildingId,
    savedAt: Date.now(),
    items,
  };
  localStorage.setItem(getFurnitureEditorStorageKey(buildingId), JSON.stringify(payload));
}

export function createInteractableEditorSnapshot(buildingId: string): InteractableEditorSnapshotItem[] {
  return getIndoorInteractables(buildingId).map((item) => ({
    id: item.id,
    mapX: item.mapX,
    mapY: item.mapY,
    interactRadius: item.interactRadius,
    interactionZone: item.interactionZone ? { ...item.interactionZone } : undefined,
  }));
}

export function applyInteractableEditorSnapshot(buildingId: string, items: InteractableEditorSnapshotItem[]): void {
  const interactableById = new Map(getIndoorInteractables(buildingId).map((item) => [item.id, item]));
  for (const saved of items) {
    const target = interactableById.get(saved.id);
    if (!target || !Number.isFinite(saved.mapX) || !Number.isFinite(saved.mapY)) continue;
    target.mapX = saved.mapX;
    target.mapY = saved.mapY;
    target.interactRadius = optionalNumber(saved.interactRadius);
    target.interactionZone = saved.interactionZone ? { ...saved.interactionZone } : undefined;
  }
}

export function loadInteractableEditorSnapshot(buildingId: string): InteractableEditorSnapshotItem[] | null {
  const raw = localStorage.getItem(getInteractableEditorStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<InteractableEditorStoragePayload>;
  if (payload.version !== 1 || payload.buildingId !== buildingId || !Array.isArray(payload.items)) return null;
  return payload.items;
}

export function saveInteractableEditorSnapshot(buildingId: string, items: InteractableEditorSnapshotItem[]): void {
  const payload: InteractableEditorStoragePayload = {
    version: 1,
    buildingId,
    savedAt: Date.now(),
    items,
  };
  localStorage.setItem(getInteractableEditorStorageKey(buildingId), JSON.stringify(payload));
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
