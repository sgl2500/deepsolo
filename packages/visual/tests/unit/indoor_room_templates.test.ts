import { assert, test, type TestCase } from './test_utils';
import {
  getIndoorEditableTileRegions,
  getIndoorRoomTemplate,
  isIndoorTileEditable,
} from '../../src/content/IndoorRoomTemplates';
import { toActualIndoorMapPosition, toLocalIndoorMapPosition } from '../../src/content/IndoorFurnitureLayout';
import { getIndoorFurnitureDefs } from '../../src/content/IndoorFurnitureLayout';
import { getIndoorCharacterDefs } from '../../src/content/IndoorCharacterLayout';
import { getAsset, getIndoorEditorAssets, getIndoorTileBrushAssets } from '../../src/content/AssetCatalog';
import { BUILDINGS } from '../../src/data/BuildingData';

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

  test('automated building registry wires world building, room template, and starter furniture', () => {
    const building = BUILDINGS.find((item) => item.id === 'player_manor');
    if (!building) {
      assert.equal(getIndoorRoomTemplate('player_manor'), null);
      return;
    }
    assert.equal(building?.indoorMapKey, 'indoor_player_manor');
    assert.equal(getIndoorRoomTemplate('player_manor')?.mapKey, 'indoor_player_manor');
    assert.equal(isIndoorTileEditable('player_manor', 'floor', 4, 4), true);
    assert.ok(getIndoorFurnitureDefs('player_manor').some((item) => item.id === 'starter_table'));
  }),

  test('digital sect reuses token center room layout and placements', () => {
    const building = BUILDINGS.find((item) => item.id === 'digital_sect');
    assert.ok(building);
    assert.equal(building?.name, '数字');
    assert.equal(building?.entryX, 17.7);
    assert.equal(building?.entryY, 12.1);
    assert.equal(building?.indoorMapKey, 'indoor_digital_sect');
    assert.equal(getIndoorRoomTemplate('digital_sect')?.mapKey, 'indoor_digital_sect');
    assert.equal(isIndoorTileEditable('digital_sect', 'floor', 36, 36), true);
    assert.equal(getIndoorFurnitureDefs('digital_sect').length, getIndoorFurnitureDefs('token_center').length);
    assert.equal(getIndoorCharacterDefs('digital_sect').length, 3);
    assert.ok(getIndoorCharacterDefs('digital_sect').every((item) => item.id !== 'digital_sect_shishu'));
  }),
];
