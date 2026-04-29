/** 条件名（可扩展） */
export type StoryConditionName =
  | 'strategy_exists'
  | 'strategy_return_gt'
  | 'flag_not_set'
  | 'flag_is'
  | 'day_gt'
  | 'never_completed';

/** 动作名（可扩展） */
export type StoryActionName =
  | 'set_flag'
  | 'mark_completed'
  | 'add_event_log';

/** 带参数的条件 */
export interface StoryCondition {
  type: StoryConditionName;
  params: Record<string, any>;
}

/** 带参数的动作 */
export interface StoryAction {
  type: StoryActionName;
  params: Record<string, any>;
}

/** 触发器：定义故事何时可以被激活 */
export interface StoryTrigger {
  sceneState: 'indoor';
  buildingId: string;
  conditions: StoryCondition[];
  oncePerVisit?: boolean;
}

/** 故事选项（增加条件和动作） */
export interface StoryChoice {
  text: string;
  next: string;
  showCondition?: StoryCondition;
  onSelect?: StoryAction[];
}

/** 故事对话节点 */
export interface StoryNode {
  id: string;
  speaker: string;
  portraitKey: string;
  text: string;
  choices?: StoryChoice[];
  next?: string;
  showCondition?: StoryCondition;
  onShow?: StoryAction[];
}

/** 完整故事脚本 */
export interface StoryScript {
  id: string;
  trigger: StoryTrigger;
  priority?: number;
  firstNode: string;
  nodes: Record<string, StoryNode>;
  onStart?: StoryAction[];
  onComplete?: StoryAction[];
}
