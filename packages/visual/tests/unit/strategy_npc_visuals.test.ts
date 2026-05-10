import { assert, test, type TestCase } from './test_utils';
import { AgentState, type Strategy } from '../../src/types';
import { getStrategyNpcVisual } from '../../src/content/StrategyNpcVisuals';

const DIGITAL_MASTER: Strategy = {
  id: 'digital_master',
  name: '数字掌门',
  category: 'emerged',
  description: '外部 crypto 工作区映射进来的掌门策略。',
  returnPct: 0,
  maxDrawdownPct: 0,
  totalTrades: 0,
  winRate: 0,
  avgReturnPct: 0,
  capital: 500,
  state: AgentState.Discussing,
  buildingId: 'digital_sect',
  placement: 'indoor-only',
  role: '掌门',
  sourceWorkspace: 'crypto',
  mode: 'dry_run',
};

const NORMAL_STRATEGY: Strategy = {
  id: 'hv1',
  name: '人气追涨',
  category: 'hot',
  description: 'test',
  returnPct: 1,
  maxDrawdownPct: 1,
  totalTrades: 1,
  winRate: 1,
  avgReturnPct: 1,
  capital: 1,
  state: AgentState.Competing,
};

export const tests: TestCase[] = [
  test('digital master uses role148 Spine with shishu fallback texture', () => {
    const visual = getStrategyNpcVisual(DIGITAL_MASTER);
    assert.equal(visual.kind, 'spine');
    if (visual.kind !== 'spine') return;
    assert.equal(visual.dataKey, 'battle_spine_role148_json');
    assert.equal(visual.atlasKey, 'battle_spine_role148_atlas');
    assert.equal(visual.flipX, true);
    assert.equal(visual.fallbackTextureKey, 'token_center_shishu');
  }),

  test('default strategy npc still uses chars atlas player sprite', () => {
    const visual = getStrategyNpcVisual(NORMAL_STRATEGY);
    assert.equal(visual.kind, 'chars_atlas');
    assert.equal(visual.charKey, 'player');
  }),
];
