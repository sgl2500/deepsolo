import { assert, test, type TestCase } from './test_utils';
import {
  IndoorCoordinateMapper,
  normalizeFurnitureCollider,
  normalizeInteractableZone,
  roundEditorValue,
} from '../../src/systems/map/IndoorCoordinateMapper';
import type { IndoorInteractableDef } from '../../src/types';
import type { IndoorFurnitureDef } from '../../src/content/IndoorFurnitureLayout';

export const tests: TestCase[] = [
  test('mapToScreen maps room center to screen center', () => {
    const mapper = new IndoorCoordinateMapper(() => ({ cx: 10, cy: 20 }), () => ({ x: 0, y: 0 }));
    assert.deepEqual(mapper.mapToScreen(10, 20), { x: 640, y: 360 });
    assert.deepEqual(mapper.mapToScreen(11, 20), { x: 676, y: 378 });
  }),

  test('screenToMap is inverse of mapToScreen', () => {
    const mapper = new IndoorCoordinateMapper(() => ({ cx: 10, cy: 20 }), () => ({ x: 0, y: 0 }));
    const screen = mapper.mapToScreen(12.5, 17.5);
    const map = mapper.screenToMap(screen.x, screen.y);
    assert.equal(Number(map.mapX.toFixed(6)), 12.5);
    assert.equal(Number(map.mapY.toFixed(6)), 17.5);
  }),

  test('screenToLocal removes container offset and building origin', () => {
    const mapper = new IndoorCoordinateMapper(() => ({ cx: 3, cy: 3 }), () => ({ x: 100, y: -50 }));
    const screen = mapper.mapToScreenWithContainer(4, 5);
    assert.deepEqual(mapper.screenToLocal('birth_house', screen.x, screen.y), { localX: 1, localY: 2 });
  }),

  test('roundEditorValue keeps one decimal', () => {
    assert.equal(roundEditorValue(1.24), 1.2);
    assert.equal(roundEditorValue(1.25), 1.3);
  }),

  test('normalizeFurnitureCollider orders and rounds bounds', () => {
    const furniture = {
      collider: { minLocalX: 5.26, maxLocalX: 1.14, minLocalY: 9.99, maxLocalY: 2.01 },
    } as IndoorFurnitureDef;
    normalizeFurnitureCollider(furniture);
    assert.deepEqual(furniture.collider, { minLocalX: 1.1, maxLocalX: 5.3, minLocalY: 2, maxLocalY: 10 });
  }),

  test('normalizeInteractableZone orders and rounds rect zone', () => {
    const interactable = {
      interactionZone: { type: 'rect', minLocalX: 3.33, maxLocalX: -1.11, minLocalY: 4.44, maxLocalY: 2.22 },
    } as IndoorInteractableDef;
    normalizeInteractableZone(interactable);
    assert.deepEqual(interactable.interactionZone, { type: 'rect', minLocalX: -1.1, maxLocalX: 3.3, minLocalY: 2.2, maxLocalY: 4.4 });
  }),
];
