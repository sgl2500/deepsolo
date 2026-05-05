import { LS_KEY_INDOOR_FLOOR_TILE_OVERRIDES } from '../../config';

export type IndoorFloorTileOverride = {
  col: number;
  row: number;
  textureKey: string;
};

type IndoorFloorTileOverridePayload = {
  version: 1;
  buildingId: string;
  savedAt: number;
  items: IndoorFloorTileOverride[];
};

export function getIndoorFloorTileOverrideStorageKey(buildingId: string): string {
  return `${LS_KEY_INDOOR_FLOOR_TILE_OVERRIDES}:${buildingId}`;
}

export function loadIndoorFloorTileOverrides(buildingId: string): IndoorFloorTileOverride[] | null {
  const raw = localStorage.getItem(getIndoorFloorTileOverrideStorageKey(buildingId));
  if (!raw) return null;
  const payload = JSON.parse(raw) as Partial<IndoorFloorTileOverridePayload>;
  if (payload.version !== 1 || payload.buildingId !== buildingId || !Array.isArray(payload.items)) return null;
  return payload.items.filter((item) => (
    Number.isFinite(item?.col) && Number.isFinite(item?.row) && typeof item?.textureKey === 'string' && item.textureKey.length > 0
  ));
}

export function saveIndoorFloorTileOverrides(buildingId: string, items: IndoorFloorTileOverride[]): void {
  const payload: IndoorFloorTileOverridePayload = {
    version: 1,
    buildingId,
    savedAt: Date.now(),
    items,
  };
  localStorage.setItem(getIndoorFloorTileOverrideStorageKey(buildingId), JSON.stringify(payload));
}

export function clearIndoorFloorTileOverrides(buildingId: string): void {
  localStorage.removeItem(getIndoorFloorTileOverrideStorageKey(buildingId));
}
