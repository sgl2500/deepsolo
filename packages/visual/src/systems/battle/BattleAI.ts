import type { BattleAction, BattlePerson } from '../../types';
import { NORMAL_ATTACK } from '../../data/BattleData';
import { calcMoveRange, getEnemy, manhattanDist } from './BattleRules';

export function decideBattleAI(person: BattlePerson, persons: BattlePerson[]): BattleAction {
  const enemy = getEnemy(person, persons);
  if (!enemy) return { type: 'move', target: { ...person.pos } };

  const dist = manhattanDist(person.pos, enemy.pos);
  if (dist <= person.wugong.attackRange) {
    if (person.mp >= person.wugong.mpCost) {
      return { type: 'attack', skill: person.wugong, targetId: enemy.id };
    }
    return { type: 'attack', skill: NORMAL_ATTACK, targetId: enemy.id };
  }

  const reachable = calcMoveRange(person.pos, person.moveRange, persons);
  let best = person.pos;
  let bestScore = Infinity;
  for (const pos of reachable) {
    const nextDist = manhattanDist(pos, enemy.pos);
    // Prefer the farthest cell that can still hit, so ranged skills do not always hug targets.
    const inRange = nextDist <= person.wugong.attackRange;
    const score = inRange
      ? Math.abs(nextDist - person.wugong.attackRange) - 100
      : nextDist;
    if (score < bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  return { type: 'move', target: best };
}
