import type { IndoorInteractableDef } from '../types';
import { toActualIndoorMapPosition } from './IndoorFurnitureLayout';

const bedPos = toActualIndoorMapPosition('birth_house', 3.6, 8.3);
const bookshelfPos = toActualIndoorMapPosition('birth_house', 10, 1);
const deskPos = toActualIndoorMapPosition('birth_house', 12.92, 12.92);
const noticePos = toActualIndoorMapPosition('birth_house', 13.96, 5.49);

export const INDOOR_INTERACTABLES: IndoorInteractableDef[] = [
  {
    id: 'birth_house_bed',
    name: '帷幔木榻',
    buildingId: 'birth_house',
    mapX: bedPos.mapX,
    mapY: bedPos.mapY,
    interactRadius: 2.2,
    dialogueId: 'birth_house_bed',
  },
  {
    id: 'birth_house_bookshelf',
    name: '藏卷书架',
    buildingId: 'birth_house',
    mapX: bookshelfPos.mapX,
    mapY: bookshelfPos.mapY,
    interactRadius: 2.2,
    dialogueId: 'birth_house_bookshelf',
  },
  {
    id: 'birth_house_desk',
    name: '长案',
    buildingId: 'birth_house',
    mapX: deskPos.mapX,
    mapY: deskPos.mapY,
    interactRadius: 2.2,
    dialogueId: 'birth_house_desk',
  },
  {
    id: 'birth_house_notice',
    name: '屋规告示',
    buildingId: 'birth_house',
    mapX: noticePos.mapX,
    mapY: noticePos.mapY,
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
