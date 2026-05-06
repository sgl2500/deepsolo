import { assert, test, type TestCase } from './test_utils';
import { buildStrategyCombatProfile } from '../../src/data/CombatProfile';

export const tests: TestCase[] = [
  test('live strategy with 100% return gets 3000 max hp', () => {
    const profile = buildStrategyCombatProfile({
      returnPct: 100,
      maxDrawdownPct: 20,
      sourceWorkspace: 'crypto',
      existenceTier: 10,
    });

    assert.equal(profile.existenceTier, 10);
    assert.equal(profile.maxHp, 3000);
  }),

  test('non-live strategy with 100% return gets 300 max hp', () => {
    const profile = buildStrategyCombatProfile({
      returnPct: 100,
      maxDrawdownPct: 20,
      sourceWorkspace: undefined,
      existenceTier: 1,
    });

    assert.equal(profile.existenceTier, 1);
    assert.equal(profile.maxHp, 300);
  }),

  test('low drawdown increases constitution and defense', () => {
    const stable = buildStrategyCombatProfile({
      returnPct: 20,
      maxDrawdownPct: 5,
      sourceWorkspace: undefined,
      existenceTier: 1,
    });
    const risky = buildStrategyCombatProfile({
      returnPct: 20,
      maxDrawdownPct: 35,
      sourceWorkspace: undefined,
      existenceTier: 1,
    });

    assert.equal(stable.constitutionBonus, 7);
    assert.equal(stable.constitution, 17);
    assert.equal(stable.defense, 170);
    assert.equal(risky.constitutionBonus, 0);
    assert.equal(risky.defense, 100);
  }),
];
