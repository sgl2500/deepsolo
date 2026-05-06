export type IndoorCharacterDef = {
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
  collider?: {
    minLocalX: number;
    maxLocalX: number;
    minLocalY: number;
    maxLocalY: number;
  };
};

export const INDOOR_CHARACTER_DEFS: IndoorCharacterDef[] = [
  {
    buildingId: 'token_center',
    id: 'token_center_dashixiong',
    textureKey: 'token_center_dashixiong',
    localX: 20,
    localY: 12,
    scale: 0.54,
    collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 11.4, maxLocalY: 12.6 },
  },
  {
    buildingId: 'token_center',
    id: 'token_center_guihai_yidao',
    textureKey: 'token_center_guihai_yidao',
    localX: 14,
    localY: 17,
    scale: 0.54,
    collider: { minLocalX: 13.4, maxLocalX: 14.6, minLocalY: 16.4, maxLocalY: 17.6 },
  },
  {
    buildingId: 'token_center',
    id: 'token_center_shishu',
    textureKey: 'token_center_shishu',
    localX: 26,
    localY: 17,
    scale: 0.54,
    collider: { minLocalX: 25.4, maxLocalX: 26.6, minLocalY: 16.4, maxLocalY: 17.6 },
  },
  {
    buildingId: 'token_center',
    id: 'token_center_sun_daniang',
    textureKey: 'token_center_sun_daniang',
    localX: 20,
    localY: 24,
    scale: 0.54,
    collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 23.4, maxLocalY: 24.6 },
  },
  // --- 数字门派：复用 Token 中心人物与站位 ---
  {
    buildingId: 'digital_sect',
    id: 'digital_sect_dashixiong',
    textureKey: 'token_center_dashixiong',
    localX: 20,
    localY: 12,
    scale: 0.54,
    collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 11.4, maxLocalY: 12.6 },
  },
  {
    buildingId: 'digital_sect',
    id: 'digital_sect_guihai_yidao',
    textureKey: 'token_center_guihai_yidao',
    localX: 14,
    localY: 17,
    scale: 0.54,
    collider: { minLocalX: 13.4, maxLocalX: 14.6, minLocalY: 16.4, maxLocalY: 17.6 },
  },
  {
    buildingId: 'digital_sect',
    id: 'digital_sect_sun_daniang',
    textureKey: 'token_center_sun_daniang',
    localX: 20,
    localY: 24,
    scale: 0.54,
    collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 23.4, maxLocalY: 24.6 },
  },
];

export function getIndoorCharacterDefs(buildingId: string | null): IndoorCharacterDef[] {
  if (!buildingId) return [];
  return INDOOR_CHARACTER_DEFS.filter((item) => item.buildingId === buildingId);
}

export function addIndoorCharacterDef(def: IndoorCharacterDef): void {
  const existingIndex = INDOOR_CHARACTER_DEFS.findIndex(
    (item) => item.buildingId === def.buildingId && item.id === def.id,
  );
  if (existingIndex >= 0) {
    INDOOR_CHARACTER_DEFS[existingIndex] = def;
    return;
  }
  INDOOR_CHARACTER_DEFS.push(def);
}

export function removeIndoorCharacterDefs(
  buildingId: string,
  shouldRemove: (item: IndoorCharacterDef) => boolean,
): void {
  for (let i = INDOOR_CHARACTER_DEFS.length - 1; i >= 0; i--) {
    const item = INDOOR_CHARACTER_DEFS[i];
    if (item.buildingId === buildingId && shouldRemove(item)) {
      INDOOR_CHARACTER_DEFS.splice(i, 1);
    }
  }
}

export function createIndoorCharacterInstanceId(buildingId: string, baseId: string): string {
  const existingIds = new Set(getIndoorCharacterDefs(buildingId).map((item) => item.id));
  let index = 1;
  let nextId = `${baseId}_instance_${index}`;
  while (existingIds.has(nextId)) {
    index++;
    nextId = `${baseId}_instance_${index}`;
  }
  return nextId;
}
