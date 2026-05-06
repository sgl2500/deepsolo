import { Direction } from '../../src/types';
import { getPlayerAppearance, PLAYER_APPEARANCES } from '../../src/content/PlayerAppearanceCatalog';
import { getPlayerAppearanceFrame } from '../../src/systems/player/PlayerSpriteAnimator';
import { assert, test, type TestCase } from './test_utils';

export const tests: TestCase[] = [
  test('catalog exposes selectable player appearances', () => {
    assert.ok(PLAYER_APPEARANCES.length >= 2);
    assert.equal(getPlayerAppearance('missing').id, 'observer_robed');
    assert.equal(getPlayerAppearance('lpc_swordsman').textureKey, 'lpc_e2');
  }),

  test('sprite animator maps direction and frame through appearance definitions', () => {
    const observer = getPlayerAppearance('observer_robed');
    assert.equal(getPlayerAppearanceFrame(observer, Direction.Down, 0), 21);
    assert.equal(getPlayerAppearanceFrame(observer, Direction.Up, 6), 6);

    const lpc = getPlayerAppearance('lpc_swordsman');
    assert.equal(getPlayerAppearanceFrame(lpc, Direction.Down, 0), 0);
    assert.equal(getPlayerAppearanceFrame(lpc, Direction.Up, 7), 31);

    const player3 = getPlayerAppearance('player3_white_swordsman');
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 0), 0);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 1), 1);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 2), 0);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Down, 3), 2);
    assert.equal(getPlayerAppearanceFrame(player3, Direction.Up, 3), 5);
  }),
];
