import type { MartialEffectDef, MartialEffectStageDef, MartialMasteryStage, ResolvedMartialEffect } from './MartialTypes';

const stage = (
  stage: MartialMasteryStage,
  minLevel: number,
  variant: string,
  label: string,
  scale: number,
  cameraShake: number,
  hitBurstScale: number,
): MartialEffectStageDef => ({
  stage,
  minLevel,
  variant,
  label,
  scale,
  alpha: 1,
  durationMs: 240 + stage * 42,
  particleLevel: stage,
  cameraShake,
  hitBurstScale,
});

const stages = (labels: string[], baseScale = 0.72): MartialEffectStageDef[] => [
  stage(1, 1, 'stage_1', labels[0], baseScale, 0, 0.28),
  stage(2, 3, 'stage_2', labels[1], baseScale + 0.1, 0.015, 0.34),
  stage(3, 5, 'stage_3', labels[2], baseScale + 0.22, 0.035, 0.42),
  stage(4, 7, 'stage_4', labels[3], baseScale + 0.35, 0.065, 0.5),
  stage(5, 10, 'stage_5', labels[4], baseScale + 0.5, 0.1, 0.62),
];

export const MARTIAL_EFFECT_CATALOG: Record<string, MartialEffectDef> = {
  effect_fist_impact: {
    effectId: 'effect_fist_impact',
    resourceKey: 'battle_effect_martial_fist_shadow',
    tacticalEffectId: '003',
    anchor: 'target',
    width: 270,
    height: 148,
    stages: stages(['单点拳劲', '拳风扩散', '双层拳劲', '地面震纹', '金色拳印压出']),
  },
  effect_taiji_circle: {
    effectId: 'effect_taiji_circle',
    resourceKey: 'battle_effect_martial_taiji_circle',
    tacticalEffectId: '004',
    anchor: 'target',
    width: 196,
    height: 128,
    stages: stages(['淡色圆弧', '太极半圆', '完整圆劲', '黑白气旋', '太极图短暂显形'], 0.76),
  },
  effect_leg_heavy: {
    effectId: 'effect_leg_heavy',
    resourceKey: 'battle_effect_martial_leg_heavy',
    tacticalEffectId: '008',
    anchor: 'target',
    width: 218,
    height: 132,
    stages: stages(['重踢尘土', '下压气浪', '裂地冲击', '大范围压迫波', '巨大脚影压顶'], 0.8),
  },
  effect_leg_shadow: {
    effectId: 'effect_leg_shadow',
    resourceKey: 'battle_effect_martial_leg_shadow',
    tacticalEffectId: '006',
    anchor: 'target',
    width: 190,
    height: 116,
    stages: stages(['一道残影', '两段残影', '多段踢影', '连续残影环绕', '目标周身残影爆开'], 0.7),
  },
  effect_sword_breeze: {
    effectId: 'effect_sword_breeze',
    resourceKey: 'battle_effect_martial_sword_breeze',
    tacticalEffectId: '005',
    anchor: 'target',
    width: 182,
    height: 96,
    stages: stages(['细剑弧', '青色剑风', '多道剑风', '风旋剑气', '松风剑阵一闪'], 0.74),
  },
  effect_dugu_sword: {
    effectId: 'effect_dugu_sword',
    resourceKey: 'battle_effect_martial_dugu_sword',
    tacticalEffectId: '009',
    anchor: 'target',
    width: 228,
    height: 118,
    stages: stages(['单道剑意', '破招剑光', '多向剑痕', '剑意裂屏', '九道剑意齐发'], 0.84),
  },
  effect_gale_blade: {
    effectId: 'effect_gale_blade',
    resourceKey: 'battle_effect_martial_gale_blade',
    tacticalEffectId: '007',
    anchor: 'target',
    width: 210,
    height: 102,
    stages: stages(['短刀光', '快速斩线', '多段刀风', '狂风旋斩', '刀风形成风暴'], 0.78),
  },
  effect_xueyin_blade: {
    effectId: 'effect_xueyin_blade',
    resourceKey: 'battle_effect_martial_xueyin_blade',
    tacticalEffectId: '002',
    anchor: 'target',
    width: 238,
    height: 126,
    stages: stages(['冷色刀气', '寒霜斩痕', '冰裂刀光', '寒气扩散', '冰雪重刀斩落'], 0.84),
  },
  effect_inner_breath: {
    effectId: 'effect_inner_breath',
    resourceKey: 'battle_effect_martial_inner_breath',
    tacticalEffectId: '001',
    anchor: 'self',
    width: 168,
    height: 118,
    stages: stages(['轻微气息', '气息环身', '内息流转', '气劲外放', '周身气海成形'], 0.68),
  },
  effect_golden_bell: {
    effectId: 'effect_golden_bell',
    resourceKey: 'battle_effect_martial_golden_bell',
    tacticalEffectId: '001',
    anchor: 'self',
    width: 194,
    height: 148,
    stages: stages(['淡金护光', '金色护罩', '金钟轮廓', '护罩震荡反光', '完整金钟显形'], 0.78),
  },
  effect_taishan_pressure: {
    effectId: 'effect_taishan_pressure',
    resourceKey: 'battle_effect_martial_taishan_pressure',
    tacticalEffectId: '008',
    anchor: 'area',
    width: 260,
    height: 150,
    stages: stages(['地面阴影', '石压气浪', '山影显现', '大范围震地', '巨大山岳压顶'], 0.9),
  },
};

export function getMartialMasteryStage(level: number): MartialMasteryStage {
  if (level >= 10) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

export function getMartialEffectDef(effectId: string): MartialEffectDef | undefined {
  return MARTIAL_EFFECT_CATALOG[effectId];
}

export function resolveMartialEffect(martialId: string, effectId: string, level: number): ResolvedMartialEffect | null {
  const def = getMartialEffectDef(effectId);
  if (!def) return null;
  const stage = getMartialMasteryStage(level);
  const stageDef = [...def.stages]
    .sort((a, b) => b.minLevel - a.minLevel)
    .find(item => level >= item.minLevel) ?? def.stages[0];
  return {
    martialId,
    effectId: def.effectId,
    stage,
    variant: stageDef.variant,
    label: stageDef.label,
    resourceKey: def.resourceKey,
    tacticalEffectId: def.tacticalEffectId,
    anchor: def.anchor,
    width: Math.round(def.width * stageDef.scale),
    height: Math.round(def.height * stageDef.scale),
    scale: stageDef.scale,
    alpha: stageDef.alpha,
    durationMs: stageDef.durationMs,
    particleLevel: stageDef.particleLevel,
    cameraShake: stageDef.cameraShake,
    hitBurstScale: stageDef.hitBurstScale,
    extraLayer: stageDef.extraLayer,
    castText: stageDef.castText ?? stageDef.label,
  };
}
