import { NEUTRAL_DRAWDOWN_PCT, buildPlayerCombatProfile, buildStrategyCombatProfile } from '../data/CombatProfile';
import type { PlayerProgress, Strategy } from '../types';

export type CombatCardTone = 'default' | 'pos' | 'neg' | 'accent';

export interface CombatDisplayCard {
  label: string;
  value: string;
  tone?: CombatCardTone;
  caption?: string;
}

export interface CombatDisplayModel {
  anchorCards: CombatDisplayCard[];
  attributeCards: CombatDisplayCard[];
  battleCards: CombatDisplayCard[];
  notes: string[];
}

export function buildPlayerCombatDisplayModel(progress: PlayerProgress): CombatDisplayModel {
  const combat = buildPlayerCombatProfile(progress);
  const maxHp = Math.max(Math.round(progress.vitals.maxHp), combat.maxHp);
  const maxMp = Math.max(Math.round(progress.vitals.maxMp), combat.maxMp);

  return {
    anchorCards: [
      { label: '存在层级', value: String(combat.existenceTier), caption: '玩家统一走世界规则' },
      { label: '收益锚点', value: '+0%', caption: 'V1 不给玩家单独收益加成' },
      { label: '回撤锚点', value: `${NEUTRAL_DRAWDOWN_PCT}%`, caption: '中性基准' },
      { label: '福缘', value: String(progress.attributes.fortune), caption: '暂不进入 V1 战斗公式' },
    ],
    attributeCards: [
      { label: '力量', value: String(combat.strength), caption: '来自攻击属性' },
      { label: '智力', value: String(combat.intelligence), caption: '来自悟性属性' },
      { label: '敏捷', value: String(combat.agility), caption: '来自身法属性' },
      {
        label: '体质',
        value: String(combat.constitution),
        caption: combat.constitutionBonus > 0 ? `回撤修正 +${combat.constitutionBonus}` : '来自防御属性',
      },
    ],
    battleCards: [
      { label: '生命', value: `${Math.round(progress.vitals.hp)} / ${maxHp}`, tone: 'pos' },
      { label: '内力', value: `${Math.round(progress.vitals.mp)} / ${maxMp}`, tone: 'accent' },
      {
        label: '攻击力',
        value: String(combat.attack),
        caption: combat.attackBonus > 0 ? `统一修正 +${combat.attackBonus}` : '统一基线',
      },
      {
        label: '防御力',
        value: String(combat.defense),
        caption: combat.constitutionBonus > 0 ? `体质修正 +${combat.constitutionBonus}` : '统一基线',
      },
      { label: '命中率', value: String(combat.hitRate) },
      { label: '闪避率', value: String(combat.dodgeRate) },
      { label: '轻功', value: String(combat.speed) },
    ],
    notes: [
      '力量=攻击，智力=悟性，敏捷=身法，体质=防御。',
      '当前血蓝上限会与统一战斗基线同步，不再为玩家单独维护一套战斗规则。',
    ],
  };
}

export function buildStrategyCombatDisplayModel(strategy: Strategy): CombatDisplayModel {
  const combat = buildStrategyCombatProfile(strategy);
  const hasWorkspace = Boolean(strategy.sourceWorkspace);

  return {
    anchorCards: [
      {
        label: '存在层级',
        value: String(combat.existenceTier),
        caption: hasWorkspace ? 'workspace / 实盘角色' : '普通策略角色',
      },
      {
        label: '收益率',
        value: formatSignedPercent(strategy.returnPct),
        tone: strategy.returnPct >= 0 ? 'pos' : 'neg',
        caption: '生命强挂钩收益',
      },
      {
        label: '最大回撤',
        value: `${strategy.maxDrawdownPct}%`,
        tone: 'neg',
        caption: '先影响体质，再进入防御',
      },
      {
        label: '策略源',
        value: strategy.sourceWorkspace ?? '游戏内策略',
        caption: strategy.mode ? `模式 ${strategy.mode}` : '无外部运行时',
      },
    ],
    attributeCards: [
      { label: '力量', value: String(combat.strength), caption: 'V1 默认起点 10' },
      { label: '智力', value: String(combat.intelligence), caption: 'V1 默认起点 10' },
      { label: '敏捷', value: String(combat.agility), caption: 'V1 默认起点 10' },
      {
        label: '体质',
        value: String(combat.constitution),
        caption: combat.constitutionBonus > 0 ? `回撤修正 +${combat.constitutionBonus}` : '无额外回撤加成',
      },
    ],
    battleCards: [
      { label: '生命', value: `${combat.maxHp} / ${combat.maxHp}`, tone: 'pos', caption: '默认以满状态参战' },
      { label: '内力', value: `${combat.maxMp} / ${combat.maxMp}`, tone: 'accent', caption: '统一内力上限' },
      {
        label: '攻击力',
        value: String(combat.attack),
        caption: combat.attackBonus > 0 ? `收益/层级修正 +${combat.attackBonus}` : '无额外攻击修正',
      },
      {
        label: '防御力',
        value: String(combat.defense),
        caption: combat.constitutionBonus > 0 ? `体质修正 +${combat.constitutionBonus}` : '无额外防御修正',
      },
      { label: '命中率', value: String(combat.hitRate) },
      { label: '闪避率', value: String(combat.dodgeRate) },
      { label: '轻功', value: String(combat.speed) },
    ],
    notes: buildStrategyNotes(strategy),
  };
}

export function renderCombatCardGrid(cards: CombatDisplayCard[], extraClass = ''): string {
  const className = extraClass ? `combat-grid ${extraClass}` : 'combat-grid';
  return `
    <div class="${className}">
      ${cards.map((card) => `
        <div class="combat-card ${card.tone ? `tone-${card.tone}` : ''}">
          <span>${escapeHtml(card.label)}</span>
          <b>${escapeHtml(card.value)}</b>
          ${card.caption ? `<small>${escapeHtml(card.caption)}</small>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

export function renderCombatNotes(notes: string[]): string {
  if (notes.length === 0) return '';
  return `
    <div class="combat-notes">
      ${notes.map((note) => `<p class="combat-note">${escapeHtml(note)}</p>`).join('')}
    </div>
  `;
}

function buildStrategyNotes(strategy: Strategy): string[] {
  const notes: string[] = [];
  if (strategy.sourceWorkspace) {
    notes.push('该人物绑定独立 workspace，存在层级直接抬升到实盘角色标准。');
  } else {
    notes.push('该人物没有外部 workspace 接入，当前按普通策略角色规则计算战力。');
  }

  if (strategy.maxDrawdownPct <= 10) {
    notes.push('当前回撤较小，体质和防御已获得正向修正。');
  } else if (strategy.maxDrawdownPct >= 20) {
    notes.push('当前回撤偏大，体质修正较弱，后续应重点关注风险控制。');
  }

  if (strategy.returnPct >= 0) {
    notes.push('收益率当前为正，生命上限与少量攻击修正都在向上抬升。');
  } else {
    notes.push('收益率当前为负，生命上限仍受统一下限保护，但没有额外攻击加成。');
  }
  return notes;
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}
