import type { BattleResult } from '../../types';
import type { SideBattleActor, SideBattleDamageResult, SideBattleSkill } from './SideBattleTypes';

export function clampPct(value: number): number {
  return Math.max(5, Math.min(98, value));
}

export function sortTurnOrder(actors: SideBattleActor[]): SideBattleActor[] {
  return [...actors]
    .filter(actor => actor.alive)
    .sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name));
}

export function getOpponent(actor: SideBattleActor, actors: SideBattleActor[]): SideBattleActor | null {
  return actors.find(item => item.side !== actor.side && item.alive) ?? null;
}

export function canUseSkill(actor: SideBattleActor, skill: SideBattleSkill): boolean {
  return actor.alive && actor.mp >= skill.mpCost;
}

export function resolveSideBattleDamage(
  actor: SideBattleActor,
  target: SideBattleActor,
  skill: SideBattleSkill,
  random: () => number = Math.random,
): SideBattleDamageResult {
  if (!canUseSkill(actor, skill)) {
    return { hit: false, damage: 0, shieldDamage: 0, targetShield: target.shield, crit: false, targetHp: target.hp };
  }

  const hitChance = clampPct(actor.hitRate + skill.hitRate - 100 - target.dodgeRate * 0.35);
  const hit = random() * 100 <= hitChance;
  if (!hit) {
    actor.mp = Math.max(0, actor.mp - skill.mpCost);
    return { hit: false, damage: 0, shieldDamage: 0, targetShield: target.shield, crit: false, targetHp: target.hp };
  }

  const critChance = clampPct(5 + (actor.speed - target.speed) * 0.08);
  const crit = random() * 100 <= critChance;
  const variance = 0.9 + random() * 0.2;
  const base = actor.attack * (skill.power / 100);
  const mitigation = target.defense * (target.defending ? 0.72 : 0.45);
  const defendMultiplier = target.defending ? 0.55 : 1;
  const critMultiplier = crit ? 1.45 : 1;
  const incomingDamage = Math.max(1, Math.round((base - mitigation) * variance * defendMultiplier * critMultiplier));
  const shieldDamage = Math.min(target.shield, incomingDamage);
  const damage = incomingDamage - shieldDamage;

  actor.mp = Math.max(0, actor.mp - skill.mpCost);
  target.shield = Math.max(0, target.shield - shieldDamage);
  target.hp = Math.max(0, target.hp - damage);
  target.alive = target.hp > 0;

  return { hit: true, damage, shieldDamage, targetShield: target.shield, crit, targetHp: target.hp };
}

export function applyDefense(actor: SideBattleActor): void {
  actor.defending = true;
  actor.mp = Math.min(actor.maxMp, actor.mp + 8);
  if (actor.maxShield > 0) {
    actor.shield = Math.min(actor.maxShield, actor.shield + Math.max(8, Math.round(actor.defense * 0.12)));
  }
}

export function clearTurnDefense(actor: SideBattleActor): void {
  actor.defending = false;
}

export function checkSideBattleEnd(actors: SideBattleActor[], rounds: number): BattleResult | null {
  const leftAlive = actors.some(actor => actor.side === 'left' && actor.alive);
  const rightAlive = actors.some(actor => actor.side === 'right' && actor.alive);
  if (leftAlive && rightAlive) return null;

  const winner = actors.find(actor => actor.alive);
  const loser = actors.find(actor => !actor.alive);
  if (!winner || !loser) return null;

  return {
    winnerId: winner.id,
    winnerName: winner.name,
    loserId: loser.id,
    loserName: loser.name,
    rounds,
  };
}
