import { ARENA_SIZE } from '../../config';
import type { BattlePerson, BattleResult, WugongDef } from '../../types';
import type { BattleSkillVisualDef } from '../../content/BattleSkillVisuals';

export type BattleGridPos = { x: number; y: number };

const ORTHOGONAL_DIRS: Array<[number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export function manhattanDist(a: BattleGridPos, b: BattleGridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isInAttackRange(from: BattleGridPos, target: BattleGridPos, range: number): boolean {
  return manhattanDist(from, target) <= range;
}

export function calcAttackRange(pos: BattleGridPos, range: number): BattleGridPos[] {
  const result: BattleGridPos[] = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (!isInsideArena(nx, ny)) continue;
      result.push({ x: nx, y: ny });
    }
  }
  return result;
}

export function getPersonAt(persons: BattlePerson[], x: number, y: number): BattlePerson | undefined {
  return persons.find((person) => person.alive && person.pos.x === x && person.pos.y === y);
}

export function getEnemy(person: BattlePerson, persons: BattlePerson[]): BattlePerson | undefined {
  const enemyTeam = person.team === 'red' ? 'blue' : 'red';
  return persons.find((candidate) => candidate.team === enemyTeam && candidate.alive);
}

export function calcMoveRange(pos: BattleGridPos, range: number, persons: BattlePerson[]): BattleGridPos[] {
  const visited = new Set<string>();
  const result: BattleGridPos[] = [];
  const queue: Array<BattleGridPos & { steps: number }> = [{ ...pos, steps: 0 }];
  visited.add(posKey(pos));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    result.push({ x: cur.x, y: cur.y });
    if (cur.steps >= range) continue;

    for (const [dx, dy] of ORTHOGONAL_DIRS) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const key = posKey(next);
      if (!isInsideArena(next.x, next.y) || visited.has(key)) continue;
      if (isOccupied(next, persons)) continue;
      visited.add(key);
      queue.push({ ...next, steps: cur.steps + 1 });
    }
  }

  return result;
}

export function calcMovePath(person: BattlePerson, target: BattleGridPos, persons: BattlePerson[]): BattleGridPos[] {
  if (person.pos.x === target.x && person.pos.y === target.y) return [];

  const startKey = posKey(person.pos);
  const targetKey = posKey(target);
  const visited = new Set<string>([startKey]);
  const prev = new Map<string, string>();
  const queue: BattleGridPos[] = [{ ...person.pos }];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (posKey(cur) === targetKey) break;

    for (const [dx, dy] of ORTHOGONAL_DIRS) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const key = posKey(next);
      if (!isInsideArena(next.x, next.y) || visited.has(key)) continue;
      if (isOccupied(next, persons, person.id)) continue;
      visited.add(key);
      prev.set(key, posKey(cur));
      queue.push(next);
    }
  }

  if (!visited.has(targetKey)) return [];
  const reversed: BattleGridPos[] = [];
  let curKey = targetKey;
  while (curKey !== startKey) {
    const [x, y] = curKey.split(',').map(Number);
    reversed.push({ x, y });
    const parent = prev.get(curKey);
    if (!parent) return [];
    curKey = parent;
  }
  return reversed.reverse();
}

export function calcBattleDamage(
  attacker: BattlePerson,
  defender: BattlePerson,
  skill: WugongDef,
  effectiveSkillPower: number,
  random = Math.random,
): { damage: number; hit: boolean } {
  const hitRoll = random() * 100;
  if (hitRoll >= skill.hitRate) return { damage: 0, hit: false };

  const atk = attacker.attack;
  const def = defender.defense;
  const base = effectiveSkillPower * atk / (atk + def + 50);
  const randomMod = 0.85 + random() * 0.30;
  return { damage: Math.max(1, Math.round(base * randomMod)), hit: true };
}

export function checkBattleEnd(persons: BattlePerson[], round: number): BattleResult | null {
  const redAlive = persons.find((person) => person.team === 'red' && person.alive);
  const blueAlive = persons.find((person) => person.team === 'blue' && person.alive);

  if (!redAlive) {
    const winner = persons.find((person) => person.team === 'blue')!;
    const loser = persons.find((person) => person.team === 'red')!;
    return { winnerId: winner.id, winnerName: winner.name, loserId: loser.id, loserName: loser.name, rounds: round };
  }
  if (!blueAlive) {
    const winner = persons.find((person) => person.team === 'red')!;
    const loser = persons.find((person) => person.team === 'blue')!;
    return { winnerId: winner.id, winnerName: winner.name, loserId: loser.id, loserName: loser.name, rounds: round };
  }
  return null;
}

export function uniqueSkills(skills: WugongDef[]): WugongDef[] {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    if (seen.has(skill.id)) return false;
    seen.add(skill.id);
    return true;
  });
}

export function getSkillAreaSize(skill: WugongDef, visual: BattleSkillVisualDef): number {
  if (visual.targetMode === 'single') return 1;
  return Math.max(1, skill.aoeSize ?? 1);
}

function isInsideArena(x: number, y: number): boolean {
  return x >= 0 && x < ARENA_SIZE && y >= 0 && y < ARENA_SIZE;
}

function isOccupied(pos: BattleGridPos, persons: BattlePerson[], exceptPersonId?: string): boolean {
  return persons.some((person) => (
    person.id !== exceptPersonId && person.alive && person.pos.x === pos.x && person.pos.y === pos.y
  ));
}

function posKey(pos: BattleGridPos): string {
  return `${pos.x},${pos.y}`;
}
