// ============================================================
// DialogueSystem.ts — 对话引擎
// ============================================================

import type { DialogueTree, DialogueNode, DialogueChoice } from '../types';
import { DIALOGUE_TYPE_SPEED } from '../config';
import { DIALOGUE_SCRIPTS } from '../data/DialogueScripts';
import type { EventBus } from '../core/EventBus';

export class DialogueSystem {
  private eventBus: EventBus;
  private activeTree: DialogueTree | null = null;
  private currentNode: DialogueNode | null = null;
  private isTyping = false;
  private fullText = '';
  private typedIndex = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
  }

  /** 开始对话 */
  startDialogue(dialogueId: string): boolean {
    const tree = DIALOGUE_SCRIPTS[dialogueId];
    if (!tree) {
      console.warn('Dialogue script not found:', dialogueId);
      return false;
    }
    this.activeTree = tree;
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
    this.fullText = node.text;
    this.typedIndex = 0;
    this.isTyping = true;

    // 显示面板（先空文本）
    this.eventBus.emit('dialogue:show', {
      speaker: node.speaker,
      portraitKey: node.portraitKey,
      text: '',
      choices: [],
    });

    // 开始打字效果
    this.startTypewriter();
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
        this.eventBus.emit('dialogue:text-update', currentText);

        if (this.typedIndex >= this.fullText.length) {
          this.isTyping = false;
          this.typeTimer?.destroy();
          this.typeTimer = null;
          // 打字完成，显示选项（如果有）
          if (this.currentNode.choices && this.currentNode.choices.length > 0) {
            this.eventBus.emit('dialogue:show', {
              speaker: this.currentNode.speaker,
              portraitKey: this.currentNode.portraitKey,
              text: this.fullText,
              choices: this.currentNode.choices,
            });
          }
        }
      },
      loop: true,
    });
  }

  /** 推进对话（点击/按键） */
  advance(): void {
    if (!this.currentNode) return;

    if (this.isTyping) {
      // 跳过打字，直接显示完整文本
      this.isTyping = false;
      this.typeTimer?.destroy();
      this.typeTimer = null;
      this.eventBus.emit('dialogue:text-update', this.fullText);

      // 显示选项
      if (this.currentNode.choices && this.currentNode.choices.length > 0) {
        this.eventBus.emit('dialogue:show', {
          speaker: this.currentNode.speaker,
          portraitKey: this.currentNode.portraitKey,
          text: this.fullText,
          choices: this.currentNode.choices,
        });
      }
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
  choose(choiceIndex: number): void {
    if (!this.currentNode?.choices) return;
    const choice = this.currentNode.choices[choiceIndex];
    if (!choice) return;
    this.showNode(choice.next);
  }

  /** 结束对话 */
  endDialogue(): void {
    this.activeTree = null;
    this.currentNode = null;
    this.isTyping = false;
    if (this.typeTimer) {
      this.typeTimer.destroy();
      this.typeTimer = null;
    }
    this.eventBus.emit('dialogue:hide');
  }

  isActive(): boolean {
    return this.activeTree !== null;
  }
}
