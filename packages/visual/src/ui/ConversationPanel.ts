// ============================================================
// ConversationPanel.ts — 统一对话面板
// 支持 NPC 预设对话 / Agent 聊天 / 通用弹窗
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { Conversation, ConvMessage, ConvChoice, ConvInputMode } from '../types';

export class ConversationPanel {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private headerEl: HTMLElement;
  private closeBtn: HTMLElement;
  private messagesEl: HTMLElement;
  private inputArea: HTMLElement;

  private eventBus: EventBus;
  private _isOpen = false;
  private currentConvId: string | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'conv-overlay';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Panel
    this.panel = document.createElement('div');
    this.panel.className = 'conv-panel';

    // Header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'conv-header';

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'conv-close-btn';
    this.closeBtn.textContent = '✕';
    this.closeBtn.addEventListener('click', () => this.close());
    this.headerEl.appendChild(this.closeBtn);

    this.panel.appendChild(this.headerEl);

    // Messages
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'conv-messages';
    this.panel.appendChild(this.messagesEl);

    // Input area (choices or text input)
    this.inputArea = document.createElement('div');
    this.inputArea.className = 'conv-input-area';
    this.panel.appendChild(this.inputArea);

    this.overlay.appendChild(this.panel);
    this.hide();

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.overlay);
    }

    // Subscribe to events
    eventBus.on('conv:open', (conv) => this.open(conv));
    eventBus.on('conv:message', (msg) => this.addMessage(msg));
    eventBus.on('conv:update-last', (data) => this.updateLastMessage(data.text, data.choices));
    eventBus.on('conv:close', () => this.close());
  }

  // ── Public API ──

  open(conv: Conversation): void {
    this.currentConvId = conv.id;

    // Header
    const titleEl = document.createElement('span');
    titleEl.className = 'conv-title';
    titleEl.textContent = conv.title;
    this.headerEl.insertBefore(titleEl, this.closeBtn);

    // Portrait
    if (conv.portraitKey) {
      const portraitEl = document.createElement('img');
      portraitEl.className = 'conv-portrait';
      portraitEl.src = `assets/jy-runtime/14_head/${conv.portraitKey}.png`;
      portraitEl.alt = conv.title;
      this.headerEl.insertBefore(portraitEl, titleEl);
    }

    // Messages
    this.messagesEl.innerHTML = '';
    conv.messages.forEach(msg => this.appendMessage(msg));

    // Input mode
    this.renderInputArea(conv.inputMode, conv.inputPlaceholder, conv.inputType);

    this._isOpen = true;
    this.overlay.style.display = 'flex';
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.currentConvId = null;
    this.hide();
    // 清理 header 中动态添加的元素（保留 closeBtn）
    while (this.headerEl.firstChild !== this.closeBtn) {
      this.headerEl.removeChild(this.headerEl.firstChild!);
    }
    this.eventBus.emit('conv:close');
  }

  addMessage(msg: ConvMessage): void {
    this.appendMessage(msg);
    this.scrollToBottom();
  }

  updateLastMessage(text: string, choices?: ConvChoice[]): void {
    const last = this.messagesEl.lastElementChild as HTMLElement | null;
    if (!last) return;
    const textEl = last.querySelector('.conv-msg-text') as HTMLElement;
    if (textEl) textEl.textContent = text;
    if (choices) {
      this.renderChoicesInMessage(last, choices);
    }
  }

  setInputMode(mode: ConvInputMode, placeholder?: string, inputType?: 'text' | 'number'): void {
    this.renderInputArea(mode, placeholder, inputType);
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  getCurrentConvId(): string | null {
    return this.currentConvId;
  }

  // ── Internal ──

  private hide(): void {
    this.overlay.style.display = 'none';
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private appendMessage(msg: ConvMessage): void {
    const el = document.createElement('div');
    el.className = `conv-msg conv-msg-${msg.role}`;
    el.dataset.msgId = msg.id;

    if (msg.role === 'npc') {
      // NPC 消息: 头像 + 名字 + 文字
      if (msg.portraitKey) {
        const img = document.createElement('img');
        img.className = 'conv-msg-portrait';
        img.src = `assets/jy-runtime/14_head/${msg.portraitKey}.png`;
        el.appendChild(img);
      }
      const body = document.createElement('div');
      body.className = 'conv-msg-body';
      if (msg.speakerName) {
        const nameEl = document.createElement('div');
        nameEl.className = 'conv-msg-name';
        nameEl.textContent = msg.speakerName;
        body.appendChild(nameEl);
      }
      const textEl = document.createElement('div');
      textEl.className = 'conv-msg-text';
      textEl.textContent = msg.text;
      body.appendChild(textEl);
      el.appendChild(body);
    } else if (msg.role === 'system') {
      const textEl = document.createElement('div');
      textEl.className = 'conv-msg-text';
      textEl.textContent = msg.text;
      el.appendChild(textEl);
    } else {
      // user / assistant
      const textEl = document.createElement('div');
      textEl.className = 'conv-msg-text';
      textEl.textContent = msg.text;
      el.appendChild(textEl);
    }

    // 选项（如果有）
    if (msg.choices && msg.choices.length > 0) {
      this.renderChoicesInMessage(el, msg.choices);
    }

    this.messagesEl.appendChild(el);
  }

  private renderChoicesInMessage(container: HTMLElement, choices: ConvChoice[]): void {
    // 移除已有选项
    const existing = container.querySelector('.conv-msg-choices');
    if (existing) existing.remove();

    const choicesEl = document.createElement('div');
    choicesEl.className = 'conv-msg-choices';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'conv-choice-btn';
      btn.textContent = c.text;
      btn.addEventListener('click', () => {
        this.eventBus.emit('conv:choice', c.value);
      });
      choicesEl.appendChild(btn);
    });
    container.appendChild(choicesEl);
  }

  private renderInputArea(mode: ConvInputMode, placeholder?: string, inputType?: 'text' | 'number'): void {
    this.inputArea.innerHTML = '';

    if (mode === 'text') {
      const input = document.createElement('input');
      input.className = 'conv-text-input';
      input.type = inputType || 'text';
      input.placeholder = placeholder || '输入消息...';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendTextInput(input);
        }
      });

      const sendBtn = document.createElement('button');
      sendBtn.className = 'conv-send-btn';
      sendBtn.textContent = '发送';
      sendBtn.addEventListener('click', () => this.sendTextInput(input));

      this.inputArea.appendChild(input);
      this.inputArea.appendChild(sendBtn);

      // Focus input after a frame (panel needs to be visible)
      requestAnimationFrame(() => input.focus());
    } else if (mode === 'choices') {
      // choices 模式由消息中的 choices 字段驱动，输入区留空
      const hint = document.createElement('div');
      hint.className = 'conv-hint';
      hint.textContent = '选择一个选项';
      this.inputArea.appendChild(hint);
    } else {
      // none 模式
      const hint = document.createElement('div');
      hint.className = 'conv-hint';
      hint.textContent = '按空格继续';
      this.inputArea.appendChild(hint);
    }
  }

  private sendTextInput(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.eventBus.emit('conv:send', text);
  }
}
