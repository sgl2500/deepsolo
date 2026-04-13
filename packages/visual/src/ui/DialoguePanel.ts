// ============================================================
// DialoguePanel.ts — DOM 对话面板
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { DialogueChoice } from '../types';
import './styles.css';

export class DialoguePanel {
  private container: HTMLElement;
  private portraitEl!: HTMLImageElement;
  private speakerEl!: HTMLElement;
  private textEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.container = this.createDOM();
    this.container.style.display = 'none';

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(this.container);
    }

    // 订阅事件
    eventBus.on('dialogue:show', (data) => this.onShow(data));
    eventBus.on('dialogue:text-update', (text: string) => {
      this.textEl.textContent = text;
    });
    eventBus.on('dialogue:hide', () => this.onHide());
  }

  private createDOM(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'dialogue-overlay';

    const panel = document.createElement('div');
    panel.className = 'dialogue-panel';

    // 头像区域
    const portraitBox = document.createElement('div');
    portraitBox.className = 'dialogue-portrait';
    this.portraitEl = document.createElement('img');
    this.portraitEl.src = '';
    this.portraitEl.alt = 'portrait';
    portraitBox.appendChild(this.portraitEl);
    panel.appendChild(portraitBox);

    // 内容区域
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
    overlay.appendChild(panel);

    // 点击面板推进对话
    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('dialogue-choice-btn')) return;
      this.eventBus.emit('dialogue:advance');
    });

    return overlay;
  }

  private onShow(data: {
    speaker: string;
    portraitKey: string;
    text: string;
    choices: DialogueChoice[];
  }): void {
    this.speakerEl.textContent = data.speaker;
    this.textEl.textContent = data.text;

    // 设置头像
    this.portraitEl.src = `assets/jy-assets/14_head/${data.portraitKey}.png`;
    this.portraitEl.style.display = 'block';

    // 渲染选项
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

    this.container.style.display = 'flex';
  }

  private onHide(): void {
    this.container.style.display = 'none';
    this.choicesEl.innerHTML = '';
  }
}
