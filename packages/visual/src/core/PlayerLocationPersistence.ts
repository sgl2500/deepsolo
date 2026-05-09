import { SceneState } from '../types';
import { WORLD_LAYOUT_SOURCE_SAVED_AT } from '../data/WorldLayoutSource';

export interface PlayerLocation {
  version: 1;
  scene: SceneState.WorldMap | SceneState.Indoor;
  x: number;
  y: number;
  buildingId?: string;
  worldX?: number;
  worldY?: number;
  worldLayoutSavedAt?: number;
  updatedAt: number;
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeTimestamp(value: unknown): number {
  const n = safeNumber(value);
  return n ?? Date.now();
}

export function createWorldPlayerLocation(x: number, y: number): PlayerLocation | null {
  const safeX = safeNumber(x);
  const safeY = safeNumber(y);
  if (safeX === null || safeY === null) return null;
  return {
    version: 1,
    scene: SceneState.WorldMap,
    x: safeX,
    y: safeY,
    worldLayoutSavedAt: WORLD_LAYOUT_SOURCE_SAVED_AT,
    updatedAt: Date.now(),
  };
}

export function createIndoorPlayerLocation(
  buildingId: string | null | undefined,
  x: number,
  y: number,
  worldX?: number,
  worldY?: number,
): PlayerLocation | null {
  const safeX = safeNumber(x);
  const safeY = safeNumber(y);
  const safeWorldX = safeNumber(worldX);
  const safeWorldY = safeNumber(worldY);
  if (!buildingId || safeX === null || safeY === null) return null;
  return {
    version: 1,
    scene: SceneState.Indoor,
    buildingId,
    x: safeX,
    y: safeY,
    ...(safeWorldX !== null && safeWorldY !== null ? { worldX: safeWorldX, worldY: safeWorldY } : {}),
    worldLayoutSavedAt: WORLD_LAYOUT_SOURCE_SAVED_AT,
    updatedAt: Date.now(),
  };
}

export function normalizePlayerLocation(raw: unknown): PlayerLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const x = safeNumber(data.x);
  const y = safeNumber(data.y);
  const worldLayoutSavedAt = safeNumber(data.worldLayoutSavedAt);
  if (x === null || y === null) return null;

  if (data.scene === SceneState.WorldMap) {
    return {
      version: 1,
      scene: SceneState.WorldMap,
      x,
      y,
      ...(worldLayoutSavedAt !== null ? { worldLayoutSavedAt } : {}),
      updatedAt: safeTimestamp(data.updatedAt),
    };
  }

  if (data.scene === SceneState.Indoor && typeof data.buildingId === 'string' && data.buildingId.length > 0) {
    const worldX = safeNumber(data.worldX);
    const worldY = safeNumber(data.worldY);
    return {
      version: 1,
      scene: SceneState.Indoor,
      buildingId: data.buildingId,
      x,
      y,
      ...(worldX !== null && worldY !== null ? { worldX, worldY } : {}),
      ...(worldLayoutSavedAt !== null ? { worldLayoutSavedAt } : {}),
      updatedAt: safeTimestamp(data.updatedAt),
    };
  }

  return null;
}

export function getPlayerLocationSignature(location: PlayerLocation): string {
  const x = location.x.toFixed(2);
  const y = location.y.toFixed(2);
  const sourceVersion = location.worldLayoutSavedAt ?? '';
  if (location.scene === SceneState.Indoor) {
    const worldX = location.worldX?.toFixed(2) ?? '';
    const worldY = location.worldY?.toFixed(2) ?? '';
    return `${location.scene}:${location.buildingId}:${x}:${y}:${worldX}:${worldY}:${sourceVersion}`;
  }
  return `${location.scene}:${x}:${y}:${sourceVersion}`;
}
