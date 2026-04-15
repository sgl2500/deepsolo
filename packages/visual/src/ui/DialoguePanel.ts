// ============================================================
// DialoguePanel.ts — DOM 对话面板
// 支持：预设对话树（室内NPC）+ 自由聊天（策略Agent）
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { ChatService, ChatMessage } from '../services/ChatService';
import type { DialogueChoice, Strategy } from '../types';
import './styles.css';

/** 对话模式 */
type PanelMode = 'closed' | 'scripted' | 'chat';

export class DialoguePanel {
  private container: HTMLElement;
  private overlay: HTMLElement;

  // 预设对话模式元素
  private scriptedPanel: HTMLElement;
  private portraitEl!: HTMLImageElement;
  private speakerEl!: HTMLElement;
  private textEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  private hintEl!: HTMLElement;

  // 自由聊天模式元素
  private chatPanel: HTMLElement;
  private chatHeader!: HTMLElement;
  private chatMessages!: HTMLElement;
  private chatInput!: HTMLInputElement;
  private chatSendBtn!: HTMLButtonElement;
  private chatCloseBtn!: HTMLButtonElement;
  private chatTyping!: HTMLElement;

  private eventBus: EventBus;
  private chatService: ChatService | null = null;
  private currentAgentId: string | null = null;
  private currentAgentName: string = '';
  private mode: PanelMode = 'closed';

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // 创建主容器
    this.container = document.createElement('div');
    this.container.className = 'dialogue-root';

    // 预设对话面板
    this.scriptedPanel = this.createScriptedPanel();
    this.container.appendChild(this.scriptedPanel);

    // 自由聊天面板
    this.chatPanel = this.createChatPanel();
    this.container.appendChild(this.chatPanel);

    // overlay 背景
    this.overlay = document.createElement('div');
    this.overlay.className = 'dialogue-overlay-bg';
    this.overlay.style.display = 'none';
    this.overlay.addEventListener('click', () => this.close());

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.overlay);
      gameContainer.appendChild(this.container);
    }

    // 订阅预设对话事件
    eventBus.on('dialogue:show', (data) => this.onScriptedShow(data));
    eventBus.on('dialogue:text-update', (text: string) => {
      this.textEl.textContent = text;
    });
    eventBus.on('dialogue:hide', () => this.close());
    eventBus.on('chat:close', () => this.close());
  }

  /** 注入 ChatService */
  setChatService(service: ChatService): void {
    this.chatService = service;
    this.chatService.onReply((data) => this.onChatReply(data));
  }

  /** 打开自由聊天模式 */
  openChat(strategy: Strategy): void {
    this.mode = 'chat';
    this.currentAgentId = strategy.id;
    this.currentAgentName = strategy.name;

    this.scriptedPanel.style.display = 'none';
    this.chatPanel.style.display = 'flex';
    this.overlay.style.display = 'block';

    // 更新 header
    const retColor = strategy.returnPct >= 0 ? 'var(--green)' : 'var(--red)';
    const retText = `${strategy.returnPct >= 0 ? '+' : ''}${strategy.returnPct.toFixed(1)}%`;
    this.chatHeader.innerHTML = `<span>${strategy.name}</span><span style="color:${retColor};font-size:11px;margin-left:8px">${retText}</span>`;

    // 清空消息
    this.chatMessages.innerHTML = '';
    this.addSystemMessage(`正在与「${strategy.name}」对话...`);

    // 请求历史对话
    if (this.chatService?.isConnected()) {
      this.chatService.requestHistory(strategy.id);
    } else {
      this.addSystemMessage('LLM 服务未连接，对话功能不可用。请先启动后端。');
    }

    this.chatInput.value = '';
    this.chatInput.focus();
  }

  /** 关闭所有面板 */
  close(): void {
    const wasOpen = this.mode !== 'closed';
    this.mode = 'closed';
    this.currentAgentId = null;
    this.scriptedPanel.style.display = 'none';
    this.chatPanel.style.display = 'none';
    this.overlay.style.display = 'none';
    if (wasOpen) {
      this.eventBus.emit('chat:close');
    }
  }

  isOpen(): boolean {
    return this.mode !== 'closed';
  }

  // ── 预设对话模式 ──

  private createScriptedPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'dialogue-panel';
    panel.style.display = 'none';

    const portraitBox = document.createElement('div');
    portraitBox.className = 'dialogue-portrait';
    this.portraitEl = document.createElement('img');
    this.portraitEl.src = '';
    this.portraitEl.alt = 'portrait';
    portraitBox.appendChild(this.portraitEl);
    panel.appendChild(portraitBox);

    const content = document.createElement('div');
    content.className = 'dialogue-content';

    this.speakerEl = document.createElement('div');
    this.speakerEl.className = 'dialogue-speaker';
    content.appendChild(this.speakerEl);

    this.textEl = document.createElement('div');
    this.textEl.className = 'dialogue-text';
    content.appendChild(this.textEl);

    this.choicesEl = document.createElement('div');
    this.choicesEl.className = 'dialogue-choices';
    content.appendChild(this.choicesEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'dialogue-hint';
    this.hintEl.textContent = '按 E 继续';
    content.appendChild(this.hintEl);

    panel.appendChild(content);

    panel.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('dialogue-choice-btn')) return;
      this.eventBus.emit('dialogue:advance');
    });

    return panel;
  }

  private onScriptedShow(data: {
    speaker: string;
    portraitKey: string;
    text: string;
    choices: DialogueChoice[];
  }): void {
    // 如果正在自由聊天，不响应预设对话
    if (this.mode === 'chat') return;

    this.mode = 'scripted';
    this.scriptedPanel.style.display = 'flex';
    this.chatPanel.style.display = 'none';
    this.overlay.style.display = 'block';

    this.speakerEl.textContent = data.speaker;
    this.textEl.textContent = data.text;
    this.portraitEl.src = `assets/jy-assets/14_head/${data.portraitKey}.png`;
    this.portraitEl.style.display = 'block';

    this.choicesEl.innerHTML = '';
    if (data.choices && data.choices.length > 0) {
      data.choices.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'dialogue-choice-btn';
        btn.textContent = c.text;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.eventBus.emit('dialogue:choice', i);
        });
        this.choicesEl.appendChild(btn);
      });
      this.hintEl.style.display = 'none';
    } else {
      this.hintEl.style.display = 'block';
    }
  }

  // ── 自由聊天模式 ──

  private createChatPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.style.display = 'none';

    // Header
    this.chatHeader = document.createElement('div');
    this.chatHeader.className = 'chat-header';
    panel.appendChild(this.chatHeader);

    this.chatCloseBtn = document.createElement('button');
    this.chatCloseBtn.className = 'chat-close-btn';
    this.chatCloseBtn.textContent = '✕';
    this.chatCloseBtn.addEventListener('click', () => this.close());
    this.chatHeader.appendChild(this.chatCloseBtn);

    // 消息区域
    this.chatMessages = document.createElement('div');
    this.chatMessages.className = 'chat-messages';
    panel.appendChild(this.chatMessages);

    // 输入区域
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-input-area';

    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.className = 'chat-input';
    this.chatInput.placeholder = '输入消息...';
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    inputArea.appendChild(this.chatInput);

    this.chatSendBtn = document.createElement('button');
    this.chatSendBtn.className = 'chat-send-btn';
    this.chatSendBtn.textContent = '发送';
    this.chatSendBtn.addEventListener('click', () => this.sendChatMessage());
    inputArea.appendChild(this.chatSendBtn);

    panel.appendChild(inputArea);

    // Typing indicator
    this.chatTyping = document.createElement('div');
    this.chatTyping.className = 'chat-typing';
    this.chatTyping.textContent = '正在思考...';
    this.chatTyping.style.display = 'none';
    panel.appendChild(this.chatTyping);

    return panel;
  }

  private sendChatMessage(): void {
    const text = this.chatInput.value.trim();
    if (!text || !this.currentAgentId) return;

    // 显示用户消息
    this.addMessage('user', text);
    this.chatInput.value = '';

    // 显示 typing
    this.chatTyping.style.display = 'block';
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // 发送到后端
    this.chatService?.send(this.currentAgentId, text);
  }

  private onChatReply(data: { type: string; agent_id: string; text: string; messages?: ChatMessage[] }): void {
    if (data.type === 'history' && data.messages) {
      // 加载历史消息
      this.chatMessages.innerHTML = '';
      if (data.messages.length === 0) {
        this.addSystemMessage(`与「${this.currentAgentName}」开始对话`);
      } else {
        data.messages.forEach(m => this.addMessage(m.role, m.text));
      }
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      return;
    }

    if (data.type === 'reply' && data.agent_id === this.currentAgentId) {
      this.chatTyping.style.display = 'none';
      this.addMessage('assistant', data.text);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      return;
    }

    if (data.type === 'error') {
      this.chatTyping.style.display = 'none';
      this.addMessage('assistant', data.text);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }

  private addMessage(role: 'user' | 'assistant', text: string): void {
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg-${role}`;
    el.textContent = text;
    this.chatMessages.appendChild(el);
  }

  private addSystemMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-system';
    el.textContent = text;
    this.chatMessages.appendChild(el);
  }
}
