import { getAsset, getIndoorEditorAssets } from './AssetCatalog';
import type { GameAssetDef } from '../editor/schema/AssetSchema';

export type IndoorAssetKind = 'character' | 'furniture' | 'wallDecor';

export type IndoorAssetDef = Omit<GameAssetDef, 'kind'> & {
  kind: IndoorAssetKind;
  sceneObjectKind: GameAssetDef['kind'];
};

function toIndoorAssetKind(asset: GameAssetDef): IndoorAssetKind | null {
  if (asset.category === 'indoor.character') return 'character';
  if (asset.category === 'indoor.furniture') return 'furniture';
  if (asset.category === 'indoor.wallDecor') return 'wallDecor';
  return null;
}

function toIndoorAsset(asset: GameAssetDef): IndoorAssetDef | null {
  const kind = toIndoorAssetKind(asset);
  return kind ? { ...asset, kind, sceneObjectKind: asset.kind } : null;
}

export const INDOOR_ASSET_LIBRARY: IndoorAssetDef[] = getIndoorEditorAssets()
  .map(toIndoorAsset)
  .filter((asset): asset is IndoorAssetDef => !!asset);

export function getIndoorAsset(assetId: string): IndoorAssetDef | undefined {
  const asset = getAsset(assetId);
  return asset ? toIndoorAsset(asset) ?? undefined : undefined;
}
