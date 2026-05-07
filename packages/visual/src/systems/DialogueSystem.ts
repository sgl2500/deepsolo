// ============================================================
// DialogueSystem.ts — 对话引擎（适配 Conversation 模型）
// ============================================================

import type { DialogueTree, DialogueNode, ConvChoice } from '../types';
import { DIALOGUE_TYPE_SPEED } from '../config';
import { DIALOGUE_SCRIPTS } from '../data/DialogueScripts';
import { EXTRA_DIALOGUE_SCRIPTS } from '../content/ExtraDialogueScripts';
import type { EventBus } from '../core/EventBus';
import { paginateDialogueText } from '../utils/DialogueText';

let msgCounter = 0;
function nextMsgId(): string {
  return 'dm_' + (++msgCounter);
}

export class DialogueSystem {
  private eventBus: EventBus;
  private activeTree: DialogueTree | null = null;
  private currentNode: DialogueNode | null = null;
  private isTyping = false;
  private fullText = '';
  private textPages: string[] = [];
  private pageIndex = 0;
  private typedIndex = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;

    // 监听选项选择
    eventBus.on('conv:choice', (value: string) => {
      this.choose(value);
    });
  }

  /** 开始对话 */
  startDialogue(dialogueId: string): boolean {
    const tree = EXTRA_DIALOGUE_SCRIPTS[dialogueId] || DIALOGUE_SCRIPTS[dialogueId];
    if (!tree) {
      console.warn('Dialogue script not found:', dialogueId);
      return false;
    }
    this.activeTree = tree;

    // 先创建空的 Conversation
    this.eventBus.emit('conv:open', {
      id: 'dialogue_' + dialogueId,
      title: '',
      messages: [],
      inputMode: 'none',
    });

    this.showNode(tree.firstNode);
    return true;
  }

  /** 显示指定节点 */
  private showNode(nodeId: string): void {
    if (!this.activeTree) return;
    const node = this.activeTree.nodes[nodeId];
    if (!node) {
      this.endDialogue();
      return;
    }
    this.currentNode = node;
    this.textPages = paginateDialogueText(node.text);
    this.pageIndex = 0;
    this.showCurrentPage();
  }

  private showCurrentPage(): void {
    if (!this.currentNode) return;
    const node = this.currentNode;

    this.fullText = this.textPages[this.pageIndex] ?? '';
    this.typedIndex = 0;
    this.isTyping = true;

    // 更新 Conversation 的 title/portrait（首次通过 header 逻辑不在这处理，消息里带头像）
    // 推送一条空的 NPC 消息
    this.eventBus.emit('conv:message', {
      id: nextMsgId(),
      role: 'npc',
      speakerName: node.speaker,
      portraitKey: node.portraitKey,
      text: '',
      choices: [],
    });

    // 开始打字效果
    this.startTypewriter();
  }

  private isLastPage(): boolean {
    return this.pageIndex >= this.textPages.length - 1;
  }

  /** 打字机效果 */
  private startTypewriter(): void {
    if (this.typeTimer) {
      this.typeTimer.destroy();
    }
    this.typeTimer = this.scene.time.addEvent({
      delay: DIALOGUE_TYPE_SPEED,
      callback: () => {
        if (!this.isTyping || !this.currentNode) return;
        this.typedIndex++;
        const currentText = this.fullText.slice(0, this.typedIndex);
        this.eventBus.emit('conv:update-last', { text: currentText });

        if (this.typedIndex >= this.fullText.length) {
          this.isTyping = false;
          this.typeTimer?.destroy();
          this.typeTimer = null;
          // 打字完成，如果有选项则显示
          if (this.isLastPage() && this.currentNode.choices && this.currentNode.choices.length > 0) {
            const convChoices: ConvChoice[] = this.currentNode.choices.map((c, i) => ({
              text: c.text,
              value: String(i),
            }));
            this.eventBus.emit('conv:update-last', {
              text: this.fullText,
              choices: convChoices,
              inputMode: 'choices',
            });
          }
        }
      },
      loop: true,
    });
  }

  /** 推进对话（空格键触发） */
  advance(): void {
    if (!this.currentNode) return;

    if (this.isTyping) {
      // 跳过打字，直接显示完整文本
      this.isTyping = false;
      this.typeTimer?.destroy();
      this.typeTimer = null;
      const emitData: { text: string; choices?: ConvChoice[]; inputMode?: 'choices' } = {
        text: this.fullText,
      };
      if (this.isLastPage() && this.currentNode.choices && this.currentNode.choices.length > 0) {
        emitData.choices = this.currentNode.choices.map((c, i) => ({
          text: c.text,
          value: String(i),
        }));
        emitData.inputMode = 'choices';
      }
      this.eventBus.emit('conv:update-last', emitData);
      return;
    }

    if (!this.isLastPage()) {
      this.pageIndex++;
      this.showCurrentPage();
      return;
    }

    // 如果有选项，不做任何事（等用户选择）
    if (this.currentNode.choices && this.currentNode.choices.length > 0) {
      return;
    }

    // 自动跳到下一节点
    if (this.currentNode.next) {
      this.showNode(this.currentNode.next);
    } else {
      this.endDialogue();
    }
  }

  /** 选择分支 */
  choose(choiceValue: string): void {
    if (!this.currentNode?.choices) return;
    const index = parseInt(choiceValue, 10);
    const choice = this.currentNode.choices[index];
    if (!choice) return;
    this.showNode(choice.next);
  }

  /** 结束对话 */
  endDialogue(): void {
    this.cleanup();
    this.eventBus.emit('conv:close');
  }

  /** 强制终止（不触发事件，用于外部关闭时清理状态） */
  forceEnd(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.activeTree = null;
    this.currentNode = null;
    this.textPages = [];
    this.pageIndex = 0;
    this.isTyping = false;
    if (this.typeTimer) {
      this.typeTimer.destroy();
      this.typeTimer = null;
    }
  }

  isActive(): boolean {
    return this.activeTree !== null;
  }
}
