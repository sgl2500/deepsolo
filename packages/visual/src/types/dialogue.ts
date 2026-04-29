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
