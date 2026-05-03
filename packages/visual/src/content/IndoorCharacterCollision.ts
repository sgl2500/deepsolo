import { getIndoorCharacterDefs } from './IndoorCharacterLayout';
import { toActualIndoorBounds } from './IndoorFurnitureLayout';

const PLAYER_FOOTPRINT_RADIUS = 0.45;

export function isBlockedByIndoorCharacter(buildingId: string | null, x: number, y: number): boolean {
  if (!buildingId) return false;

  for (const character of getIndoorCharacterDefs(buildingId)) {
    if (!character.collider) continue;

    const bounds = toActualIndoorBounds(buildingId, character.collider);
    if (
      x >= bounds.minX - PLAYER_FOOTPRINT_RADIUS &&
      x <= bounds.maxX + PLAYER_FOOTPRINT_RADIUS &&
      y >= bounds.minY - PLAYER_FOOTPRINT_RADIUS &&
      y <= bounds.maxY + PLAYER_FOOTPRINT_RADIUS
    ) {
      return true;
    }
  }

  return false;
}
