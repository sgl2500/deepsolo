import { assert, test, type TestCase } from './test_utils';
import { getBattleSkillEffect } from '../../src/content/BattleSkillEffectCatalog';

export const tests: TestCase[] = [
  test('normal attack resolves to melee normal presentation', () => {
    const effect = getBattleSkillEffect({ id: 'normal_attack', type: 'normal' });

    assert.equal(effect.presentation, 'melee_normal');
    assert.equal(effect.textureKey, null);
  }),

  test('inner and martial skills default to melee wugong presentation', () => {
    const inner = getBattleSkillEffect({ id: 'unknown_inner', type: 'inner' });
    const martial = getBattleSkillEffect({ id: 'unknown_martial', type: 'martial' });

    assert.equal(inner.presentation, 'melee_wugong');
    assert.equal(martial.presentation, 'melee_wugong');
    assert.equal(inner.textureKey, 'battle_effect_martial_palm');
  }),

  test('strategy skills default to ranged strategy presentation', () => {
    const effect = getBattleSkillEffect({ id: 'unknown_strategy', type: 'strategy' });

    assert.equal(effect.presentation, 'ranged_strategy');
    assert.equal(effect.textureKey, 'battle_effect_strategy_projectile');
  }),

  test('known digital master skills use ranged strategy presentation', () => {
    const deduction = getBattleSkillEffect({ id: 'live_strategy_deduction', type: 'strategy' });
    const heartbeat = getBattleSkillEffect({ id: 'btc_heartbeat', type: 'strategy' });

    assert.equal(deduction.presentation, 'ranged_strategy');
    assert.equal(heartbeat.presentation, 'ranged_strategy');
    assert.ok(heartbeat.hitBurstScale > deduction.hitBurstScale);
  }),
];
