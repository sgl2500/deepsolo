import { LS_KEY_FURNITURE_EDITOR_LAYOUTS, LS_KEY_INDOOR_CHARACTER_EDITOR_LAYOUTS, LS_KEY_INTERACTABLE_EDITOR_LAYOUTS } from '../../config';
import type { IndoorInteractableDef, IndoorInteractableZone } from '../../types';
import { addIndoorCharacterDef, getIndoorCharacterDefs, removeIndoorCharacterDefs, type IndoorCharacterDef } from '../../content/IndoorCharacterLayout';
import { addIndoorFurnitureDef, getIndoorFurnitureDefs, removeIndoorFurnitureDefs, type IndoorFurnitureDef } from '../../content/IndoorFurnitureLayout';
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
  version: 1 | 2;
  buildingId: string;
  savedAt: number;
  replaceMissing?: boolean;
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

export type IndoorCharacterEditorSnapshotItem = {
  id: string;
  textureKey?: string;
  localX: number;
  localY: number;
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
  depthLocalX?: number;
  depthLocalY?: number;
  depthBias?: number;
  collider?: IndoorCharacterDef['collider'];
};

type IndoorCharacterEditorStoragePayload = {
  version: 1 | 2;
  buildingId: string;
  savedAt: number;
  replaceMissing?: boolean;
  items: IndoorCharacterEditorSnapshotItem[];
};

export type LoadedEditorSnapshot<T> = {
  items: T[];
  replaceMissing: boolean;
  savedAt: number;
};

export function getFurnitureEditorStorageKey(buildingId: string): string {
  return `${LS_KEY_FURNITURE_EDITOR_LAYOUTS}:${buildingId}`;
}

export function getInteractableEditorStorageKey(buildingId: string): string {
  return `${LS_KEY_INTERACTABLE_EDITOR_LAYOUTS}:${buildingId}`;
}

export function getIndoorCharacterEditorStorageKey(buildingId: string): string {
  return `${LS_KEY_INDOOR_CHARACTER_EDITOR_LAYOUTS}:${buildingId}`;
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

export function applyFurnitureEditorSnapshot(
  buildingId: string,
  items: FurnitureEditorSnapshotItem[],
  options: { replaceMissing?: boolean } = {},
): void {
  if (options.replaceMissing) {
    const savedIds = new Set(items.map((item) => item.id));
    removeIndoorFurnitureDefs(buildingId, (item) => !savedIds.has(item.id));
  }
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
  return loadFurnitureEditorSnapshotPayload(buildingId)?.items ?? null;
}

export function loadFurnitureEditorSnapshotPayload(
  buildingId: string,
): LoadedEditorSnapshot<FurnitureEditorSnapshotItem> | null {
  const raw = localStorage.getItem(getFurnitureEditorStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<FurnitureEditorStoragePayload>;
  if (
    (payload.version !== 1 && payload.version !== 2) ||
    payload.buildingId !== buildingId ||
    !Array.isArray(payload.items)
  ) return null;
  return {
    items: payload.items,
    replaceMissing: payload.version >= 2 && payload.replaceMissing === true,
    savedAt: typeof payload.savedAt === 'number' && Number.isFinite(payload.savedAt) ? payload.savedAt : 0,
  };
}

export function saveFurnitureEditorSnapshot(buildingId: string, items: FurnitureEditorSnapshotItem[]): void {
  const payload: FurnitureEditorStoragePayload = {
    version: 2,
    buildingId,
    savedAt: Date.now(),
    replaceMissing: true,
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
  return loadInteractableEditorSnapshotPayload(buildingId)?.items ?? null;
}

export function loadInteractableEditorSnapshotPayload(
  buildingId: string,
): LoadedEditorSnapshot<InteractableEditorSnapshotItem> | null {
  const raw = localStorage.getItem(getInteractableEditorStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<InteractableEditorStoragePayload>;
  if (payload.version !== 1 || payload.buildingId !== buildingId || !Array.isArray(payload.items)) return null;
  return {
    items: payload.items,
    replaceMissing: false,
    savedAt: typeof payload.savedAt === 'number' && Number.isFinite(payload.savedAt) ? payload.savedAt : 0,
  };
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

export function createIndoorCharacterEditorSnapshot(buildingId: string): IndoorCharacterEditorSnapshotItem[] {
  return getIndoorCharacterDefs(buildingId).map((item) => ({
    id: item.id,
    textureKey: item.textureKey,
    localX: item.localX,
    localY: item.localY,
    scale: item.scale,
    alpha: item.alpha,
    originX: item.originX,
    originY: item.originY,
    pixelOffsetX: item.pixelOffsetX,
    pixelOffsetY: item.pixelOffsetY,
    depthLocalX: item.depthLocalX,
    depthLocalY: item.depthLocalY,
    depthBias: item.depthBias,
    collider: item.collider ? { ...item.collider } : undefined,
  }));
}

export function applyIndoorCharacterEditorSnapshot(
  buildingId: string,
  items: IndoorCharacterEditorSnapshotItem[],
  options: { replaceMissing?: boolean } = {},
): void {
  if (options.replaceMissing) {
    const savedIds = new Set(items.map((item) => item.id));
    removeIndoorCharacterDefs(buildingId, (item) => !savedIds.has(item.id));
  }
  const characterById = new Map(getIndoorCharacterDefs(buildingId).map((item) => [item.id, item]));
  for (const saved of items) {
    if (!Number.isFinite(saved.localX) || !Number.isFinite(saved.localY)) continue;
    let target = characterById.get(saved.id);
    if (!target) {
      if (!saved.textureKey) continue;
      target = {
        buildingId,
        id: saved.id,
        textureKey: saved.textureKey,
        localX: saved.localX,
        localY: saved.localY,
      };
      addIndoorCharacterDef(target);
      characterById.set(target.id, target);
    }
    applyIndoorCharacterEditorSnapshotItem(target, saved);
  }
}

export function loadIndoorCharacterEditorSnapshot(buildingId: string): IndoorCharacterEditorSnapshotItem[] | null {
  return loadIndoorCharacterEditorSnapshotPayload(buildingId)?.items ?? null;
}

export function loadIndoorCharacterEditorSnapshotPayload(
  buildingId: string,
): LoadedEditorSnapshot<IndoorCharacterEditorSnapshotItem> | null {
  const raw = localStorage.getItem(getIndoorCharacterEditorStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<IndoorCharacterEditorStoragePayload>;
  if (
    (payload.version !== 1 && payload.version !== 2) ||
    payload.buildingId !== buildingId ||
    !Array.isArray(payload.items)
  ) return null;
  return {
    items: payload.items,
    replaceMissing: payload.version >= 2 && payload.replaceMissing === true,
    savedAt: typeof payload.savedAt === 'number' && Number.isFinite(payload.savedAt) ? payload.savedAt : 0,
  };
}

export function saveIndoorCharacterEditorSnapshot(buildingId: string, items: IndoorCharacterEditorSnapshotItem[]): void {
  const payload: IndoorCharacterEditorStoragePayload = {
    version: 2,
    buildingId,
    savedAt: Date.now(),
    replaceMissing: true,
    items,
  };
  localStorage.setItem(getIndoorCharacterEditorStorageKey(buildingId), JSON.stringify(payload));
}

function applyIndoorCharacterEditorSnapshotItem(
  target: IndoorCharacterDef,
  saved: IndoorCharacterEditorSnapshotItem,
): void {
  target.textureKey = saved.textureKey ?? target.textureKey;
  target.localX = saved.localX;
  target.localY = saved.localY;
  target.scale = optionalNumber(saved.scale);
  target.alpha = optionalNumber(saved.alpha);
  target.originX = optionalNumber(saved.originX);
  target.originY = optionalNumber(saved.originY);
  target.pixelOffsetX = optionalNumber(saved.pixelOffsetX);
  target.pixelOffsetY = optionalNumber(saved.pixelOffsetY);
  target.depthLocalX = optionalNumber(saved.depthLocalX);
  target.depthLocalY = optionalNumber(saved.depthLocalY);
  target.depthBias = optionalNumber(saved.depthBias);
  if ('collider' in saved) target.collider = saved.collider ? { ...saved.collider } : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
