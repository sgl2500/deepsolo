import type { PlayerAttributes, PlayerVitals } from '../types';

export interface PlayerManualDef {
  id: string;
  name: string;
  itemId: string;
  description: string;
  martialUnlockIds?: string[];
  attributeBonus?: Partial<PlayerAttributes>;
  vitalsBonus?: Partial<Pick<PlayerVitals, 'maxHp' | 'maxMp'>>;
}

export const PLAYER_MANUALS: Record<string, PlayerManualDef> = {
  manual_tuna_intro: {
    id: 'manual_tuna_intro',
    name: '吐纳入门',
    itemId: 'manual_tuna_intro',
    description: '基础调息秘籍。研读后可为后续内功体系打底。',
    martialUnlockIds: ['tuna_intro'],
    vitalsBonus: { maxMp: 10 },
  },
  manual_digital_fumo_intro: {
    id: 'manual_digital_fumo_intro',
    name: '金刚伏魔入门',
    itemId: 'manual_digital_fumo_intro',
    description: '数字掌门传下的实盘护体心法。研读后可提升防御与内力上限。',
    attributeBonus: { defense: 2, understanding: 1 },
    vitalsBonus: { maxMp: 20 },
  },
  manual_strategy_deduction_notes: {
    id: 'manual_strategy_deduction_notes',
    name: '实盘推演札记',
    itemId: 'manual_strategy_deduction_notes',
    description: '记录实盘复盘、回撤控制与行情心跳的策略札记。研读后可提升悟性与内力上限。',
    attributeBonus: { understanding: 2 },
    vitalsBonus: { maxMp: 15 },
  },
  manual_taizu_changquan: {
    id: 'manual_taizu_changquan',
    name: '太祖长拳谱',
    itemId: 'manual_taizu_changquan',
    description: '记载太祖长拳拳路的基础拳谱。',
    martialUnlockIds: ['taizu_changquan'],
  },
  manual_taiji_quan: {
    id: 'manual_taiji_quan',
    name: '太极拳谱',
    itemId: 'manual_taiji_quan',
    description: '讲究圆转如意、以柔克刚的高阶拳谱。',
    martialUnlockIds: ['taiji_quan'],
  },
  manual_tiancan_leg: {
    id: 'manual_tiancan_leg',
    name: '天残脚残卷',
    itemId: 'manual_tiancan_leg',
    description: '残缺却威力惊人的腿法残卷。',
    martialUnlockIds: ['tiancan_leg'],
  },
  manual_shadowless_leg: {
    id: 'manual_shadowless_leg',
    name: '无影脚谱',
    itemId: 'manual_shadowless_leg',
    description: '记录高速连踢身法与腿影变化的腿法秘籍。',
    martialUnlockIds: ['shadowless_leg'],
  },
  manual_songfeng_sword: {
    id: 'manual_songfeng_sword',
    name: '松风剑谱',
    itemId: 'manual_songfeng_sword',
    description: '入门剑谱，剑势如松间清风。',
    martialUnlockIds: ['songfeng_sword'],
  },
  manual_dugu_jiujian: {
    id: 'manual_dugu_jiujian',
    name: '独孤九剑谱',
    itemId: 'manual_dugu_jiujian',
    description: '宗师剑法传承，重在破招。',
    martialUnlockIds: ['dugu_jiujian'],
  },
  manual_gale_blade: {
    id: 'manual_gale_blade',
    name: '狂风刀谱',
    itemId: 'manual_gale_blade',
    description: '快刀连斩的刀法秘籍。',
    martialUnlockIds: ['gale_blade'],
  },
  manual_xueyin_blade: {
    id: 'manual_xueyin_blade',
    name: '雪饮狂刀谱',
    itemId: 'manual_xueyin_blade',
    description: '寒意入骨的高阶刀谱。',
    martialUnlockIds: ['xueyin_blade'],
  },
  manual_golden_bell: {
    id: 'manual_golden_bell',
    name: '金钟罩',
    itemId: 'manual_golden_bell',
    description: '护体内功秘籍，修成后金钟护身。',
    martialUnlockIds: ['golden_bell'],
    attributeBonus: { defense: 1 },
  },
  manual_taishan_pressure: {
    id: 'manual_taishan_pressure',
    name: '泰山压顶秘卷',
    itemId: 'manual_taishan_pressure',
    description: '绝学秘卷，山岳压顶，万物俯首。',
    martialUnlockIds: ['taishan_pressure'],
  },
};

export function getPlayerManualDef(manualId: string): PlayerManualDef | undefined {
  return PLAYER_MANUALS[manualId];
}

export function getPlayerManualDefByItemId(itemId: string): PlayerManualDef | undefined {
  return Object.values(PLAYER_MANUALS).find((manual) => manual.itemId === itemId);
}
