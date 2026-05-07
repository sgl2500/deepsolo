// ============================================================
// config.ts — 游戏常量
// ============================================================

import { AgentState, type StateRegion } from './types';

/** 后端数据文件路径（seed 脚本同步到 public/data/） */
export const STRATEGIES_URL = './data/strategies.json';

/** 前端轮询间隔 (ms) */
export const POLL_INTERVAL = 10000;

/** 事件文件路径 */
export const EVENTS_URL = './data/events.json';

/** WebSocket 服务地址 */
export const WS_URL = 'ws://localhost:8765';

/** 屏幕尺寸 */
export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;

/** 等距瓦片半尺寸 */
export const TILE_HALF_W = 18;
export const TILE_HALF_H = 9;

/** 室内场景瓦片放大倍率 */
export const INDOOR_SCALE = 2;

/** 室内墙面贴图层：高于背景墙体，低于玩家/NPC/家具 */
export const INDOOR_WALL_DECOR_DEPTH = 900;

/** 室内动态实体层：玩家、NPC、普通家具按等距坐标继续细分排序 */
export const INDOOR_ACTOR_DEPTH_BASE = 1000;

/** 室内前景墙层：门口/底边墙始终可遮挡动态实体 */
export const INDOOR_FOREGROUND_DEPTH_BASE = 2000;

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

// --- 战斗系统 ---
/** 竞技场网格尺寸 */
export const ARENA_SIZE = 10;
/** 战斗动画时长 (ms) */
export const BATTLE_ANIM_SPEED = 400;
/** 回合间隔 (ms) */
export const BATTLE_TURN_DELAY = 300;
/** 战斗日志最大行数 */
export const BATTLE_LOG_MAX = 6;
/** 战斗精灵每方向帧数 */
export const FIGHT_FRAMES_PER_DIR = 12;
/** 战斗精灵帧间隔 (ms) */
export const FIGHT_FRAME_INTERVAL = 50;
/** 战场瓦片缩放倍率（2.25 = 放大2.25倍，使中心棋盘更有存在感） */
export const BATTLE_TILE_SCALE = 2.25;

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

// --- 剧情系统 ---
/** 故事状态 localStorage key */
export const LS_KEY_STORY = 'deepsolo_story';

/** 室内家具编辑器布局 localStorage key 前缀 */
export const LS_KEY_FURNITURE_EDITOR_LAYOUTS = 'deepsolo_furniture_editor_layouts';

/** 室内可交互区域编辑器 localStorage key 前缀 */
export const LS_KEY_INTERACTABLE_EDITOR_LAYOUTS = 'deepsolo_interactable_editor_layouts';

/** 室内人物贴图编辑器 localStorage key 前缀 */
export const LS_KEY_INDOOR_CHARACTER_EDITOR_LAYOUTS = 'deepsolo_indoor_character_editor_layouts';

/** 室内地板瓦片覆盖编辑器 localStorage key 前缀 */
export const LS_KEY_INDOOR_FLOOR_TILE_OVERRIDES = 'deepsolo_indoor_floor_tile_overrides';

/** 统一场景编辑器草稿 localStorage key 前缀 */
export const LS_KEY_SCENE_EDITOR_DRAFTS = 'deepsolo_scene_editor_drafts';

/** 大地图入口/碰撞编辑器 localStorage key */
export const LS_KEY_WORLD_MAP_EDITOR_LAYOUTS = 'deepsolo_world_map_editor_layouts';

/** 玩家生命/内力/物品进度 localStorage key */
export const LS_KEY_PLAYER_PROGRESS = 'deepsolo_player_progress';

/** 玩家所在场景和坐标 localStorage key */
export const LS_KEY_PLAYER_LOCATION = 'deepsolo_player_location';

/** 本地账号列表 localStorage key */
export const LS_KEY_AUTH_USERS = 'deepsolo_auth_users';

/** 当前登录会话 localStorage key */
export const LS_KEY_AUTH_SESSION = 'deepsolo_auth_session';

// --- Token 中心 ---
/** Token 中心初始数据路径 */
export const TOKEN_ACCOUNT_URL = './data/token_center/account.json';
export const TOKEN_LIST_URL = './data/token_center/tokens.json';

/** Token 稀有度颜色 */
export const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

/** Token 稀有度标签 */
export const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

/** 初始余额 */
export const INITIAL_BALANCE = 10000;

/** localStorage key */
export const LS_KEY_ACCOUNT = 'deepsolo_account';
export const LS_KEY_TOKENS = 'deepsolo_tokens';
export const LS_KEY_LISTINGS = 'deepsolo_listings';
export const LS_KEY_TRANSACTIONS = 'deepsolo_transactions';

/** 初始策略数据 (后续从 JSON 加载) */
export const INITIAL_STRATEGIES = [
  {
    id: 'digital_master',
    name: '数字掌门',
    category: 'emerged' as const,
    returnPct: 0,
    maxDrawdownPct: 0,
    totalTrades: 0,
    winRate: 0,
    avgReturnPct: 0,
    capital: 500,
    description: '外部 crypto 工作区映射进来的掌门策略，负责 BTC 策略心跳、复盘与进化。',
    buildingId: 'digital_sect',
    placement: 'indoor-only' as const,
    role: '掌门',
    sourceWorkspace: 'crypto',
    mode: 'dry_run',
  },
  { id: 'hv1', name: '人气追涨', category: 'hot' as const, returnPct: 20.25, maxDrawdownPct: 13.17, totalTrades: 218, winRate: 47.25, avgReturnPct: 0.608, capital: 120250, description: '相对竞价>1.5%, 竞价涨幅<5%, 0931涨幅>-5%, 次日收盘卖出' },
  { id: 'hv2', name: '妖股追涨', category: 'hot' as const, returnPct: -3.2, maxDrawdownPct: 25.0, totalTrades: 225, winRate: 44.4, avgReturnPct: -0.01, capital: 96800, description: '信号生成时按相对竞价排序取前5只' },
  { id: 'hv3', name: '上影线追涨', category: 'hot' as const, returnPct: 4.7, maxDrawdownPct: 20.4, totalTrades: 81, winRate: 43.2, avgReturnPct: 0.118, capital: 104700, description: '竞价涨幅<0.5%, 次日开盘卖出' },
  { id: 'hv4', name: '分时大票追涨', category: 'hot' as const, returnPct: 77.1, maxDrawdownPct: 17.6, totalTrades: 126, winRate: 47.6, avgReturnPct: 0.996, capital: 177100, description: '竞价涨幅<0.5%, 次日开盘卖出' },
  { id: 'nv1', name: '多信号综合版', category: 'normal' as const, returnPct: -13.6, maxDrawdownPct: 19.7, totalTrades: 209, winRate: 42.1, avgReturnPct: -0.277, capital: 86400, description: '盘前选股+早盘强势突破/健康回调' },
  { id: 'nv2', name: '早盘强势突破', category: 'normal' as const, returnPct: -0.2, maxDrawdownPct: 5.5, totalTrades: 78, winRate: 55.1, avgReturnPct: -0.001, capital: 99800, description: '连续阳线+突破前高+量比>1.5' },
];
