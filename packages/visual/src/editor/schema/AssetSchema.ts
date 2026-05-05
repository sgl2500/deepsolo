import type { EditableSceneType, SceneLayer, SceneObjectKind } from './SceneSchema';

export type AssetCategory =
  | 'indoor.character'
  | 'indoor.furniture'
  | 'indoor.wallDecor'
  | 'indoor.floorTile'
  | 'indoor.rugTile'
  | 'indoor.floorDecor'
  | 'world.building'
  | 'world.decor'
  | 'marker.portal'
  | 'marker.interactable'
  | 'effect';

export type AssetColliderSize = {
  width: number;
  height: number;
};

export type AssetEconomy = {
  source?: 'default' | 'owned' | 'market' | 'reward';
  price?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  tradeable?: boolean;
  unlockCondition?: string;
};

export type GameAssetDef = {
  id: string;
  name: string;
  category: AssetCategory;
  kind: SceneObjectKind;
  textureKey: string;
  src: string;
  defaultLayer: SceneLayer;
  defaultScale?: number;
  defaultOriginX?: number;
  defaultOriginY?: number;
  defaultColliderSize?: AssetColliderSize;
  allowedSceneTypes: EditableSceneType[];
  tags?: string[];
  economy?: AssetEconomy;
};

export function isAssetAllowedInScene(asset: GameAssetDef, sceneType: EditableSceneType): boolean {
  return asset.allowedSceneTypes.includes(sceneType);
}
