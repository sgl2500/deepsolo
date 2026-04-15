// ============================================================
// types.ts — 所有 TypeScript 接口和枚举
// ============================================================

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

/** 方向: 上=0, 右=1, 左=2, 下=3 */
export enum Direction {
  Up = 0,
  Right = 1,
  Left = 2,
  Down = 3,
}

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

/** 角色元数据 (来自 char_meta.json) */
export interface CharMeta {
  chars: Record<string, { xoff: number; yoff: number }>;
  mapping: Record<string, string>;
}

/** 瓦片元数据 (来自 tile_meta.json) */
export type TileMeta = Record<string, { xoff: number; yoff: number }>;

/** 地图数据 (来自 map_data.json) */
export interface MapData {
  width: number;
  height: number;
  cx: number;
  cy: number;
  earth: number[][];
  surface: number[][];
}

/** EventBus 事件映射 */
export interface GameEvents {
  'strategy:loaded': Strategy[];
  'strategy:state-changed': { id: string; oldState: AgentState; newState: AgentState };
  'strategy:selected': Strategy | null;
  'agent:moved': { id: string; x: number; y: number };
  'player:moved': { x: number; y: number };
  'day:tick': number;
  'bubble:show': { entityId: string; text: string };
  'discussion:started': { groupId: string; agents: string[]; topic: DiscussionTopic };
  'discussion:turn': { groupId: string; agentId: string; agentName: string; text: string };
  'discussion:ended': { groupId: string; agents: string[] };
  'discussion:view': DiscussionGroup;
  'ui:refresh': void;
  'scene:state-changed': { state: SceneState; buildingId?: string };
  'dialogue:show': { speaker: string; portraitKey: string; text: string; choices: DialogueChoice[] };
  'dialogue:text-update': string;
  'dialogue:hide': void;
  'dialogue:choice': number;
  'dialogue:advance': void;
  'npc:interact': { npcId: string };
  'chat:open': Strategy;
  'chat:close': void;
}

/** 讨论话题 */
export enum DiscussionTopic {
  MarketTrend = 'market_trend',
  StrategyReview = 'strategy_review',
  RiskControl = 'risk_control',
  Opportunity = 'opportunity',
}

/** 讨论话题标签 */
export const TOPIC_LABELS: Record<DiscussionTopic, string> = {
  [DiscussionTopic.MarketTrend]: '大盘趋势',
  [DiscussionTopic.StrategyReview]: '策略复盘',
  [DiscussionTopic.RiskControl]: '风控讨论',
  [DiscussionTopic.Opportunity]: '机会发现',
};

/** 讨论小组 */
export interface DiscussionGroup {
  id: string;
  agentIds: string[];
  topic: DiscussionTopic;
  centerX: number;
  centerY: number;
  currentTurn: number;
  totalTurns: number;
  dialogues: DialogueLine[];
  startTime: number;
}

/** 对话行 */
export interface DialogueLine {
  agentId: string;
  /** 角色: winner=高收益, loser=亏损, neutral=中性 */
  role: 'winner' | 'loser' | 'neutral';
  text: string;
}

/** 气泡配置 */
export interface BubbleConfig {
  width?: number;
  height?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  bgColor?: number;
  bgAlpha?: number;
  textColor?: string;
  fontSize?: string;
  yOffset?: number;
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

// ============================================================
// 场景系统类型
// ============================================================

/** 场景状态 */
export enum SceneState {
  WorldMap = 'world_map',
  TransitionOut = 'transition_out',
  Indoor = 'indoor',
  TransitionIn = 'transition_in',
  Dialogue = 'dialogue',
}

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  /** 世界地图入口坐标 */
  entryX: number;
  entryY: number;
  /** 触发半径（地图格） */
  entryRadius: number;
  /** 室内地图 Phaser cache key */
  indoorMapKey: string;
  /** 室内出生点 */
  spawnX: number;
  spawnY: number;
  /** 室内出口坐标 */
  exitX: number;
  exitY: number;
  /** 返回世界地图坐标 */
  returnX: number;
  returnY: number;
}

/** NPC 定义 */
export interface NPCDef {
  id: string;
  name: string;
  /** 所在地图 ID（'world' 或建筑 id） */
  mapId: string;
  mapX: number;
  mapY: number;
  /** 精灵图 key */
  charKey: string;
  /** 对话脚本 ID */
  dialogueId: string;
  /** 默认朝向 */
  defaultDir: Direction;
}

// ============================================================
// 对话系统类型
// ============================================================

/** 对话树 */
export interface DialogueTree {
  id: string;
  firstNode: string;
  nodes: Record<string, DialogueNode>;
}

/** 对话节点 */
export interface DialogueNode {
  id: string;
  speaker: string;
  /** 头像 key（对应 14_head/ 中的文件编号） */
  portraitKey: string;
  text: string;
  /** 分支选项 */
  choices?: DialogueChoice[];
  /** 无 choices 时自动跳转的下一节点 ID，无则对话结束 */
  next?: string;
}

/** 对话选项 */
export interface DialogueChoice {
  text: string;
  next: string;
}
