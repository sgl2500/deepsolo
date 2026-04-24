import type { IndoorInteractableDef } from '../types';

export const INDOOR_INTERACTABLES: IndoorInteractableDef[] = [
  {
    id: 'birth_house_bed',
    name: '帷幔木榻',
    buildingId: 'birth_house',
    mapX: 10,
    mapY: 18,
    interactRadius: 2.2,
    dialogueId: 'birth_house_bed',
  },
  {
    id: 'birth_house_bookshelf',
    name: '藏卷书架',
    buildingId: 'birth_house',
    mapX: 14,
    mapY: 8,
    interactRadius: 2.2,
    dialogueId: 'birth_house_bookshelf',
  },
  {
    id: 'birth_house_desk',
    name: '长案',
    buildingId: 'birth_house',
    mapX: 16,
    mapY: 16,
    interactRadius: 2.2,
    dialogueId: 'birth_house_desk',
  },
  {
    id: 'birth_house_notice',
    name: '屋规告示',
    buildingId: 'birth_house',
    mapX: 17,
    mapY: 9,
    interactRadius: 2.2,
    dialogueId: 'birth_house_notice',
  },
];

export function getNearbyIndoorInteractable(
  buildingId: string,
  playerX: number,
  playerY: number,
  fallbackRadius: number,
): IndoorInteractableDef | null {
  let best: IndoorInteractableDef | null = null;
  let bestDist = Infinity;

  for (const item of INDOOR_INTERACTABLES) {
    if (item.buildingId !== buildingId) continue;

    const dx = item.mapX - playerX;
    const dy = item.mapY - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = item.interactRadius ?? fallbackRadius;
    if (dist > radius) continue;

    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }

  return best;
}
