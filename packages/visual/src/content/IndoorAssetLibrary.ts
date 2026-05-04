export type IndoorAssetKind = 'character' | 'wallDecor';

export type IndoorAssetDef = {
  id: string;
  name: string;
  kind: IndoorAssetKind;
  textureKey: string;
  src: string;
  defaultScale?: number;
  defaultOriginX?: number;
  defaultOriginY?: number;
  defaultColliderSize?: { width: number; height: number };
};

export const INDOOR_ASSET_LIBRARY: IndoorAssetDef[] = [
  {
    id: 'character_dashixiong',
    name: '大师兄',
    kind: 'character',
    textureKey: 'token_center_dashixiong',
    src: 'assets/renwu/大师兄.png',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
  },
  {
    id: 'character_guihai_yidao',
    name: '归海一刀',
    kind: 'character',
    textureKey: 'token_center_guihai_yidao',
    src: 'assets/renwu/归海一刀.png',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
  },
  {
    id: 'character_shishu',
    name: '师叔',
    kind: 'character',
    textureKey: 'token_center_shishu',
    src: 'assets/renwu/师叔.png',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
  },
  {
    id: 'character_sun_daniang',
    name: '孙大娘',
    kind: 'character',
    textureKey: 'token_center_sun_daniang',
    src: 'assets/renwu/孙大娘.png',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
  },
  {
    id: 'wall_sect_backdrop',
    name: '门派背景',
    kind: 'wallDecor',
    textureKey: 'token_center_sect_backdrop',
    src: 'assets/maps/qiangti/门派背景.png',
    defaultScale: 0.9,
  },
  {
    id: 'wall_left_decor',
    name: '左侧贴图',
    kind: 'wallDecor',
    textureKey: 'token_center_left_wall_decor',
    src: 'assets/maps/qiangti/左侧贴图.png',
    defaultScale: 0.9,
  },
];

export function getIndoorAsset(assetId: string): IndoorAssetDef | undefined {
  return INDOOR_ASSET_LIBRARY.find((asset) => asset.id === assetId);
}
