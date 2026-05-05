import { isAssetAllowedInScene, type AssetCategory, type GameAssetDef } from '../editor/schema/AssetSchema';
import type { EditableSceneType, SceneLayer } from '../editor/schema/SceneSchema';

const INDOOR_ROOT = 'assets/indoor';

function indoorAsset(
  def: Omit<GameAssetDef, 'allowedSceneTypes'> & { allowedSceneTypes?: EditableSceneType[] },
): GameAssetDef {
  return {
    allowedSceneTypes: ['indoor'],
    ...def,
  };
}

function furniture(
  id: string,
  name: string,
  textureKey: string,
  src: string,
  options: Partial<Pick<GameAssetDef, 'defaultScale' | 'defaultOriginX' | 'defaultOriginY' | 'defaultColliderSize' | 'tags' | 'economy'>> = {},
): GameAssetDef {
  return indoorAsset({
    id,
    name,
    category: 'indoor.furniture',
    kind: 'indoorFurniture',
    textureKey,
    src,
    defaultLayer: 'object',
    ...options,
  });
}

function character(
  id: string,
  name: string,
  textureKey: string,
  file: string,
  tags: string[] = ['npc'],
): GameAssetDef {
  return indoorAsset({
    id,
    name,
    category: 'indoor.character',
    kind: 'indoorCharacter',
    textureKey,
    src: `${INDOOR_ROOT}/characters/${file}`,
    defaultLayer: 'character',
    defaultScale: 0.54,
    defaultColliderSize: { width: 1.2, height: 1.2 },
    tags,
  });
}

function wallDecor(
  id: string,
  name: string,
  textureKey: string,
  file: string,
  tags: string[] = ['wall'],
): GameAssetDef {
  return indoorAsset({
    id,
    name,
    category: 'indoor.wallDecor',
    kind: 'wallDecor',
    textureKey,
    src: `${INDOOR_ROOT}/wall-decor/token-center/${file}`,
    defaultLayer: 'wall',
    defaultScale: 0.9,
    tags,
  });
}

function tile(
  id: string,
  name: string,
  category: Extract<AssetCategory, 'indoor.floorTile' | 'indoor.rugTile'>,
  textureKey: string,
  src: string,
  layer: Extract<SceneLayer, 'floor' | 'rug'>,
  tags: string[],
): GameAssetDef {
  return indoorAsset({
    id,
    name,
    category,
    kind: 'floorDecor',
    textureKey,
    src,
    defaultLayer: layer,
    tags,
  });
}

export const ASSET_CATALOG: GameAssetDef[] = [
  furniture(
    'furniture_birth_house_bed',
    '木床',
    'birth_house_decor_bed',
    `${INDOOR_ROOT}/furniture/observer-house/bed.png`,
    { defaultScale: 0.5, tags: ['furniture', 'birth_house', 'bed'] },
  ),
  furniture(
    'furniture_birth_house_bookshelf',
    '书架',
    'birth_house_decor_bookshelf',
    `${INDOOR_ROOT}/furniture/observer-house/bookshelf.png`,
    { defaultScale: 0.54, tags: ['furniture', 'birth_house', 'bookshelf'] },
  ),
  furniture(
    'furniture_birth_house_chest',
    '木箱',
    'birth_house_decor_chest',
    `${INDOOR_ROOT}/furniture/observer-house/chest.png`,
    { defaultScale: 0.5, tags: ['furniture', 'birth_house', 'storage'] },
  ),
  furniture(
    'furniture_birth_house_lantern',
    '灯笼',
    'birth_house_decor_lantern',
    `${INDOOR_ROOT}/furniture/observer-house/lantern.png`,
    { defaultScale: 0.5, tags: ['furniture', 'birth_house', 'light'] },
  ),
  furniture(
    'furniture_birth_house_screen',
    '屏风',
    'birth_house_decor_screen',
    `${INDOOR_ROOT}/furniture/observer-house/screen.png`,
    { defaultScale: 0.5, tags: ['furniture', 'birth_house', 'screen'] },
  ),
  furniture(
    'furniture_birth_house_table',
    '茶桌',
    'birth_house_decor_table',
    `${INDOOR_ROOT}/furniture/observer-house/table.png`,
    { defaultScale: 0.55, tags: ['furniture', 'birth_house', 'table'] },
  ),
  furniture(
    'furniture_token_center_boss_portrait',
    'Token中心掌门像',
    'token_center_boss',
    `${INDOOR_ROOT}/furniture/token-center/boss-portrait.png`,
    { defaultScale: 0.7, tags: ['furniture', 'token_center', 'portrait'] },
  ),

  character('character_dashixiong', '大师兄', 'token_center_dashixiong', 'dashixiong.png', ['npc', 'token_center']),
  character('character_guihai_yidao', '归海一刀', 'token_center_guihai_yidao', 'guihai-yidao.png', ['npc', 'token_center']),
  character('character_shishu', '师叔', 'token_center_shishu', 'shishu.png', ['npc', 'token_center']),
  character('character_sun_daniang', '孙大娘', 'token_center_sun_daniang', 'sun-daniang.png', ['npc', 'token_center']),
  character('character_monk', '和尚', 'indoor_character_monk', 'monk.png', ['npc']),

  wallDecor('wall_sect_backdrop', '门派背景', 'token_center_sect_backdrop', 'sect-backdrop.png', ['wall', 'token_center']),
  wallDecor('wall_left_decor', '左侧贴图', 'token_center_left_wall_decor', 'left-wall-decor.png', ['wall', 'token_center']),

  tile(
    'tile_floor_token_center_0514',
    'Token中心木地板',
    'indoor.floorTile',
    'smap_9514',
    `${INDOOR_ROOT}/tiles/floor/token-center/0514.png`,
    'floor',
    ['floor', 'token_center'],
  ),

  tile('tile_rug_0306', '地毯 0306', 'indoor.rugTile', 'smap_9306', `${INDOOR_ROOT}/tiles/rug/0306.png`, 'rug', ['rug']),
  tile('tile_rug_0307', '地毯 0307', 'indoor.rugTile', 'smap_9307', `${INDOOR_ROOT}/tiles/rug/0307.png`, 'rug', ['rug']),
  tile('tile_rug_0308', '地毯 0308', 'indoor.rugTile', 'smap_9308', `${INDOOR_ROOT}/tiles/rug/0308.png`, 'rug', ['rug']),
  tile('tile_rug_0309', '地毯 0309', 'indoor.rugTile', 'smap_9309', `${INDOOR_ROOT}/tiles/rug/0309.png`, 'rug', ['rug', 'token_center']),
  tile('tile_rug_0310', '地毯 0310', 'indoor.rugTile', 'smap_9310', `${INDOOR_ROOT}/tiles/rug/0310.png`, 'rug', ['rug']),
  tile('tile_rug_0311', '地毯 0311', 'indoor.rugTile', 'smap_9311', `${INDOOR_ROOT}/tiles/rug/0311.png`, 'rug', ['rug']),
  tile('tile_rug_0312', '地毯 0312', 'indoor.rugTile', 'smap_9312', `${INDOOR_ROOT}/tiles/rug/0312.png`, 'rug', ['rug']),
  tile('tile_rug_0313', '地毯 0313', 'indoor.rugTile', 'smap_9313', `${INDOOR_ROOT}/tiles/rug/0313.png`, 'rug', ['rug', 'token_center']),
  tile('tile_rug_0330', '地毯 0330', 'indoor.rugTile', 'smap_9330', `${INDOOR_ROOT}/tiles/rug/0330.png`, 'rug', ['rug', 'token_center']),
];

export function getAsset(assetId: string): GameAssetDef | undefined {
  return ASSET_CATALOG.find((asset) => asset.id === assetId);
}

export function getAssetByTextureKey(textureKey: string): GameAssetDef | undefined {
  return ASSET_CATALOG.find((asset) => asset.textureKey === textureKey);
}

export function getAssetsForScene(sceneType: EditableSceneType): GameAssetDef[] {
  return ASSET_CATALOG.filter((asset) => isAssetAllowedInScene(asset, sceneType));
}

export function getAssetsByCategory(category: AssetCategory): GameAssetDef[] {
  return ASSET_CATALOG.filter((asset) => asset.category === category);
}

export function getIndoorEditorAssets(): GameAssetDef[] {
  return getAssetsForScene('indoor').filter((asset) =>
    asset.category === 'indoor.character' ||
    asset.category === 'indoor.furniture' ||
    asset.category === 'indoor.wallDecor',
  );
}

export function getIndoorTileBrushAssets(): GameAssetDef[] {
  return getAssetsForScene('indoor').filter((asset) =>
    asset.category === 'indoor.floorTile' || asset.category === 'indoor.rugTile' || asset.category === 'indoor.floorDecor',
  );
}
