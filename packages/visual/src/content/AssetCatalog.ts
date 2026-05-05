import { isAssetAllowedInScene, type GameAssetDef } from '../editor/schema/AssetSchema';
import type { EditableSceneType } from '../editor/schema/SceneSchema';

export const ASSET_CATALOG: GameAssetDef[] = [
  {
    id: 'character_dashixiong',
    name: '大师兄',
    category: 'indoor.character',
    kind: 'indoorCharacter',
    textureKey: 'token_center_dashixiong',
    src: 'assets/renwu/大师兄.png',
    defaultLayer: 'character',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
    allowedSceneTypes: ['indoor'],
    tags: ['npc', 'token_center'],
  },
  {
    id: 'character_guihai_yidao',
    name: '归海一刀',
    category: 'indoor.character',
    kind: 'indoorCharacter',
    textureKey: 'token_center_guihai_yidao',
    src: 'assets/renwu/归海一刀.png',
    defaultLayer: 'character',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
    allowedSceneTypes: ['indoor'],
    tags: ['npc', 'token_center'],
  },
  {
    id: 'character_shishu',
    name: '师叔',
    category: 'indoor.character',
    kind: 'indoorCharacter',
    textureKey: 'token_center_shishu',
    src: 'assets/renwu/师叔.png',
    defaultLayer: 'character',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
    allowedSceneTypes: ['indoor'],
    tags: ['npc', 'token_center'],
  },
  {
    id: 'character_sun_daniang',
    name: '孙大娘',
    category: 'indoor.character',
    kind: 'indoorCharacter',
    textureKey: 'token_center_sun_daniang',
    src: 'assets/renwu/孙大娘.png',
    defaultLayer: 'character',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
    allowedSceneTypes: ['indoor'],
    tags: ['npc', 'token_center'],
  },
  {
    id: 'wall_sect_backdrop',
    name: '门派背景',
    category: 'indoor.wallDecor',
    kind: 'wallDecor',
    textureKey: 'token_center_sect_backdrop',
    src: 'assets/maps/qiangti/门派背景.png',
    defaultLayer: 'wall',
    defaultScale: 0.9,
    allowedSceneTypes: ['indoor'],
    tags: ['wall', 'token_center'],
  },
  {
    id: 'wall_left_decor',
    name: '左侧贴图',
    category: 'indoor.wallDecor',
    kind: 'wallDecor',
    textureKey: 'token_center_left_wall_decor',
    src: 'assets/maps/qiangti/左侧贴图.png',
    defaultLayer: 'wall',
    defaultScale: 0.9,
    allowedSceneTypes: ['indoor'],
    tags: ['wall', 'token_center'],
  },
];

export function getAsset(assetId: string): GameAssetDef | undefined {
  return ASSET_CATALOG.find((asset) => asset.id === assetId);
}

export function getAssetsForScene(sceneType: EditableSceneType): GameAssetDef[] {
  return ASSET_CATALOG.filter((asset) => isAssetAllowedInScene(asset, sceneType));
}

export function getIndoorEditorAssets(): GameAssetDef[] {
  return getAssetsForScene('indoor').filter((asset) =>
    asset.category === 'indoor.character' || asset.category === 'indoor.wallDecor',
  );
}
