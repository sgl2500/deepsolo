import { getIndoorRoomTemplate } from './IndoorRoomTemplates';
import { getAutomatedIndoorFurnitureDefs } from './AutomatedBuildingRegistry';

export type IndoorFurnitureColliderBounds = {
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
};

export type IndoorFurnitureMaskPoint = {
  px: number;
  py: number;
};

export type IndoorFurnitureDef = {
  buildingId: string;
  id: string;
  textureKey: string;
  renderLayer?: 'object' | 'wall';
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
  collider?: IndoorFurnitureColliderBounds;
  occluderMask?: IndoorFurnitureMaskPoint[];
};

export const INDOOR_FURNITURE_DEFS: IndoorFurnitureDef[] = [
  {
    buildingId: 'birth_house',
    id: 'bed',
    textureKey: 'birth_house_decor_bed',
    localX: 2.3,
    localY: 10.3,
    scale: 0.5,
    depthLocalX: 1.5,
    depthLocalY: 9.2,
    collider: { minLocalX: 0, maxLocalX: 2.5, minLocalY: 7.2, maxLocalY: 11.1 },
  },
  {
    buildingId: 'birth_house',
    id: 'bookshelf_left',
    textureKey: 'birth_house_decor_bookshelf',
    localX: 9,
    localY: 1,
    scale: 0.54,
    collider: { minLocalX: 8.2, maxLocalX: 9.8, minLocalY: 0.3, maxLocalY: 1.9 },
  },
  {
    buildingId: 'birth_house',
    id: 'bookshelf_right',
    textureKey: 'birth_house_decor_bookshelf',
    localX: 11,
    localY: 1,
    scale: 0.54,
    collider: { minLocalX: 10.2, maxLocalX: 11.8, minLocalY: 0.3, maxLocalY: 1.9 },
  },
  {
    buildingId: 'birth_house',
    id: 'screen',
    textureKey: 'birth_house_decor_screen',
    localX: 13.96,
    localY: 5.49,
    scale: 0.5,
    collider: { minLocalX: 13, maxLocalX: 15.1, minLocalY: 4.7, maxLocalY: 6.3 },
  },
  {
    buildingId: 'birth_house',
    id: 'lantern',
    textureKey: 'birth_house_decor_lantern',
    localX: 16.11,
    localY: 6.39,
    scale: 0.5,
    collider: { minLocalX: 15.6, maxLocalX: 16.6, minLocalY: 5.9, maxLocalY: 7 },
  },
  {
    buildingId: 'birth_house',
    id: 'table',
    textureKey: 'birth_house_decor_table',
    localX: 13.6,
    localY: 13.3,
    scale: 0.55,
    depthLocalX: 12.1,
    depthLocalY: 12.6,
    collider: { minLocalX: 11.6, maxLocalX: 13.9, minLocalY: 10.3, maxLocalY: 13.8
     },
  },
  {
    buildingId: 'birth_house',
    id: 'chest',
    textureKey: 'birth_house_decor_chest',
    localX: 4.9,
    localY: 4.9,
    scale: 0.5,
    collider: { minLocalX: 4.1, maxLocalX: 5.9, minLocalY: 4.1, maxLocalY: 5.9 },
  },
  // --- Token中心 ---
  {
    buildingId: 'token_center',
    id: 'boss_portrait',
    textureKey: 'token_center_boss',
    localX: 17,
    localY: 2,
    scale: 0.7,
    depthLocalX: 17,
    depthLocalY: 0,
    collider: { minLocalX: 15.5, maxLocalX: 18.5, minLocalY: 0.5, maxLocalY: 3.5 },
  },
  {
    buildingId: 'token_center',
    id: 'sect_backdrop',
    textureKey: 'token_center_sect_backdrop',
    renderLayer: 'wall',
    localX: 17,
    localY: 3,
    scale: 0.9,
    depthBias: 0.1,
  },
  {
    buildingId: 'token_center',
    id: 'left_wall_decor',
    textureKey: 'token_center_left_wall_decor',
    renderLayer: 'wall',
    localX: 5.2,
    localY: 12.6,
    scale: 0.9,
    depthLocalX: 1,
    depthLocalY: 12,
    depthBias: -0.25,
  },
  ...getAutomatedIndoorFurnitureDefs(),
];

export function getIndoorFurnitureDefs(buildingId: string | null): IndoorFurnitureDef[] {
  if (!buildingId) return [];
  return INDOOR_FURNITURE_DEFS.filter((item) => item.buildingId === buildingId);
}

export function addIndoorFurnitureDef(def: IndoorFurnitureDef): void {
  const existingIndex = INDOOR_FURNITURE_DEFS.findIndex(
    (item) => item.buildingId === def.buildingId && item.id === def.id,
  );
  if (existingIndex >= 0) {
    INDOOR_FURNITURE_DEFS[existingIndex] = def;
    return;
  }
  INDOOR_FURNITURE_DEFS.push(def);
}

export function removeIndoorFurnitureDefs(
  buildingId: string,
  shouldRemove: (item: IndoorFurnitureDef) => boolean,
): void {
  for (let i = INDOOR_FURNITURE_DEFS.length - 1; i >= 0; i--) {
    const item = INDOOR_FURNITURE_DEFS[i];
    if (item.buildingId === buildingId && shouldRemove(item)) {
      INDOOR_FURNITURE_DEFS.splice(i, 1);
    }
  }
}

export function createIndoorFurnitureCopyId(buildingId: string, baseId: string): string {
  const existingIds = new Set(getIndoorFurnitureDefs(buildingId).map((item) => item.id));
  let index = 1;
  let nextId = `${baseId}_copy_${index}`;
  while (existingIds.has(nextId)) {
    index++;
    nextId = `${baseId}_copy_${index}`;
  }
  return nextId;
}

export function toActualIndoorMapPosition(
  buildingId: string,
  localX: number,
  localY: number,
): { mapX: number; mapY: number } {
  const origin = getIndoorRoomTemplate(buildingId)?.localOrigin ?? { x: 0, y: 0 };
  return { mapX: localX + origin.x, mapY: localY + origin.y };
}

export function toLocalIndoorMapPosition(
  buildingId: string,
  mapX: number,
  mapY: number,
): { localX: number; localY: number } {
  const origin = getIndoorRoomTemplate(buildingId)?.localOrigin ?? { x: 0, y: 0 };
  return { localX: mapX - origin.x, localY: mapY - origin.y };
}

export function toActualIndoorBounds(
  buildingId: string,
  bounds: IndoorFurnitureColliderBounds,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const origin = getIndoorRoomTemplate(buildingId)?.localOrigin ?? { x: 0, y: 0 };
  return {
    minX: bounds.minLocalX + origin.x,
    maxX: bounds.maxLocalX + origin.x,
    minY: bounds.minLocalY + origin.y,
    maxY: bounds.maxLocalY + origin.y,
  };
}
