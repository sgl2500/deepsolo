import { assert, test, type TestCase } from './test_utils';
import { renderStrategyLiveState, type StrategyLiveState } from '../../src/ui/DetailPanel';

const LIVE_STATE: StrategyLiveState = {
  mode: 'dry_run',
  strategyVersion: '3.1',
  symbol: 'BTC-USDT-SWAP',
  equity: 500,
  realizedPnl: 0,
  positionsCount: 1,
  positionSummary: 'S0 short @ 75306.60',
  lastDecision: {
    action: 'hold',
    reason: 'RSI超买: RSI=71',
  },
};

export const tests: TestCase[] = [
  test('workspace live state renders key runtime rows', () => {
    const html = renderStrategyLiveState(LIVE_STATE, false);
    assert.match(html, /门派实时状态/);
    assert.match(html, /BTC-USDT-SWAP/);
    assert.match(html, /S0 short @ 75306\.60/);
    assert.match(html, /hold \/ RSI超买: RSI=71/);
  }),

  test('workspace live state renders loading hint', () => {
    const html = renderStrategyLiveState(null, true);
    assert.match(html, /正在读取门派实时状态/);
  }),
];
