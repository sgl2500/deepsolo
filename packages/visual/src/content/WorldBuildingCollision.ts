import { BUILDINGS } from '../data/BuildingData';
import { isWorldBuildingUnlocked } from './WorldDiscovery';

function isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = ((pi.y > y) !== (pj.y > y))
      && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isBlockedByWorldBuildingCollision(x: number, y: number): boolean {
  for (const building of BUILDINGS) {
    if (!isWorldBuildingUnlocked(building.id)) continue;

    const entryDx = x - building.entryX;
    const entryDy = y - building.entryY;
    if (Math.sqrt(entryDx * entryDx + entryDy * entryDy) <= building.entryRadius) {
      continue;
    }

    const polygon = building.collisionPolygon ?? [];
    if (polygon.length >= 3) {
      if (isPointInPolygon(x, y, polygon)) return true;
      continue;
    }

    const radius = building.collisionRadius ?? 0;
    if (radius <= 0) continue;
    const cx = building.collisionX ?? building.entryX;
    const cy = building.collisionY ?? building.entryY;
    const dx = x - cx;
    const dy = y - cy;
    if (Math.sqrt(dx * dx + dy * dy) <= radius) return true;
  }
  return false;
}
