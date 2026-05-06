import { assert, test, type TestCase } from './test_utils';
import type { BattlePerson, WugongDef } from '../../src/types';
import {
  calcAttackRange,
  calcBattleDamage,
  calcMovePath,
  calcMoveRange,
  checkBattleEnd,
  uniqueSkills,
} from '../../src/systems/battle/BattleRules';

function person(id: string, team: 'red' | 'blue', x: number, y: number, alive = true): BattlePerson {
  return {
    id,
    name: id,
    team,
    existenceTier: 1,
    hp: alive ? 100 : 0,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    attack: 100,
    defense: 50,
    hitRate: 10,
    dodgeRate: 10,
    speed: 10,
    moveRange: 3,
    pos: { x, y },
    alive,
    facing: 0,
    wugong: skill('basic', 1),
  } as BattlePerson;
}

function skill(id: string, range: number): WugongDef {
  return {
    id,
    name: id,
    power: 100,
    mpCost: 0,
    attackRange: range,
    hitRate: 80,
  } as WugongDef;
}

export const tests: TestCase[] = [
  test('calcAttackRange clips to arena edges', () => {
    const cells = calcAttackRange({ x: 0, y: 0 }, 1);
    assert.deepEqual(cells, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  }),

  test('calcMoveRange excludes occupied cells but includes reachable detours', () => {
    const actor = person('actor', 'red', 0, 0);
    const blocker = person('blocker', 'blue', 1, 0);
    const cells = calcMoveRange(actor.pos, 2, [actor, blocker]);
    assert.equal(cells.some((cell) => cell.x === 1 && cell.y === 0), false);
    assert.equal(cells.some((cell) => cell.x === 1 && cell.y === 1), true);
    assert.equal(cells.some((cell) => cell.x === 0 && cell.y === 2), true);
  }),

  test('calcMovePath routes around blockers', () => {
    const actor = person('actor', 'red', 0, 0);
    const blocker = person('blocker', 'blue', 1, 0);
    const path = calcMovePath(actor, { x: 2, y: 0 }, [actor, blocker]);
    assert.deepEqual(path.at(-1), { x: 2, y: 0 });
    assert.equal(path.some((cell) => cell.x === 1 && cell.y === 0), false);
    assert.equal(path.length, 4);
  }),

  test('calcBattleDamage is deterministic when random is injected', () => {
    const attacker = person('attacker', 'red', 0, 0);
    const defender = person('defender', 'blue', 0, 1);
    const attack = skill('strike', 1);
    const rolls = [0.1, 0.5];
    const result = calcBattleDamage(attacker, defender, attack, 100, () => rolls.shift() ?? 0);
    assert.deepEqual(result, { damage: 170, hit: true });
  }),

  test('calcBattleDamage can miss before damage roll', () => {
    const result = calcBattleDamage(person('a', 'red', 0, 0), person('d', 'blue', 0, 1), skill('strike', 1), 100, () => 0.99);
    assert.deepEqual(result, { damage: 0, hit: false });
  }),

  test('calcBattleDamage lets dodge offset hit chance', () => {
    const attacker = { ...person('a', 'red', 0, 0), hitRate: 10 };
    const defender = { ...person('d', 'blue', 0, 1), dodgeRate: 20 };
    const result = calcBattleDamage(attacker, defender, skill('strike', 1), 100, () => 0.75);
    assert.deepEqual(result, { damage: 0, hit: false });
  }),

  test('checkBattleEnd reports surviving team', () => {
    const result = checkBattleEnd([person('hero', 'red', 0, 0), person('foe', 'blue', 1, 1, false)], 7);
    assert.equal(result?.winnerId, 'hero');
    assert.equal(result?.loserId, 'foe');
    assert.equal(result?.rounds, 7);
  }),

  test('uniqueSkills keeps first occurrence order', () => {
    const a = skill('a', 1);
    const b = skill('b', 2);
    assert.deepEqual(uniqueSkills([a, b, a]).map((item) => item.id), ['a', 'b']);
  }),
];
