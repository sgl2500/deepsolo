import { assert, test, type TestCase } from './test_utils';
import {
  getIndoorEditableTileRegions,
  getIndoorRoomTemplate,
  isIndoorTileEditable,
} from '../../src/content/IndoorRoomTemplates';
import { toActualIndoorMapPosition, toLocalIndoorMapPosition } from '../../src/content/IndoorFurnitureLayout';
import { getAsset, getIndoorEditorAssets, getIndoorTileBrushAssets } from '../../src/content/AssetCatalog';

export const tests: TestCase[] = [
  test('birth house keeps fixed room floor and wall template', () => {
    const template = getIndoorRoomTemplate('birth_house');
    assert.ok(template);
    assert.equal(template.fixedRoom?.skipTilemap, true);
    assert.deepEqual(template.fixedRoom?.floorTiles, {
      textureKeys: ['smap_66'],
      rowStart: 3,
      rowEnd: 22,
      colStart: 3,
      colEnd: 22,
    });
    assert.equal(getIndoorEditableTileRegions('birth_house', 'floor').length, 1);
  }),

  test('token center exposes a floor editable region without fixed room rendering', () => {
    const template = getIndoorRoomTemplate('token_center');
    assert.ok(template);
    assert.equal(template.fixedRoom, undefined);
    assert.equal(isIndoorTileEditable('token_center', 'floor', 4, 4), true);
    assert.equal(isIndoorTileEditable('token_center', 'floor', 36, 36), true);
    assert.equal(isIndoorTileEditable('token_center', 'floor', 3, 3), false);
    assert.deepEqual(getIndoorEditableTileRegions('token_center', 'floor')[0].brushAssetIds, [
      'tile_floor_token_center_0514',
      'tile_rug_0309',
      'tile_rug_0313',
      'tile_rug_0330',
    ]);
  }),

  test('local indoor coordinates use room template origins', () => {
    assert.deepEqual(toActualIndoorMapPosition('token_center', 1, 2), { mapX: 4, mapY: 5 });
    assert.deepEqual(toLocalIndoorMapPosition('token_center', 4, 5), { localX: 1, localY: 2 });
  }),

  test('indoor asset catalog includes placeable objects and tile brushes', () => {
    assert.ok(getIndoorEditorAssets().some((asset) => asset.category === 'indoor.furniture'));
    assert.equal(getAsset('furniture_birth_house_bed')?.src, 'assets/indoor/furniture/observer-house/bed.png');
    assert.equal(getAsset('character_dashixiong')?.src, 'assets/indoor/characters/dashixiong.png');
    assert.ok(getIndoorTileBrushAssets().some((asset) => asset.textureKey === 'smap_9514'));
  }),
];
