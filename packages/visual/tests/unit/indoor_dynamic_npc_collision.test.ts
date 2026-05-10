import { assert, test, type TestCase } from './test_utils';
import {
  clearIndoorDynamicNpcColliders,
  isBlockedByIndoorDynamicNpc,
  removeIndoorDynamicNpcColliders,
  setIndoorDynamicNpcColliders,
  upsertIndoorDynamicNpcColliders,
} from '../../src/content/IndoorDynamicNpcCollision';

export const tests: TestCase[] = [
  test('dynamic strategy NPCs block indoor player movement near their map position', () => {
    clearIndoorDynamicNpcColliders();
    setIndoorDynamicNpcColliders('digital_sect', [{
      id: 'digital_master',
      buildingId: 'digital_sect',
      x: 26,
      y: 17,
    }]);

    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 26, 17), true);
    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 27.2, 17), false);
    assert.equal(isBlockedByIndoorDynamicNpc('teahouse', 26, 17), false);
    clearIndoorDynamicNpcColliders();
  }),

  test('dynamic NPC collider upserts let story and strategy actors coexist', () => {
    clearIndoorDynamicNpcColliders();
    upsertIndoorDynamicNpcColliders('digital_sect', [{
      id: 'digital_master',
      buildingId: 'digital_sect',
      x: 26,
      y: 17,
    }]);
    upsertIndoorDynamicNpcColliders('digital_sect', [{
      id: 'story_guard',
      buildingId: 'digital_sect',
      x: 20,
      y: 12,
    }]);

    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 26, 17), true);
    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 20, 12), true);

    removeIndoorDynamicNpcColliders('digital_sect', ['digital_master']);
    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 26, 17), false);
    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 20, 12), true);
    clearIndoorDynamicNpcColliders();
  }),

  test('rectangular runtime actor colliders block against their edited bounds', () => {
    clearIndoorDynamicNpcColliders();
    upsertIndoorDynamicNpcColliders('digital_sect', [{
      id: 'wide_guard',
      buildingId: 'digital_sect',
      x: 10,
      y: 10,
      width: 2,
      height: 0.6,
    }]);

    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 11.3, 10), true);
    assert.equal(isBlockedByIndoorDynamicNpc('digital_sect', 12, 10), false);
    clearIndoorDynamicNpcColliders();
  }),
];
