import type { NPCDef } from '../types';
import { getAssetByTextureKey } from './AssetCatalog';
import { getIndoorCharacterDefs, type IndoorCharacterDef } from './IndoorCharacterLayout';
import { toActualIndoorMapPosition } from './IndoorFurnitureLayout';

const BIRTH_HOUSE_GUSHEN_CHARACTER_ID = 'character_monk_instance_1';
const FALLBACK_GUSHEN_PORTRAIT_KEY = 'assets/portraits/gushen.png';

function getBirthHouseGushenCharacter(): IndoorCharacterDef | null {
  const characters = getIndoorCharacterDefs('birth_house');
  return characters.find((character) => character.id === BIRTH_HOUSE_GUSHEN_CHARACTER_ID)
    ?? (characters.length === 1 ? characters[0] : null);
}

export function getStoryNpcSourceCharacterIds(buildingId: string | null): Set<string> {
  if (buildingId !== 'birth_house') return new Set();
  const source = getBirthHouseGushenCharacter();
  return new Set(source ? [source.id] : []);
}

export function resolveStoryPortraitKey(speaker: string, portraitKey: string): string {
  if (speaker !== '股神' || portraitKey !== FALLBACK_GUSHEN_PORTRAIT_KEY) return portraitKey;

  const source = getBirthHouseGushenCharacter();
  if (!source) return portraitKey;
  return getAssetByTextureKey(source.textureKey)?.src ?? portraitKey;
}

export function resolveStoryNpcPlacement(npcDef: NPCDef): NPCDef {
  if (npcDef.id !== 'gushen' || npcDef.mapId !== 'birth_house') return npcDef;

  const source = getBirthHouseGushenCharacter();
  if (!source) return npcDef;

  const position = toActualIndoorMapPosition('birth_house', source.localX, source.localY);
  const depthPosition = toActualIndoorMapPosition(
    'birth_house',
    source.depthLocalX ?? source.localX,
    source.depthLocalY ?? source.localY,
  );

  return {
    ...npcDef,
    mapX: position.mapX,
    mapY: position.mapY,
    charKey: source.textureKey,
    scale: source.scale,
    alpha: source.alpha,
    originX: source.originX,
    originY: source.originY,
    pixelOffsetX: source.pixelOffsetX,
    pixelOffsetY: source.pixelOffsetY,
    depthMapX: depthPosition.mapX,
    depthMapY: depthPosition.mapY,
    depthBias: source.depthBias,
  };
}
