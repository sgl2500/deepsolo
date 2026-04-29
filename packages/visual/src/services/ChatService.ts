// ============================================================
// ChatService.ts — WebSocket 聊天客户端
// ============================================================

import { DebugLogger } from '../utils/DebugLogger';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatReply {
  type: 'reply' | 'history' | 'error';
  agent_id: string;
  text: string;
  messages?: ChatMessage[];
}

type ReplyCallback = (data: ChatReply) => void;

export class ChatService {
  private ws: WebSocket | null = null;
  private replyCallbacks: ReplyCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      console.warn('[ChatService] WebSocket 创建失败，LLM 对话不可用');
      return;
    }

    this.ws.onopen = () => {
      DebugLogger.info('ChatService', '已连接');
    };

    this.ws.onmessage = (event) => {
      try {
        const data: ChatReply = JSON.parse(event.data);
        this.replyCallbacks.forEach(cb => cb(data));
      } catch {
        console.error('[ChatService] 消息解析失败:', event.data);
      }
    };

    this.ws.onclose = () => {
      DebugLogger.info('ChatService', '连接关闭');
      // 5秒后自动重连
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };

    this.ws.onerror = () => {
      console.warn('[ChatService] 连接错误');
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(agentId: string, message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ChatService] 未连接，无法发送消息');
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'chat',
      agent_id: agentId,
      message,
    }));
  }

  requestHistory(agentId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'history',
      agent_id: agentId,
    }));
  }

  onReply(callback: ReplyCallback): void {
    this.replyCallbacks.push(callback);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
