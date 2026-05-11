import { WugongType, type PlayerProgress, type WugongDef } from '../../types';
import type { SideBattleSkill, SideBattleSkillType } from '../../systems/sidebattle/SideBattleTypes';
import { ENABLE_MARTIAL_DEBUG_LOADOUT } from '../../config';
import { getMartialPowerMultiplier } from '../PlayerMartialArts';
import { getAllMartialArtDefs, getMartialArtDef } from './MartialCodex';
import { getMartialMasteryStage } from './MartialEffectCatalog';
import { getMartialEffectForBattle } from './MartialEffectBindings';
import type { MartialArtDef, MartialCategory } from './MartialTypes';

const CATEGORY_TO_WUGONG_TYPE: Record<MartialCategory, WugongType> = {
  fist: WugongType.Fist,
  leg: WugongType.Fist,
  sword: WugongType.Sword,
  blade: WugongType.Blade,
  inner: WugongType.Neigong,
  ultimate: WugongType.Special,
};

const CATEGORY_TO_SIDE_TYPE: Record<MartialCategory, SideBattleSkillType> = {
  fist: 'martial',
  leg: 'martial',
  sword: 'martial',
  blade: 'martial',
  inner: 'inner',
  ultimate: 'martial',
};

export function getMartialLevel(progress: PlayerProgress, martialId: string): number {
  if (ENABLE_MARTIAL_DEBUG_LOADOUT) return 10;
  const martial = progress.martials.find(item => item.martialId === martialId);
  return Math.max(1, Math.min(10, martial?.level ?? 1));
}

export function getUnlockedCombatMartialArts(progress: PlayerProgress): MartialArtDef[] {
  if (ENABLE_MARTIAL_DEBUG_LOADOUT) return getAllMartialArtDefs();
  const learnedManuals = new Set(progress.manuals.filter(item => item.learned).map(item => item.manualId));
  const progressed = new Set(progress.martials.map(item => item.martialId));
  return getAllMartialArtDefs().filter((art) => {
    if (progressed.has(art.id)) return true;
    const manualIds = art.unlock?.manualIds ?? [];
    return manualIds.some(id => learnedManuals.has(id));
  });
}

export function getMartialEffectivePower(art: MartialArtDef, level: number): number {
  const base = art.combat.basePower + Math.max(0, level - 1) * art.combat.powerGrowth;
  return Math.round(base * getMartialPowerMultiplier(level));
}

export function toTacticalWugongDef(martialId: string, level: number): WugongDef | null {
  const art = getMartialArtDef(martialId);
  if (!art) return null;
  const effect = getMartialEffectForBattle({ martialId, level, mode: 'tactical' });
  return {
    id: art.id,
    name: art.name,
    type: CATEGORY_TO_WUGONG_TYPE[art.category],
    mpCost: art.combat.mpCost,
    power: getMartialEffectivePower(art, level),
    hitRate: art.combat.hitRate,
    attackRange: art.tactical.range,
    effectId: effect?.tacticalEffectId ?? '003',
    aoeSize: art.tactical.aoeSize,
  };
}

export function toSideBattleSkill(martialId: string, level: number): SideBattleSkill | null {
  const art = getMartialArtDef(martialId);
  if (!art) return null;
  const effect = getMartialEffectForBattle({ martialId, level, mode: 'horizontal' });
  return {
    id: art.id,
    martialId: art.id,
    martialLevel: level,
    masteryStage: getMartialMasteryStage(level),
    name: `${art.name} Lv.${level}`,
    type: CATEGORY_TO_SIDE_TYPE[art.category],
    mpCost: art.combat.mpCost,
    power: getMartialEffectivePower(art, level),
    hitRate: art.combat.hitRate,
    description: `${art.name} · ${effect?.label ?? art.description}`,
    flavor: art.flavor,
    target: art.combat.target,
    spineAction: art.horizontal.spineAction,
    hitDelayMs: art.horizontal.hitDelayMs,
  };
}
