import { assert, test, type TestCase } from './test_utils';
import { AgentState, type Strategy } from '../../src/types';
import { getStrategyBuildingId, shouldCreateWorldAgent } from '../../src/content/StrategyNpcPlacement';

const DIGITAL_MASTER: Strategy = {
  id: 'digital_master',
  name: '数字掌门',
  category: 'emerged',
  description: '外部 crypto 工作区映射进来的掌门策略。',
  returnPct: 2.5,
  maxDrawdownPct: 1.2,
  totalTrades: 1,
  winRate: 100,
  avgReturnPct: 2.5,
  capital: 512.5,
  state: AgentState.Competing,
  buildingId: 'digital_sect',
  placement: 'indoor-only',
  role: '掌门',
  sourceWorkspace: 'crypto',
  mode: 'dry_run',
};

export const tests: TestCase[] = [
  test('workspace strategy routes into its configured building', () => {
    assert.equal(getStrategyBuildingId(DIGITAL_MASTER), 'digital_sect');
  }),

  test('indoor-only workspace strategy skips world roaming agent spawn', () => {
    assert.equal(shouldCreateWorldAgent(DIGITAL_MASTER), false);
  }),
];
