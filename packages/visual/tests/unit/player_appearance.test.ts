import { Direction } from '../../src/types';
import {
  DEFAULT_PLAYER_APPEARANCE_ID,
  getPlayerAppearance,
  PLAYER_APPEARANCES,
} from '../../src/content/PlayerAppearanceCatalog';
import { getPlayerAppearanceFrame } from '../../src/systems/player/PlayerSpriteAnimator';
import { assert, test, type TestCase } from './test_utils';

export const tests: TestCase[] = [
  test('catalog exposes selectable player appearances', () => {
    assert.ok(PLAYER_APPEARANCES.length >= 1);
    assert.equal(getPlayerAppearance('missing').id, DEFAULT_PLAYER_APPEARANCE_ID);
    assert.equal(getPlayerAppearance(DEFAULT_PLAYER_APPEARANCE_ID).textureKey, 'player3_iso_five_view_pseudo_walk');
  }),

  test('sprite animator maps direction and frame through appearance definitions', () => {
    const player3 = getPlayerAppearance(DEFAULT_PLAYER_APPEARANCE_ID);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 0), 0);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 1), 1);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 3), 3);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Up, 10), 4);
  }),
];
