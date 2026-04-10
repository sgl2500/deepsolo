// ============================================================
// BubbleFactory.ts — 通用气泡系统（打字效果 + 淡入淡出）
// ============================================================

import { BUBBLE_DURATION, BUBBLE_TYPE_INTERVAL, BUBBLE_FADE_IN, BUBBLE_FADE_OUT } from '../config';

export interface BubbleHandle {
  destroy(): void;
}

export class BubbleFactory {
  /**
   * 在指定父容器上创建气泡
   * @returns BubbleHandle，可手动销毁
   */
  static create(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    text: string,
    yOffset = -120,
  ): BubbleHandle {
    const bubbleContainer = scene.add.container(5, yOffset).setAlpha(0);

    // 背景
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.92);
    bg.fillRoundedRect(-60, -14, 120, 28, 7);
    bg.fillTriangle(-2, 14, 2, 14, 0, 21);
    bubbleContainer.add(bg);

    // 文字
    const txtObj = scene.add.text(0, 0, '', {
      fontFamily: 'PingFang SC, monospace',
      fontSize: '10px',
      color: '#1f2937',
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
      destroy: () => {
        bubbleContainer.destroy();
      },
    };
  }
}
