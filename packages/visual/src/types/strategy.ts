/** Agent 状态枚举 */
export enum AgentState {
  Idle = 'idle',
  Backtesting = 'backtesting',
  Evolving = 'evolving',
  Competing = 'competing',
  Discussing = 'discussing',
  Profitable = 'profitable',
  Retired = 'retired',
}

/** 策略类别 */
export type StrategyCategory = 'hot' | 'normal' | 'emerged';

/** 策略数据 */
export interface Strategy {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  returnPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  winRate: number;
  avgReturnPct: number;
  capital: number;
  state: AgentState;
  parents?: string[];
  relation?: string;
  buildingId?: string;
  placement?: 'world' | 'indoor-only';
  role?: string;
  sourceWorkspace?: string;
  mode?: string;
}

/** 策略模板 (来自 template.json) */
export interface StrategyTemplate {
  path: string;
  name: string;
  description: string;
  return_pct: number;
}

/** 账户汇总 (来自 v*_account.json) */
export interface AccountSummary {
  start_date: string;
  end_date: string;
  final_capital: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  total_trades: number;
  win_trades: number;
  lose_trades: number;
  win_rate: number;
  avg_return_pct: number;
}

/** 账户数据 */
export interface AccountData {
  config: { initial_capital: number; max_holdings: number };
  summary: AccountSummary;
}

/** 事件日志条目 */
export interface EventEntry {
  time: string;
  agentName: string;
  text: string;
}

/** 状态区域配置 */
export interface StateRegion {
  x: number;
  y: number;
  radius: number;
}

/** 状态标签映射 */
export const STATE_LABELS: Record<AgentState, string> = {
  [AgentState.Idle]: '待命',
  [AgentState.Backtesting]: '回测',
  [AgentState.Evolving]: '进化',
  [AgentState.Competing]: '竞争',
  [AgentState.Discussing]: '讨论',
  [AgentState.Profitable]: '盈利',
  [AgentState.Retired]: '淘汰',
};

/** 状态转换规则 */
export const STATE_TRANSITIONS: Record<AgentState, AgentState[]> = {
  [AgentState.Idle]: [AgentState.Backtesting, AgentState.Discussing],
  [AgentState.Backtesting]: [AgentState.Evolving, AgentState.Competing, AgentState.Idle],
  [AgentState.Evolving]: [AgentState.Backtesting, AgentState.Competing],
  [AgentState.Competing]: [AgentState.Profitable, AgentState.Discussing, AgentState.Idle],
  [AgentState.Discussing]: [AgentState.Competing, AgentState.Idle],
  [AgentState.Profitable]: [AgentState.Competing, AgentState.Retired],
  [AgentState.Retired]: [],
};
