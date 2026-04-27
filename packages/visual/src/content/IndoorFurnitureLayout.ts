export type IndoorFurnitureColliderBounds = {
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
};

export type IndoorFurnitureDef = {
  buildingId: string;
  id: string;
  textureKey: string;
  localX: number;
  localY: number;
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
  depthLocalX?: number;
  depthLocalY?: number;
  depthBias?: number;
  collider?: IndoorFurnitureColliderBounds;
};

const INDOOR_LOCAL_ORIGINS: Record<string, { x: number; y: number }> = {
  // 观察者小屋的用户指定坐标以围墙内左上角为 (0, 0)，围墙实际从地图 (3, 3) 开始。
  birth_house: { x: 3, y: 3 },
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
    collider: { minLocalX: 11.6, maxLocalX: 13.9, minLocalY: 10.3, maxLocalY: 13.8 },
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
];

export function getIndoorFurnitureDefs(buildingId: string | null): IndoorFurnitureDef[] {
  if (!buildingId) return [];
  return INDOOR_FURNITURE_DEFS.filter((item) => item.buildingId === buildingId);
}

export function toActualIndoorMapPosition(
  buildingId: string,
  localX: number,
  localY: number,
): { mapX: number; mapY: number } {
  const origin = INDOOR_LOCAL_ORIGINS[buildingId] ?? { x: 0, y: 0 };
  return { mapX: localX + origin.x, mapY: localY + origin.y };
}

export function toLocalIndoorMapPosition(
  buildingId: string,
  mapX: number,
  mapY: number,
): { localX: number; localY: number } {
  const origin = INDOOR_LOCAL_ORIGINS[buildingId] ?? { x: 0, y: 0 };
  return { localX: mapX - origin.x, localY: mapY - origin.y };
}

export function toActualIndoorBounds(
  buildingId: string,
  bounds: IndoorFurnitureColliderBounds,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const origin = INDOOR_LOCAL_ORIGINS[buildingId] ?? { x: 0, y: 0 };
  return {
    minX: bounds.minLocalX + origin.x,
    maxX: bounds.maxLocalX + origin.x,
    minY: bounds.minLocalY + origin.y,
    maxY: bounds.maxLocalY + origin.y,
  };
}
