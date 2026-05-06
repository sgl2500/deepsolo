import { assert, test, type TestCase } from './test_utils';
import type { PlayerProgress, Strategy } from '../../src/types';
import {
  buildPlayerCombatDisplayModel,
  buildStrategyCombatDisplayModel,
  renderCombatCardGrid,
  renderCombatNotes,
} from '../../src/ui/CombatDisplay';

const PLAYER_PROGRESS: PlayerProgress = {
  version: 2,
  identity: { name: '无名少侠', title: '观察者' },
  vitals: { hp: 180, maxHp: 220, mp: 190, maxMp: 210 },
  attributes: {
    attack: 13,
    defense: 11,
    speed: 12,
    understanding: 14,
    fortune: 9,
  },
  inventory: [],
  manuals: [],
  martials: [],
  equipment: {},
  flags: {},
};

const STRATEGY: Strategy = {
  id: 'digital_master',
  name: '数字掌门',
  category: 'emerged',
  description: '外部 crypto 工作区映射进来的掌门策略。',
  returnPct: 100,
  maxDrawdownPct: 5,
  totalTrades: 10,
  winRate: 50,
  avgReturnPct: 1,
  capital: 1000,
  state: 'profitable' as Strategy['state'],
  role: '掌门',
  sourceWorkspace: 'crypto',
  mode: 'dry_run',
  existenceTier: 10,
};

function cardValue(cards: Array<{ label: string; value: string; caption?: string }>, label: string): string {
  const card = cards.find((item) => item.label === label);
  assert.ok(card, `missing card ${label}`);
  return card!.value;
}

function cardCaption(cards: Array<{ label: string; value: string; caption?: string }>, label: string): string {
  const card = cards.find((item) => item.label === label);
  assert.ok(card, `missing card ${label}`);
  return card!.caption ?? '';
}

export const tests: TestCase[] = [
  test('player combat display model maps player growth into unified combat fields', () => {
    const model = buildPlayerCombatDisplayModel(PLAYER_PROGRESS);
    assert.equal(cardValue(model.anchorCards, '存在层级'), '1');
    assert.equal(cardValue(model.anchorCards, '收益锚点'), '+0%');
    assert.equal(cardValue(model.anchorCards, '福缘'), '9');

    assert.equal(cardValue(model.attributeCards, '力量'), '13');
    assert.equal(cardValue(model.attributeCards, '智力'), '14');
    assert.equal(cardValue(model.attributeCards, '敏捷'), '12');
    assert.equal(cardValue(model.attributeCards, '体质'), '11');

    assert.equal(cardValue(model.battleCards, '生命'), '180 / 220');
    assert.equal(cardValue(model.battleCards, '内力'), '190 / 240');
    assert.equal(cardValue(model.battleCards, '攻击力'), '260');
    assert.equal(cardValue(model.battleCards, '防御力'), '110');
    assert.equal(cardValue(model.battleCards, '轻功'), '48');
  }),

  test('strategy combat display model exposes unified world rule outputs', () => {
    const model = buildStrategyCombatDisplayModel(STRATEGY);
    assert.equal(cardValue(model.anchorCards, '存在层级'), '10');
    assert.equal(cardValue(model.anchorCards, '收益率'), '+100%');
    assert.equal(cardValue(model.anchorCards, '最大回撤'), '5%');
    assert.equal(cardValue(model.anchorCards, '策略源'), 'crypto');

    assert.equal(cardValue(model.attributeCards, '体质'), '17');
    assert.match(cardCaption(model.attributeCards, '体质'), /\+7/);

    assert.equal(cardValue(model.battleCards, '生命'), '3000 / 3000');
    assert.equal(cardValue(model.battleCards, '攻击力'), '340');
    assert.equal(cardValue(model.battleCards, '防御力'), '170');
    assert.equal(cardValue(model.battleCards, '轻功'), '44');
    assert.match(cardCaption(model.battleCards, '攻击力'), /\+7/);
  }),

  test('combat display renderers escape injected content', () => {
    const html = renderCombatCardGrid([
      { label: '<生命>', value: '1 & 2', caption: '"说明"' },
    ]);
    const notes = renderCombatNotes(['A < B & C']);
    assert.match(html, /&lt;生命&gt;/);
    assert.match(html, /1 &amp; 2/);
    assert.match(html, /&quot;说明&quot;/);
    assert.match(notes, /A &lt; B &amp; C/);
  }),
];
