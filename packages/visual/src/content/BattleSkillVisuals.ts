import { WugongType, type WugongDef } from '../types';
import { getMartialArtDef } from './martial/MartialCodex';
import { getMartialEffectForBattle } from './martial/MartialEffectBindings';

export type BattleSkillTargetMode = 'single' | 'aoe';
export type BattleSkillRangeShape = 'diamond' | 'square';

export interface BattleSkillVisualTier {
  minLevel: number;
  effectId?: string;
  effectScale?: number;
  castText?: string;
  castTextColor?: string;
  showCastText?: boolean;
  cameraShake?: boolean;
  hitStopMs?: number;
}

export interface BattleSkillVisualDef {
  skillId: string;
  targetMode: BattleSkillTargetMode;
  rangeShape: BattleSkillRangeShape;
  effectId: string;
  effectScale: number;
  castText: string;
  castTextColor: string;
  showCastText: boolean;
  impactDelayMs: number;
  hitStopMs: number;
  cameraShake: boolean;
  tiers?: BattleSkillVisualTier[];
}

const DEFAULT_TYPE_COLORS: Record<number, string> = {
  [WugongType.Fist]: '#ff8844',
  [WugongType.Sword]: '#44aaff',
  [WugongType.Blade]: '#ff4466',
  [WugongType.Special]: '#aa66ff',
  [WugongType.Neigong]: '#44ffaa',
};

const DEFAULT_VISUAL: Omit<BattleSkillVisualDef, 'skillId'> = {
  targetMode: 'aoe',
  rangeShape: 'square',
  effectId: '003',
  effectScale: 1.5,
  castText: '',
  castTextColor: '#fbbf24',
  showCastText: true,
  impactDelayMs: 250,
  hitStopMs: 0,
  cameraShake: false,
};

export const BATTLE_SKILL_VISUALS: Record<string, BattleSkillVisualDef> = {
  normal_attack: {
    skillId: 'normal_attack',
    targetMode: 'single',
    rangeShape: 'diamond',
    effectId: '003',
    effectScale: 0.75,
    castText: '普通攻击',
    castTextColor: '#fbbf24',
    showCastText: false,
    impactDelayMs: 180,
    hitStopMs: 50,
    cameraShake: false,
    tiers: [
      { minLevel: 1, effectId: '003', effectScale: 0.75, castText: '普通攻击', showCastText: false },
      { minLevel: 4, effectId: '004', effectScale: 0.9, castText: '拳风初成', showCastText: true },
      { minLevel: 7, effectId: '006', effectScale: 1.05, castText: '拳劲纵横', showCastText: true, cameraShake: true },
      { minLevel: 10, effectId: '009', effectScale: 1.2, castText: '登峰一击', showCastText: true, cameraShake: true, hitStopMs: 90 },
    ],
  },
  zhuihun_jian: {
    skillId: 'zhuihun_jian',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '005',
    effectScale: 1.25,
    castText: '追魂剑法',
    castTextColor: '#44aaff',
    showCastText: true,
    impactDelayMs: 250,
    hitStopMs: 60,
    cameraShake: true,
  },
  fengmo_zhang: {
    skillId: 'fengmo_zhang',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '008',
    effectScale: 1.35,
    castText: '疯魔杖法',
    castTextColor: '#aa66ff',
    showCastText: true,
    impactDelayMs: 260,
    hitStopMs: 70,
    cameraShake: true,
  },
  taiji_quan: {
    skillId: 'taiji_quan',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '004',
    effectScale: 1.2,
    castText: '太极拳',
    castTextColor: '#ff8844',
    showCastText: true,
    impactDelayMs: 240,
    hitStopMs: 55,
    cameraShake: false,
  },
  jingang_fumo: {
    skillId: 'jingang_fumo',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '001',
    effectScale: 1.35,
    castText: '金刚伏魔功',
    castTextColor: '#44ffaa',
    showCastText: true,
    impactDelayMs: 260,
    hitStopMs: 70,
    cameraShake: true,
  },
  luoying_shenjian: {
    skillId: 'luoying_shenjian',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '006',
    effectScale: 1.3,
    castText: '落英神剑掌',
    castTextColor: '#ff8844',
    showCastText: true,
    impactDelayMs: 250,
    hitStopMs: 60,
    cameraShake: true,
  },
  dugu_jiujian: {
    skillId: 'dugu_jiujian',
    targetMode: 'aoe',
    rangeShape: 'square',
    effectId: '009',
    effectScale: 1.45,
    castText: '独孤九剑',
    castTextColor: '#44aaff',
    showCastText: true,
    impactDelayMs: 270,
    hitStopMs: 80,
    cameraShake: true,
  },
};

export function getBattleSkillVisual(skill: WugongDef, level = 1): BattleSkillVisualDef {
  const martialArt = getMartialArtDef(skill.id);
  if (martialArt) {
    const effect = getMartialEffectForBattle({ martialId: skill.id, level, mode: 'tactical' });
    const aoeSize = martialArt.tactical.aoeSize;
    return {
      skillId: skill.id,
      targetMode: aoeSize > 1 ? 'aoe' : 'single',
      rangeShape: martialArt.tactical.shape === 'single' || martialArt.tactical.shape === 'diamond' ? 'diamond' : 'square',
      effectId: effect?.tacticalEffectId ?? skill.effectId,
      effectScale: Math.max(0.85, (effect?.scale ?? 1) * 1.2),
      castText: martialArt.name,
      castTextColor: DEFAULT_TYPE_COLORS[skill.type] ?? DEFAULT_VISUAL.castTextColor,
      showCastText: true,
      impactDelayMs: Math.min(420, Math.max(180, effect?.durationMs ?? 250)),
      hitStopMs: effect?.stage && effect.stage >= 3 ? 60 + effect.stage * 8 : 0,
      cameraShake: (effect?.cameraShake ?? 0) >= 0.05,
    };
  }

  const base = BATTLE_SKILL_VISUALS[skill.id] ?? {
    ...DEFAULT_VISUAL,
    skillId: skill.id,
    effectId: skill.effectId,
    castText: skill.name,
    castTextColor: DEFAULT_TYPE_COLORS[skill.type] ?? DEFAULT_VISUAL.castTextColor,
  };

  const tier = [...(base.tiers ?? [])]
    .sort((a, b) => b.minLevel - a.minLevel)
    .find(item => level >= item.minLevel);

  if (!tier) return base;
  return {
    ...base,
    effectId: tier.effectId ?? base.effectId,
    effectScale: tier.effectScale ?? base.effectScale,
    castText: tier.castText ?? base.castText,
    castTextColor: tier.castTextColor ?? base.castTextColor,
    cameraShake: tier.cameraShake ?? base.cameraShake,
    hitStopMs: tier.hitStopMs ?? base.hitStopMs,
    showCastText: tier.showCastText ?? base.showCastText,
  };
}
