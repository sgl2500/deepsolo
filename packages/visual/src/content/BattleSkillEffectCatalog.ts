import type { SideBattleSkill, SideBattleSkillType } from '../systems/sidebattle/SideBattleTypes';

export type BattleAttackPresentation = 'melee_normal' | 'melee_wugong' | 'ranged_strategy';

export type BattleEffectAnchor = 'attacker_front' | 'target_front' | 'target_center' | 'self_center';

export interface BattleSkillEffectDef {
  skillId: string;
  presentation: BattleAttackPresentation;
  textureKey: string | null;
  anchor: BattleEffectAnchor;
  width: number;
  height: number;
  durationMs: number;
  hitBurstScale: number;
}

const DEFAULT_NORMAL_EFFECT: BattleSkillEffectDef = {
  skillId: 'normal_attack',
  presentation: 'melee_normal',
  textureKey: null,
  anchor: 'target_front',
  width: 0,
  height: 0,
  durationMs: 180,
  hitBurstScale: 0.28,
};

const DEFAULT_WUGONG_EFFECT: BattleSkillEffectDef = {
  skillId: '__default_wugong',
  presentation: 'melee_wugong',
  textureKey: 'battle_effect_martial_palm',
  anchor: 'target_front',
  width: 190,
  height: 118,
  durationMs: 320,
  hitBurstScale: 0.42,
};

const DEFAULT_STRATEGY_EFFECT: BattleSkillEffectDef = {
  skillId: '__default_strategy',
  presentation: 'ranged_strategy',
  textureKey: 'battle_effect_strategy_projectile',
  anchor: 'attacker_front',
  width: 150,
  height: 78,
  durationMs: 360,
  hitBurstScale: 0.36,
};

export const BATTLE_SKILL_EFFECTS: Record<string, BattleSkillEffectDef> = {
  normal_attack: DEFAULT_NORMAL_EFFECT,
  tuna_qigong: {
    ...DEFAULT_WUGONG_EFFECT,
    skillId: 'tuna_qigong',
    width: 176,
    height: 104,
    hitBurstScale: 0.38,
  },
  digital_fumo_intro: {
    ...DEFAULT_WUGONG_EFFECT,
    skillId: 'digital_fumo_intro',
    width: 210,
    height: 132,
    hitBurstScale: 0.46,
  },
  live_strategy_deduction: {
    ...DEFAULT_STRATEGY_EFFECT,
    skillId: 'live_strategy_deduction',
    width: 156,
    height: 82,
  },
  btc_heartbeat: {
    ...DEFAULT_STRATEGY_EFFECT,
    skillId: 'btc_heartbeat',
    width: 172,
    height: 90,
    hitBurstScale: 0.42,
  },
};

export function getBattleSkillEffect(skill: Pick<SideBattleSkill, 'id' | 'type'>): BattleSkillEffectDef {
  const explicit = BATTLE_SKILL_EFFECTS[skill.id];
  if (explicit) return explicit;

  if (skill.type === 'strategy') return { ...DEFAULT_STRATEGY_EFFECT, skillId: skill.id };
  if (isWugongSkillType(skill.type)) return { ...DEFAULT_WUGONG_EFFECT, skillId: skill.id };
  return { ...DEFAULT_NORMAL_EFFECT, skillId: skill.id };
}

function isWugongSkillType(type: SideBattleSkillType): boolean {
  return type === 'martial' || type === 'inner';
}
