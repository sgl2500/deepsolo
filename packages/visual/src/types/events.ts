import type { BattleResult } from './battle';
import type { AuthSession } from './auth';
import type { ConvChoice, ConvInputMode, Conversation, ConvMessage } from './conversation';
import type { DiscussionGroup, DiscussionTopic } from './discussion';
import type { PlayerProgress } from './player';
import type { AgentState, Strategy } from './strategy';
import type { ObserverAccount, TokenListing } from './token';
import type { SceneState } from './world';

/** EventBus 事件映射 */
export interface GameEvents {
  'strategy:loaded': Strategy[];
  'strategy:state-changed': { id: string; oldState: AgentState; newState: AgentState };
  'strategy:selected': Strategy | null;
  'agent:moved': { id: string; x: number; y: number };
  'player:moved': { x: number; y: number };
  'player:progress-changed': PlayerProgress;
  'player:currency-changed': { currency: 'yuanbao'; amount: number; balance: number; reason?: string };
  'shop:purchase': { productId: string; manualId: string; price: number; learned: boolean };
  'npc:favor-changed': { npcId: string; favorBefore: number; favorAfter: number; amount: number };
  'day:tick': number;
  'bubble:show': { entityId: string; text: string };
  'discussion:started': { groupId: string; agents: string[]; topic: DiscussionTopic };
  'discussion:turn': { groupId: string; agentId: string; agentName: string; text: string };
  'discussion:ended': { groupId: string; agents: string[] };
  'discussion:view': DiscussionGroup;
  'ui:refresh': void;
  'auth:login': AuthSession;
  'auth:logout': void;
  'auth:changed': AuthSession | null;
  'scene:state-changed': { state: SceneState; buildingId?: string };
  // ── 统一对话事件 ──
  'conv:open': Conversation;
  'conv:message': ConvMessage;
  'conv:update-last': { text: string; choices?: ConvChoice[]; inputMode?: ConvInputMode };
  'conv:close': void;
  'conv:choice': string;
  'conv:send': string;
  // ── 生命周期事件（后端驱动） ──
  'agent:born': { id: string; name: string; parents?: string[]; detail: string };
  'agent:eliminated': { id: string; name: string; reason: string; detail: string };
  'discussion:event': { agents: string[]; agentNames: string[]; dialogues: Array<{ agent_id: string; text: string }>; complementary: boolean };
  // ── Token 中心事件 ──
  'token:listed': TokenListing;
  'token:cancel': string;
  'account:updated': ObserverAccount;
  // ── 战斗系统事件 ──
  'battle:start': { redId: string; blueId: string };
  'battle:action': { actorId: string; actorName: string; action: string; damage: number; targetHp: number; hit: boolean };
  'battle:end': BattleResult;
  // ── 剧情系统事件 ──
  'story:started': { storyId: string };
  'story:completed': { storyId: string };
  'story:start-requested': { storyId: string };
  'story:battle-requested': { battleId: string };
}
