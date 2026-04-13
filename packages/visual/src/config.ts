// ============================================================
// config.ts — 游戏常量
// ============================================================

import { AgentState, type StateRegion } from './types';

/** 屏幕尺寸 */
export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;

/** 等距瓦片半尺寸 */
export const TILE_HALF_W = 18;
export const TILE_HALF_H = 9;

/** 双缓冲尺寸 */
export const BUFFER_WIDTH = 3200;
export const BUFFER_HEIGHT = 1800;

/** 玩家移动速度 (每帧 delta/16 的倍数) */
export const MOVE_SPEED = 0.25;

/** Agent 移动速度 */
export const AGENT_SPEED = 0.25;

/** 行走动画帧间隔 (ms) */
export const WALK_FRAME_INTERVAL = 120;

/** 行走动画总帧数 */
export const WALK_FRAME_COUNT = 7;

/** 玩家地图边界 */
export const MAP_BORDER = 3;

/** Agent 漫步范围 */
export const WANDER_RANGE = 6;

/** Agent 漫步间隔基础 (ms) */
export const WANDER_INTERVAL_BASE = 3000;

/** 气泡显示时长 (ms) */
export const BUBBLE_DURATION = 3500;

/** 气泡打字间隔 (ms) */
export const BUBBLE_TYPE_INTERVAL = 80;

/** 气泡淡入时长 (ms) */
export const BUBBLE_FADE_IN = 200;

/** 气泡淡出时长 (ms) */
export const BUBBLE_FADE_OUT = 300;

// --- 讨论系统 ---
/** 讨论最小人数 */
export const DISCUSSION_MIN_AGENTS = 2;
/** 讨论最大人数 */
export const DISCUSSION_MAX_AGENTS = 3;
/** 讨论持续时长 (ms) */
export const DISCUSSION_DURATION_MIN = 15000;
export const DISCUSSION_DURATION_MAX = 25000;
/** 每轮发言间隔 (ms) */
export const DISCUSSION_TURN_INTERVAL = 3000;
/** 讨论区固定地图坐标 */
export const DISCUSSION_CENTER_X = 50;
export const DISCUSSION_CENTER_Y = 50;
/** Agent 聚拢后距讨论中心的距离 (地图格) */
export const DISCUSSION_RING_RADIUS = 3;
/** 检查讨论匹配的间隔 (ms) */
export const DISCUSSION_CHECK_INTERVAL = 3000;
/** 讨论气泡尺寸 */
export const DISCUSSION_BUBBLE_W = 160;
export const DISCUSSION_BUBBLE_H = 40;
/** 讨论气泡边框颜色（按策略类别） */
export const DISCUSSION_COLORS = {
  hot: 0xfbbf24,
  emerged: 0x60a5fa,
  normal: 0x6b7280,
} as const;

/** 状态循环间隔 (ms) */
export const STATE_CYCLE_INTERVAL = 4500;

/** 气泡循环间隔 (ms) */
export const BUBBLE_CYCLE_INTERVAL = 3800;

/** 小地图尺寸 */
export const MINIMAP_SIZE = 120;

/** 小地图更新节流 (ms) */
export const MINIMAP_THROTTLE = 500;

/** 事件日志最大条数 */
export const MAX_EVENT_LOG = 20;

// --- 场景系统 ---
/** 场景过渡淡入淡出时长 (ms) */
export const TRANSITION_FADE_MS = 400;
/** NPC 交互距离（地图格） */
export const NPC_INTERACT_DIST = 2.0;

// --- 对话系统 ---
/** 对话打字速度 (ms/字) */
export const DIALOGUE_TYPE_SPEED = 50;

/** 策略各状态对应的地图区域中心 */
export const STATE_REGIONS: Record<AgentState, StateRegion> = {
  [AgentState.Idle]: { x: 50, y: 50, radius: 5 },
  [AgentState.Backtesting]: { x: 35, y: 42, radius: 4 },
  [AgentState.Evolving]: { x: 42, y: 35, radius: 4 },
  [AgentState.Competing]: { x: 65, y: 42, radius: 4 },
  [AgentState.Discussing]: { x: 35, y: 58, radius: 4 },
  [AgentState.Profitable]: { x: 58, y: 35, radius: 4 },
  [AgentState.Retired]: { x: 65, y: 65, radius: 5 },
};

/** 各状态的气泡文本池 */
export const BUBBLE_TEXTS: Record<AgentState, string[]> = {
  [AgentState.Idle]: ['等待新交易日...', '今天先观望', '调整参数中'],
  [AgentState.Backtesting]: ['回测64天数据...', '夏普比率计算中...', '胜率44%'],
  [AgentState.Evolving]: ['尝试杂交策略...', '参数变异中...', '新规则生成中'],
  [AgentState.Competing]: ['排名上升！', '对比中...', '跑赢基准'],
  [AgentState.Discussing]: ['银行板块值得关注', '大盘放量了', '科技股流入明显'],
  [AgentState.Profitable]: ['累计盈利73%！', '连续5天正收益', '夏普1.85'],
  [AgentState.Retired]: [],
};

/** 初始策略数据 (后续从 JSON 加载) */
export const INITIAL_STRATEGIES = [
  { id: 'hv1', name: '人气追涨', category: 'hot' as const, returnPct: 28.78, maxDrawdownPct: 26.79, totalTrades: 292, winRate: 44.18, avgReturnPct: 0.423, capital: 128780, description: '相对竞价>1.5%, 竞价涨幅<5%, 0931涨幅>-5%, 次日收盘卖出' },
  { id: 'hv2', name: '妖股追涨', category: 'hot' as const, returnPct: -5.50, maxDrawdownPct: 25.16, totalTrades: 295, winRate: 44.07, avgReturnPct: -0.02, capital: 94500, description: '信号生成时按相对竞价排序取前5只' },
  { id: 'hv3', name: '上影线追涨', category: 'hot' as const, returnPct: 5.97, maxDrawdownPct: 20.39, totalTrades: 78, winRate: 42.31, avgReturnPct: 0.214, capital: 105970, description: '竞价涨幅<0.5%, 次日开盘卖出' },
  { id: 'hv4', name: '分时大票追涨', category: 'hot' as const, returnPct: 73.74, maxDrawdownPct: 17.61, totalTrades: 116, winRate: 47.41, avgReturnPct: 0.996, capital: 173741, description: '竞价涨幅<0.5%, 次日开盘卖出' },
  { id: 'nv1', name: '多信号综合版', category: 'normal' as const, returnPct: -13.99, maxDrawdownPct: 28.23, totalTrades: 260, winRate: 43.85, avgReturnPct: -0.277, capital: 86010, description: '盘前选股+早盘强势突破/健康回调' },
  { id: 'nv2', name: '早盘强势突破', category: 'normal' as const, returnPct: -22.32, maxDrawdownPct: 30.36, totalTrades: 106, winRate: 40.57, avgReturnPct: -0.456, capital: 77675, description: '连续阳线+突破前高+量比>1.5' },
  { id: 'e1', name: '融合一号', category: 'emerged' as const, returnPct: 35.2, maxDrawdownPct: 15.8, totalTrades: 98, winRate: 49.0, avgReturnPct: 0.82, capital: 135200, description: '继承人气追涨+分时大票卖出规则', parents: ['hv1', 'hv4'], relation: '杂交' },
  { id: 'e2', name: '变异二号', category: 'emerged' as const, returnPct: 8.4, maxDrawdownPct: 12.3, totalTrades: 65, winRate: 46.2, avgReturnPct: 0.31, capital: 108400, description: '上影线追涨参数优化版', parents: ['hv3'], relation: '变异' },
];
