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
];

export function getIndoorCharacterDefs(buildingId: string | null): IndoorCharacterDef[] {
  if (!buildingId) return [];
  return INDOOR_CHARACTER_DEFS.filter((item) => item.buildingId === buildingId);
}
