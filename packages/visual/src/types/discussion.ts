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
