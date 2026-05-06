import generatedBuildings from './generated_buildings.json';
import { getAsset } from './AssetCatalog';
import type { IndoorFurnitureDef } from './IndoorFurnitureLayout';

const LS_KEY_RUNTIME_WORLD_BUILDINGS = 'deepsolo_runtime_world_buildings';
const LS_KEY_RUNTIME_WORLD_BUILDING_DELETIONS = 'deepsolo_runtime_world_building_deletions';

export type AutomatedWorldBuildingVisual = {
  textureKey?: string;
  file?: string;
  originY?: number;
  offsetY?: number;
  labelY?: number;
  scale?: number;
};

export type AutomatedEditableFloor = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  brushAssetIds?: string[];
  textureKeys?: string[];
  allowErase?: boolean;
  description?: string;
};

export type AutomatedBuildingSpec = {
  id: string;
  name: string;
  entryX: number;
  entryY: number;
  visualX?: number;
  visualY?: number;
  depthX?: number;
  depthY?: number;
  entryRadius?: number;
  collisionRadius?: number;
  collisionPolygon?: Array<{ x: number; y: number }>;
  indoorMapKey?: string;
  spawnX?: number;
  spawnY?: number;
  doorSpawnX?: number;
  doorSpawnY?: number;
  exitX?: number;
  exitY?: number;
  returnX?: number;
  returnY?: number;
  worldVisual?: AutomatedWorldBuildingVisual;
  roomTemplate?: {
    localOrigin?: { x: number; y: number };
    editableFloor?: AutomatedEditableFloor;
  };
  furniture?: Array<Omit<IndoorFurnitureDef, 'buildingId' | 'textureKey'> & {
    assetId?: string;
    textureKey?: string;
  }>;
};

const GENERATED_AUTOMATED_BUILDINGS: AutomatedBuildingSpec[] = (generatedBuildings as AutomatedBuildingSpec[])
  .filter((building) => (
    typeof building.id === 'string' &&
    building.id.length > 0 &&
    typeof building.name === 'string' &&
    Number.isFinite(building.entryX) &&
    Number.isFinite(building.entryY)
  ));

let runtimeAutomatedBuildings: AutomatedBuildingSpec[] = loadRuntimeAutomatedBuildings();
let runtimeDeletedAutomatedBuildingIds: string[] = loadRuntimeDeletedAutomatedBuildingIds();

export const AUTOMATED_BUILDINGS: AutomatedBuildingSpec[] = getAutomatedBuildings();

export function getAutomatedBuildings(): AutomatedBuildingSpec[] {
  const deletedIds = new Set(runtimeDeletedAutomatedBuildingIds);
  const byId = new Map<string, AutomatedBuildingSpec>();
  for (const building of GENERATED_AUTOMATED_BUILDINGS) {
    if (!deletedIds.has(building.id)) byId.set(building.id, building);
  }
  for (const building of runtimeAutomatedBuildings) {
    if (!deletedIds.has(building.id)) byId.set(building.id, building);
  }
  return Array.from(byId.values());
}

export function addRuntimeAutomatedBuilding(building: AutomatedBuildingSpec): void {
  runtimeDeletedAutomatedBuildingIds = runtimeDeletedAutomatedBuildingIds.filter((id) => id !== building.id);
  const existingIndex = runtimeAutomatedBuildings.findIndex((item) => item.id === building.id);
  if (existingIndex >= 0) runtimeAutomatedBuildings[existingIndex] = building;
  else runtimeAutomatedBuildings.push(building);
  saveRuntimeAutomatedBuildings();
  saveRuntimeDeletedAutomatedBuildingIds();
}

export function removeRuntimeAutomatedBuilding(id: string): boolean {
  const hadRuntime = runtimeAutomatedBuildings.some((building) => building.id === id);
  const hadGenerated = GENERATED_AUTOMATED_BUILDINGS.some((building) => building.id === id);
  if (!hadRuntime && !hadGenerated) return false;

  runtimeAutomatedBuildings = runtimeAutomatedBuildings.filter((building) => building.id !== id);
  if (hadGenerated && !runtimeDeletedAutomatedBuildingIds.includes(id)) {
    runtimeDeletedAutomatedBuildingIds.push(id);
  }
  saveRuntimeAutomatedBuildings();
  saveRuntimeDeletedAutomatedBuildingIds();
  return true;
}

export function getAutomatedWorldBuildingVisuals(): Record<string, Required<Pick<AutomatedWorldBuildingVisual, 'textureKey' | 'originY' | 'offsetY' | 'labelY'>> & { scale?: number }> {
  return Object.fromEntries(getAutomatedBuildings().map((building) => {
    const visual = building.worldVisual ?? {};
    return [
      building.id,
      {
        textureKey: visual.textureKey ?? 'world_building_a_share',
        originY: visual.originY ?? 0.9,
        offsetY: visual.offsetY ?? 0,
        labelY: visual.labelY ?? -156,
        scale: visual.scale,
      },
    ];
  }));
}

export function getAutomatedWorldBuildingAssets(): Array<{ key: string; file: string }> {
  return getAutomatedBuildings()
    .map((building) => building.worldVisual)
    .filter((visual): visual is AutomatedWorldBuildingVisual & { textureKey: string; file: string } => (
      !!visual?.textureKey && !!visual.file
    ))
    .map((visual) => ({ key: visual.textureKey, file: visual.file }));
}

export function getAutomatedIndoorFurnitureDefs(buildingId?: string): IndoorFurnitureDef[] {
  return getAutomatedBuildings()
    .filter((building) => !buildingId || building.id === buildingId)
    .flatMap((building) => (
    (building.furniture ?? []).flatMap((item): IndoorFurnitureDef[] => {
      const textureKey = item.textureKey ?? (item.assetId ? getAsset(item.assetId)?.textureKey : undefined);
      if (!textureKey) return [];
      return [{
        ...item,
        buildingId: building.id,
        textureKey,
      }];
    })
  ));
}

function loadRuntimeAutomatedBuildings(): AutomatedBuildingSpec[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LS_KEY_RUNTIME_WORLD_BUILDINGS);
    if (!raw) return [];
    const payload = JSON.parse(raw) as { version?: number; items?: AutomatedBuildingSpec[] };
    if (payload.version !== 1 || !Array.isArray(payload.items)) return [];
    return payload.items.filter((building) => (
      typeof building.id === 'string' &&
      building.id.length > 0 &&
      typeof building.name === 'string' &&
      Number.isFinite(building.entryX) &&
      Number.isFinite(building.entryY)
    ));
  } catch (error) {
    console.warn('[AutomatedBuildingRegistry] Failed to load runtime buildings:', error);
    return [];
  }
}

function loadRuntimeDeletedAutomatedBuildingIds(): string[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LS_KEY_RUNTIME_WORLD_BUILDING_DELETIONS);
    if (!raw) return [];
    const payload = JSON.parse(raw) as { version?: number; ids?: string[] };
    if (payload.version !== 1 || !Array.isArray(payload.ids)) return [];
    return payload.ids.filter((id) => typeof id === 'string' && id.length > 0);
  } catch (error) {
    console.warn('[AutomatedBuildingRegistry] Failed to load runtime deleted buildings:', error);
    return [];
  }
}

function saveRuntimeAutomatedBuildings(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(LS_KEY_RUNTIME_WORLD_BUILDINGS, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    items: runtimeAutomatedBuildings,
  }));
}

function saveRuntimeDeletedAutomatedBuildingIds(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  if (runtimeDeletedAutomatedBuildingIds.length === 0) {
    storage.removeItem(LS_KEY_RUNTIME_WORLD_BUILDING_DELETIONS);
    return;
  }
  storage.setItem(LS_KEY_RUNTIME_WORLD_BUILDING_DELETIONS, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    ids: runtimeDeletedAutomatedBuildingIds,
  }));
}

function getLocalStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}
