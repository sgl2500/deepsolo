// ============================================================
// BubbleFactory.ts — 通用气泡系统（支持自定义样式）
// ============================================================

import { BUBBLE_DURATION, BUBBLE_TYPE_INTERVAL, BUBBLE_FADE_IN, BUBBLE_FADE_OUT } from '../config';
import { DISCUSSION_BUBBLE_W, DISCUSSION_BUBBLE_H, DISCUSSION_COLORS } from '../config';
import type { BubbleConfig, StrategyCategory } from '../types';

export interface BubbleHandle {
  destroy(): void;
}

const DEFAULT_CONFIG: Required<BubbleConfig> = {
  width: 120,
  height: 28,
  borderColor: 0xffffff,
  borderAlpha: 0,
  borderWidth: 0,
  bgColor: 0xffffff,
  bgAlpha: 0.92,
  textColor: '#1f2937',
  fontSize: '10px',
  yOffset: -120,
};

export class BubbleFactory {
  /**
   * 在指定父容器上创建气泡
   */
  static create(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    text: string,
    config?: BubbleConfig,
  ): BubbleHandle {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const bubbleContainer = scene.add.container(5, cfg.yOffset).setAlpha(0);

    const bg = scene.add.graphics();

    // 边框（如果有）
    if (cfg.borderWidth > 0) {
      bg.lineStyle(cfg.borderWidth, cfg.borderColor, cfg.borderAlpha);
      bg.strokeRoundedRect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height, 7);
    }

    // 背景
    bg.fillStyle(cfg.bgColor, cfg.bgAlpha);
    bg.fillRoundedRect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height, 7);

    // 三角指针
    bg.fillStyle(cfg.bgColor, cfg.bgAlpha);
    bg.fillTriangle(-2, cfg.height / 2, 2, cfg.height / 2, 0, cfg.height / 2 + 7);
    bubbleContainer.add(bg);

    // 文字（自动换行）
    const txtObj = scene.add.text(0, 0, '', {
      fontFamily: 'PingFang SC, monospace',
      fontSize: cfg.fontSize,
      color: cfg.textColor,
      align: 'center',
      wordWrap: { width: cfg.width - 12 },
    }).setOrigin(0.5);
    bubbleContainer.add(txtObj);

    parent.add(bubbleContainer);

    // 淡入
    scene.tweens.add({ targets: bubbleContainer, alpha: 1, duration: BUBBLE_FADE_IN });

    // 打字效果
    let i = 0;
    scene.time.addEvent({
      delay: BUBBLE_TYPE_INTERVAL,
      repeat: text.length - 1,
      callback: () => { i++; txtObj.setText(text.substring(0, i)); },
    });

    // 自动淡出
    scene.time.delayedCall(BUBBLE_DURATION, () => {
      scene.tweens.add({
        targets: bubbleContainer,
        alpha: 0,
        duration: BUBBLE_FADE_OUT,
        onComplete: () => bubbleContainer.destroy(),
      });
    });

    return {
      destroy: () => { bubbleContainer.destroy(); },
    };
  }

  /** 生成讨论气泡的配置 */
  static discussionConfig(category: StrategyCategory): BubbleConfig {
    return {
      width: DISCUSSION_BUBBLE_W,
      height: DISCUSSION_BUBBLE_H,
      borderColor: DISCUSSION_COLORS[category] ?? 0xffffff,
      borderAlpha: 0.8,
      borderWidth: 2,
      bgColor: 0xffffff,
      bgAlpha: 0.95,
      textColor: '#1f2937',
      fontSize: '9px',
      yOffset: -130,
    };
  }
}
