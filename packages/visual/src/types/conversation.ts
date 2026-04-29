/** 对话选项 */
export interface ConvChoice {
  text: string;
  value: string;
}

/** 对话消息 */
export interface ConvMessage {
  id: string;
  role: 'npc' | 'user' | 'assistant' | 'system';
  speakerName?: string;
  portraitKey?: string;
  text: string;
  choices?: ConvChoice[];
}

/** 输入模式 */
export type ConvInputMode = 'none' | 'choices' | 'text';

/** 对话 */
export interface Conversation {
  id: string;
  title: string;
  portraitKey?: string;
  messages: ConvMessage[];
  inputMode: ConvInputMode;
  inputPlaceholder?: string;
  inputType?: 'text' | 'number';
}
