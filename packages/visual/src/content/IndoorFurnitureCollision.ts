import { getIndoorFurnitureDefs, toActualIndoorBounds } from './IndoorFurnitureLayout';

export function isBlockedByIndoorFurniture(buildingId: string | null, x: number, y: number): boolean {
  if (!buildingId) return false;

  for (const furniture of getIndoorFurnitureDefs(buildingId)) {
    if (!furniture.collider) continue;

    const bounds = toActualIndoorBounds(buildingId, furniture.collider);
    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
      return true;
    }
  }

  return false;
}
