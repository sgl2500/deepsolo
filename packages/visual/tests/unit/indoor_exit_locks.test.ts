import { assert, test, type TestCase } from './test_utils';
import {
  BIRTH_HOUSE_LOCKED_EXIT_MAX_Y,
  isBlockedByLockedIndoorExit,
} from '../../src/content/IndoorExitLocks';

export const tests: TestCase[] = [
  test('birth house locked intro exit blocks only past the doorway threshold', () => {
    assert.equal(
      isBlockedByLockedIndoorExit('birth_house', true, 12.5, BIRTH_HOUSE_LOCKED_EXIT_MAX_Y - 0.01),
      false,
    );
    assert.equal(
      isBlockedByLockedIndoorExit('birth_house', true, 12.5, BIRTH_HOUSE_LOCKED_EXIT_MAX_Y + 0.01),
      true,
    );
  }),

  test('birth house exit lock is disabled after observer intro is complete', () => {
    assert.equal(isBlockedByLockedIndoorExit('birth_house', false, 12.5, 24), false);
  }),

  test('indoor exit lock does not affect other rooms', () => {
    assert.equal(isBlockedByLockedIndoorExit('exchange', true, 12.5, 24), false);
    assert.equal(isBlockedByLockedIndoorExit(null, true, 12.5, 24), false);
  }),
];
