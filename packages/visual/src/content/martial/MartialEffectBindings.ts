import { resolveMartialEffect } from './MartialEffectCatalog';
import type { MartialBattleMode, ResolvedMartialEffect } from './MartialTypes';

export const MARTIAL_EFFECT_BINDINGS: Record<string, string> = {
  taizu_changquan: 'effect_fist_impact',
  taiji_quan: 'effect_taiji_circle',
  tiancan_leg: 'effect_leg_heavy',
  shadowless_leg: 'effect_leg_shadow',
  songfeng_sword: 'effect_sword_breeze',
  dugu_jiujian: 'effect_dugu_sword',
  gale_blade: 'effect_gale_blade',
  xueyin_blade: 'effect_xueyin_blade',
  tuna_intro: 'effect_inner_breath',
  golden_bell: 'effect_golden_bell',
  taishan_pressure: 'effect_taishan_pressure',
};

export function getBoundMartialEffectId(martialId: string): string | undefined {
  return MARTIAL_EFFECT_BINDINGS[martialId];
}

export function getMartialEffectForBattle(input: {
  martialId: string;
  level: number;
  mode: MartialBattleMode;
}): ResolvedMartialEffect | null {
  const effectId = getBoundMartialEffectId(input.martialId);
  if (!effectId) return null;
  const effect = resolveMartialEffect(input.martialId, effectId, input.level);
  if (!effect) return null;

  // Both battle modes share the same mastery selection. The mode hook is kept so
  // future renderers can override width, anchor, or resources without touching skills.
  if (input.mode === 'tactical') return { ...effect };
  return { ...effect };
}
