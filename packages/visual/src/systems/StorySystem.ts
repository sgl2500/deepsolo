// ============================================================
// StorySystem.ts — 剧情引擎：触发检测、状态机、打字机、动作执行
// ============================================================
//
// 通用脚本执行引擎，不包含任何具体剧情逻辑。
// 添加新剧情只需在 StoryScripts.ts 追加数据。
// ============================================================

import type { StoryScript, StoryNode, StoryChoice, ConvChoice } from '../types';
import { DIALOGUE_TYPE_SPEED } from '../config';
import { STORY_SCRIPTS } from '../data/StoryScripts';
import { evaluateAllConditions, executeActions } from '../data/StoryRegistry';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { paginateDialogueText } from '../utils/DialogueText';

let msgCounter = 0;
function nextMsgId(): string {
  return 'sm_' + (++msgCounter);
}

export class StorySystem {
  private scene: Phaser.Scene;
  private eventBus: EventBus;
  private store: GameStore;

  private activeStory: StoryScript | null = null;
  private currentNode: StoryNode | null = null;
  private isTyping = false;
  private fullText = '';
  private textPages: string[] = [];
  private pageIndex = 0;
  private typedIndex = 0;
  private typeTimer: Phaser.Time.TimerEvent | null = null;

  /** 每次 visit 中已触发的 story id，防止同一 visit 重复触发 */
  private triggeredThisSession = new Set<string>();

  constructor(scene: Phaser.Scene, eventBus: EventBus, store: GameStore) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.store = store;

    // 监听室内场景切换 → 延迟检查触发
    eventBus.on('scene:state-changed', ({ state, buildingId }) => {
      if (state === 'indoor' && buildingId) {
        this.triggeredThisSession.clear();
        this.scene.time.delayedCall(1000, () => {
          this.checkTriggers(buildingId);
        });
      }
    });

    eventBus.on('npc:favor-changed', ({ npcId }) => {
      this.checkFavorTriggers(npcId);
    });

    // 监听选择事件
    eventBus.on('conv:choice', (value: string) => {
      if (this.activeStory) {
        this.handleChoice(value);
      }
    });
  }

  /** 检查所有脚本触发条件 */
  private checkTriggers(buildingId: string): void {
    if (this.activeStory) return; // 已有剧情在进行

    for (const script of STORY_SCRIPTS) {
      const { trigger } = script;
      if (!('sceneState' in trigger)) continue;
      if (trigger.buildingId !== buildingId) continue;
      if (trigger.sceneState !== 'indoor') continue;
      if (this.triggeredThisSession.has(script.id)) continue;

      // 检查所有条件
      if (!evaluateAllConditions(trigger.conditions, this.store)) continue;

      // 匹配成功
      this.triggeredThisSession.add(script.id);
      this.startStory(script);
      return; // 每次只触发一个
    }
  }

  private checkFavorTriggers(npcId: string): void {
    if (this.activeStory) return;

    for (const script of STORY_SCRIPTS) {
      const { trigger } = script;
      if (!('event' in trigger)) continue;
      if (trigger.event !== 'npc_favor_changed' || trigger.npcId !== npcId) continue;
      if (!evaluateAllConditions(trigger.conditions, this.store)) continue;

      this.startStory(script);
      return;
    }
  }

  /** 开始故事 */
  private startStory(script: StoryScript): void {
    this.activeStory = script;

    // 执行 onStart 动作
    executeActions(script.onStart, this.store, this.eventBus);

    // 打开对话面板
    this.eventBus.emit('conv:open', {
      id: 'story_' + script.id,
      title: '',
      messages: [],
      inputMode: 'none',
    });

    this.eventBus.emit('story:started', { storyId: script.id });

    // 显示第一个节点
    this.showNode(script.firstNode);
  }

  /** 手动启动指定故事，用于 NPC / 物件驱动的剧情入口 */
  startStoryById(storyId: string): boolean {
    if (this.activeStory) return false;

    const script = STORY_SCRIPTS.find((item) => item.id === storyId);
    if (!script) {
      console.warn('[StorySystem] Story script not found:', storyId);
      return false;
    }
    if (!evaluateAllConditions(script.trigger.conditions, this.store)) return false;

    this.startStory(script);
    return true;
  }

  /** 显示指定节点 */
  private showNode(nodeId: string): void {
    if (!this.activeStory) return;
    const node = this.activeStory.nodes[nodeId];
    if (!node) {
      this.endStory();
      return;
    }

    // 检查 showCondition → 不满足则跳到 next
    if (node.showCondition && !evaluateAllConditions([node.showCondition], this.store)) {
      if (node.next) {
        this.showNode(node.next);
      } else {
        this.endStory();
      }
      return;
    }

    // 执行 onShow 动作
    executeActions(node.onShow, this.store, this.eventBus);

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
          if (this.isLastPage()) {
            this.showChoices();
          }
        }
      },
      loop: true,
    });
  }

  /** 显示选项（过滤 showCondition） */
  private showChoices(): void {
    if (!this.currentNode?.choices || this.currentNode.choices.length === 0) return;

    const visibleChoices = this.currentNode.choices.filter(c =>
      !c.showCondition || evaluateAllConditions([c.showCondition], this.store),
    );
    if (visibleChoices.length === 0) return;

    const convChoices: ConvChoice[] = visibleChoices.map((c, i) => ({
      text: c.text,
      value: String(i),
    }));
    this.eventBus.emit('conv:update-last', {
      text: this.fullText,
      choices: convChoices,
      inputMode: 'choices',
    });
  }

  /** 推进对话（Space 键触发） */
  advance(): void {
    if (!this.currentNode) return;

    if (this.isTyping) {
      // 跳过打字，直接显示完整文本 + 选项
      this.isTyping = false;
      this.typeTimer?.destroy();
      this.typeTimer = null;
      const emitData: { text: string; choices?: ConvChoice[]; inputMode?: 'choices' } = {
        text: this.fullText,
      };
      if (this.isLastPage() && this.currentNode.choices && this.currentNode.choices.length > 0) {
        const visibleChoices = this.currentNode.choices.filter(c =>
          !c.showCondition || evaluateAllConditions([c.showCondition], this.store),
        );
        if (visibleChoices.length > 0) {
          emitData.choices = visibleChoices.map((c, i) => ({
            text: c.text,
            value: String(i),
          }));
          emitData.inputMode = 'choices';
        }
      }
      this.eventBus.emit('conv:update-last', emitData);
      return;
    }

    if (!this.isLastPage()) {
      this.pageIndex++;
      this.showCurrentPage();
      return;
    }

    // 有选项，不做任何事（等用户选择）
    if (this.currentNode.choices && this.currentNode.choices.length > 0) {
      return;
    }

    // 自动跳到下一节点
    if (this.currentNode.next) {
      this.showNode(this.currentNode.next);
    } else {
      this.endStory();
    }
  }

  /** 处理选择 */
  private handleChoice(value: string): void {
    if (!this.currentNode?.choices) return;

    // 过滤可见选项后按索引映射
    const visibleChoices = this.currentNode.choices.filter(c =>
      !c.showCondition || evaluateAllConditions([c.showCondition], this.store),
    );
    const index = parseInt(value, 10);
    const choice = visibleChoices[index];
    if (!choice) return;

    // 执行 onSelect 动作
    executeActions(choice.onSelect, this.store, this.eventBus);

    this.showNode(choice.next);
  }

  /** 正常结束故事 */
  private endStory(): void {
    if (!this.activeStory) return;

    // 执行 onComplete 动作
    executeActions(this.activeStory.onComplete, this.store, this.eventBus);
    this.eventBus.emit('story:completed', { storyId: this.activeStory.id });

    this.cleanup();
    this.eventBus.emit('conv:close');
  }

  /** 外部强制终止（conv:close 时调用） */
  forceEnd(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.activeStory = null;
    this.currentNode = null;
    this.textPages = [];
    this.pageIndex = 0;
    this.isTyping = false;
    if (this.typeTimer) {
      this.typeTimer.destroy();
      this.typeTimer = null;
    }
  }

  /** 是否有剧情在进行 */
  isActive(): boolean {
    return this.activeStory !== null;
  }
}
