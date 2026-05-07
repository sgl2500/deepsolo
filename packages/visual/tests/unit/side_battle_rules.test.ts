import { assert, test, type TestCase } from './test_utils';
import {
  applyDefense,
  checkSideBattleEnd,
  resolveSideBattleDamage,
  sortTurnOrder,
} from '../../src/systems/sidebattle/SideBattleRules';
import type { SideBattleActor, SideBattleSkill } from '../../src/systems/sidebattle/SideBattleTypes';

const SKILL: SideBattleSkill = {
  id: 'strike',
  name: '横版一击',
  type: 'normal',
  mpCost: 5,
  power: 100,
  hitRate: 100,
  description: '测试技能',
  target: 'enemy',
};

function actor(id: string, side: 'left' | 'right', speed = 10): SideBattleActor {
  return {
    id,
    name: id,
    side,
    hp: 100,
    maxHp: 100,
    shield: 0,
    maxShield: 0,
    mp: 50,
    maxMp: 50,
    attack: 80,
    defense: 20,
    speed,
    hitRate: 100,
    dodgeRate: 0,
    evolutionStacks: 0,
    skills: [SKILL],
    defending: false,
    alive: true,
  };
}

export const tests: TestCase[] = [
  test('sortTurnOrder prioritizes speed', () => {
    const slow = actor('slow', 'left', 8);
    const fast = actor('fast', 'right', 20);
    assert.deepEqual(sortTurnOrder([slow, fast]).map(item => item.id), ['fast', 'slow']);
  }),

  test('resolveSideBattleDamage spends mp and damages target on hit', () => {
    const attacker = actor('attacker', 'left');
    const defender = actor('defender', 'right');
    const result = resolveSideBattleDamage(attacker, defender, SKILL, () => 0);

    assert.equal(result.hit, true);
    assert.equal(attacker.mp, 45);
    assert.ok(result.damage > 0);
    assert.equal(defender.hp, 100 - result.damage);
  }),

  test('defense reduces incoming damage and restores mp', () => {
    const attacker = actor('attacker', 'left');
    const normalTarget = actor('normal', 'right');
    const defendedTarget = actor('defended', 'right');
    defendedTarget.mp = 10;

    const normal = resolveSideBattleDamage(attacker, normalTarget, SKILL, () => 0.5);
    applyDefense(defendedTarget);
    const defended = resolveSideBattleDamage(actor('attacker2', 'left'), defendedTarget, SKILL, () => 0.5);

    assert.equal(defendedTarget.mp, 18);
    assert.ok(defended.damage < normal.damage);
  }),

  test('shield absorbs damage before hp', () => {
    const attacker = actor('attacker', 'left');
    const defender = actor('defender', 'right');
    defender.shield = 30;
    defender.maxShield = 30;

    const result = resolveSideBattleDamage(attacker, defender, SKILL, () => 0.5);

    assert.equal(result.shieldDamage, 30);
    assert.equal(defender.shield, 0);
    assert.equal(defender.hp, 100 - result.damage);
  }),

  test('checkSideBattleEnd reports winner and loser', () => {
    const winner = actor('winner', 'left');
    const loser = actor('loser', 'right');
    loser.hp = 0;
    loser.alive = false;

    const result = checkSideBattleEnd([winner, loser], 3);
    assert.equal(result?.winnerId, 'winner');
    assert.equal(result?.loserId, 'loser');
    assert.equal(result?.rounds, 3);
  }),
];
