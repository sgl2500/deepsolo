import { assert, test, type TestCase } from './test_utils';
import {
  BATTLE_BACKGROUND_ASSETS,
  BATTLE_CHARACTER_STANCES,
  BATTLE_EFFECT_ASSETS,
} from '../../src/content/BattleAssetCatalog';
import {
  BATTLE_SPINE_ACTIONS,
  getBattleSpineAction,
  getBattleSpineAssets,
  getBattleSpineHitDelayMs,
  getBattleSpineVisualForActor,
} from '../../src/content/BattleSpineCatalog';

export const tests: TestCase[] = [
  test('battle character stance contract stays stable for side battle state machine', () => {
    assert.deepEqual(BATTLE_CHARACTER_STANCES, ['idle', 'run', 'attack', 'hit', 'defense', 'dead']);
  }),

  test('battle preload catalog keeps only shared backgrounds and effects outside Spine', () => {
    assert.ok(BATTLE_BACKGROUND_ASSETS.some(asset => asset.key === 'battle_background_digital_sect_duel'));
    assert.ok(BATTLE_EFFECT_ASSETS.some(asset => asset.key === 'battle_effect_hit_burst'));
    assert.ok(!BATTLE_EFFECT_ASSETS.some(asset => asset.src.includes('/actors/role')));
  }),

  test('spine battle catalog exposes all role77 and role148 actions', () => {
    assert.equal(BATTLE_SPINE_ACTIONS.length, 36);
    assert.equal(getBattleSpineAction('player', 'idle'), 'idle');
    assert.equal(getBattleSpineAction('player', 'attack'), 'skill_combo1');
    assert.equal(getBattleSpineAction('digital_master', 'defense'), 'idlesquat');
    assert.equal(getBattleSpineAction('digital_master', 'dead'), 'die');
    assert.equal(getBattleSpineHitDelayMs('digital_master', 'attack'), 610);

    const visual = getBattleSpineVisualForActor('digital_master');
    assert.equal(visual?.dataKey, 'battle_spine_role148_json');
    assert.equal(visual?.atlasKey, 'battle_spine_role148_atlas');
    assert.equal(visual?.actions.length, 36);
  }),

  test('spine battle assets point to compact role77 and role148 runtime files', () => {
    const spineAssets = getBattleSpineAssets();
    const keys = spineAssets.flatMap(asset => [asset.dataKey, asset.atlasKey]);
    const uniqueKeys = new Set(keys);

    assert.equal(spineAssets.length, 2);
    assert.equal(uniqueKeys.size, keys.length);
    assert.ok(spineAssets.some(asset => asset.dataKey === 'battle_spine_role77_json'));
    assert.ok(spineAssets.some(asset => asset.atlasKey === 'battle_spine_role148_atlas'));
    assert.ok(spineAssets.every(asset => !asset.premultipliedAlpha));
    assert.ok(spineAssets.some(asset => asset.jsonSrc.includes('assets/battle/spine/role77/role77.json')));
    assert.ok(spineAssets.some(asset => asset.atlasSrc.includes('assets/battle/spine/role148/role148.atlas')));
  }),
];
