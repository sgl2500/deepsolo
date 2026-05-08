import type { IndoorInteractableDef } from '../types';
import { toActualIndoorBounds, toActualIndoorMapPosition } from './IndoorFurnitureLayout';

const bedPos = toActualIndoorMapPosition('birth_house', 1.5, 11.5);
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
    interactRadius: 0.05,
    prompt: '空格：在木榻休息',
    interactionZone: {
      type: 'rect',
      minLocalX: 0.2,
      maxLocalX: 2.8,
      minLocalY: 11.1,
      maxLocalY: 12.8,
    },
    action: {
      type: 'rest',
      hpRecover: 'full',
      mpRecover: 'full',
      message: '你在木榻上调息片刻，生命与内力都恢复了。',
      noticeTitle: '帷幔木榻',
    },
  },
  {
    id: 'birth_house_bookshelf',
    name: '藏卷书架',
    buildingId: 'birth_house',
    mapX: bookshelfPos.mapX,
    mapY: bookshelfPos.mapY,
    interactRadius: 2.2,
    prompt: '空格：翻看藏卷书架',
    action: {
      type: 'discover_manual',
      manualId: 'manual_tuna_intro',
      manualName: '吐纳入门',
      onceFlag: 'birth_house_bookshelf_manual_found',
      firstDialogueId: 'birth_house_bookshelf_found_manual',
      repeatDialogueId: 'birth_house_bookshelf_manual_repeat',
      foundNotice: {
        title: '发现物品',
        message: '获得秘籍《吐纳入门》',
      },
      emptyNotice: {
        title: '什么都没有',
        message: '你仔细翻找了一遍，没有发现新的东西。',
      },
    },
  },
  {
    id: 'birth_house_desk',
    name: '长案',
    buildingId: 'birth_house',
    mapX: deskPos.mapX,
    mapY: deskPos.mapY,
    interactRadius: 2.2,
    prompt: '空格：查看长案',
    action: {
      type: 'notice',
      notice: {
        title: '查看桌案',
        message: '桌案上有纸和笔，纸页只写着几行短句：先问一问，再决定是战是谈。',
      },
    },
  },
  {
    id: 'birth_house_notice',
    name: '屋规告示',
    buildingId: 'birth_house',
    mapX: noticePos.mapX,
    mapY: noticePos.mapY,
    interactRadius: 2.2,
    prompt: '空格：查看屋规告示',
    action: {
      type: 'notice',
      notice: {
        title: '屋规告示',
        message: '告示上写着：入世先观，见人先问；若要动手，也须先听完一句话。',
      },
    },
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

    const dist = getInteractableDistance(item, playerX, playerY);
    const radius = item.interactRadius ?? fallbackRadius;
    if (dist > radius) continue;

    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }

  return best;
}

export function getIndoorInteractables(buildingId: string | null): IndoorInteractableDef[] {
  if (!buildingId) return [];
  return INDOOR_INTERACTABLES.filter((item) => item.buildingId === buildingId);
}

function getInteractableDistance(item: IndoorInteractableDef, playerX: number, playerY: number): number {
  if (item.interactionZone?.type === 'rect') {
    const bounds = toActualIndoorBounds(item.buildingId, {
      minLocalX: item.interactionZone.minLocalX,
      maxLocalX: item.interactionZone.maxLocalX,
      minLocalY: item.interactionZone.minLocalY,
      maxLocalY: item.interactionZone.maxLocalY,
    });
    const dx = playerX < bounds.minX ? bounds.minX - playerX : playerX > bounds.maxX ? playerX - bounds.maxX : 0;
    const dy = playerY < bounds.minY ? bounds.minY - playerY : playerY > bounds.maxY ? playerY - bounds.maxY : 0;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const dx = item.mapX - playerX;
  const dy = item.mapY - playerY;
  return Math.sqrt(dx * dx + dy * dy);
}
