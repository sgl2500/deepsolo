import { assert, test, type TestCase } from './test_utils';
import { SceneState } from '../../src/types';
import {
  createIndoorPlayerLocation,
  createWorldPlayerLocation,
  getPlayerLocationSignature,
  normalizePlayerLocation,
} from '../../src/core/PlayerLocationPersistence';

export const tests: TestCase[] = [
  test('normalizes world map resume location', () => {
    const location = normalizePlayerLocation({
      version: 1,
      scene: SceneState.WorldMap,
      x: 42.5,
      y: 66.25,
      updatedAt: 123,
    });

    assert.deepEqual(location, {
      version: 1,
      scene: SceneState.WorldMap,
      x: 42.5,
      y: 66.25,
      updatedAt: 123,
    });
  }),

  test('normalizes indoor resume location with return world position', () => {
    const location = normalizePlayerLocation({
      version: 1,
      scene: SceneState.Indoor,
      buildingId: 'digital_house',
      x: 18,
      y: 24,
      worldX: 50,
      worldY: 41,
      updatedAt: 456,
    });

    assert.equal(location?.scene, SceneState.Indoor);
    assert.equal(location?.buildingId, 'digital_house');
    assert.equal(location?.x, 18);
    assert.equal(location?.worldX, 50);
  }),

  test('rejects unstable or invalid resume locations', () => {
    assert.equal(normalizePlayerLocation({ scene: SceneState.Battle, x: 1, y: 2 }), null);
    assert.equal(normalizePlayerLocation({ scene: SceneState.Indoor, x: 1, y: 2 }), null);
    assert.equal(normalizePlayerLocation({ scene: SceneState.WorldMap, x: Infinity, y: 2 }), null);
  }),

  test('location signatures ignore updatedAt and round movement noise', () => {
    const first = createWorldPlayerLocation(10.123, 20.456)!;
    const second = { ...first, x: 10.124, y: 20.457, updatedAt: first.updatedAt + 1000 };
    assert.equal(getPlayerLocationSignature(first), getPlayerLocationSignature(second));

    const indoor = createIndoorPlayerLocation('birth_house', 15, 16, 50, 51)!;
    assert.match(getPlayerLocationSignature(indoor), /indoor:birth_house:15\.00:16\.00:50\.00:51\.00/);
  }),
];
