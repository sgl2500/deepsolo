// ============================================================
// VFXSystem.ts — 天道雷击 + 策略诞生特效
// ============================================================

import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../config';

export class VFXSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 天道雷击 — 在指定屏幕坐标播放闪电消灭特效
   * @param x 屏幕坐标 X
   * @param y 屏幕坐标 Y
   * @param onComplete 特效播放完毕回调
   */
  playHeavenStrike(x: number, y: number, onComplete?: () => void): void {
    // === 阶段 1: 全屏白色闪光 ===
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.4);
    flash.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    flash.setDepth(9999);
    flash.setScrollFactor(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });

    // === 阶段 2: 闪电锯齿线 ===
    const lightning = this.scene.add.graphics();
    lightning.setDepth(9998);
    lightning.setScrollFactor(0);

    // 画主闪电
    this.drawLightning(lightning, x, 0, x, y, 6, 0xfbbf24, 3);
    // 画分支
    this.drawLightning(lightning, x - 20, y * 0.3, x - 40, y * 0.7, 4, 0xfde68a, 2);
    this.drawLightning(lightning, x + 15, y * 0.2, x + 35, y * 0.6, 3, 0xfde68a, 2);

    // 光晕
    const glow = this.scene.add.graphics();
    glow.setDepth(9997);
    glow.setScrollFactor(0);
    glow.fillStyle(0xfbbf24, 0.15);
    glow.fillCircle(x, y, 40);
    glow.fillStyle(0xffffff, 0.3);
    glow.fillCircle(x, y, 15);

    // 闪电淡出
    this.scene.tweens.add({
      targets: [lightning, glow],
      alpha: 0,
      duration: 600,
      delay: 200,
      ease: 'Power2',
      onComplete: () => {
        lightning.destroy();
        glow.destroy();
      },
    });

    // === 阶段 3: 碎片粒子 ===
    const particles: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const r = 3 + Math.random() * 4;
      const p = this.scene.add.circle(x, y, r, 0xfbbf24, 0.9);
      p.setDepth(9998);
      p.setScrollFactor(0);
      particles.push(p);

      const dist = 30 + Math.random() * 40;
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 500 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }

    // === 阶段 4: 完成回调 ===
    this.scene.time.delayedCall(900, () => {
      onComplete?.();
    });
  }

  /**
   * 策略诞生 — 在指定屏幕坐标播放星光涌现特效
   * @param x 屏幕坐标 X
   * @param y 屏幕坐标 Y
   * @param onComplete 特效播放完毕回调
   */
  playBirthEffect(x: number, y: number, onComplete?: () => void): void {
    // === 阶段 1: 汇聚星光 ===
    const stars: Phaser.GameObjects.Arc[] = [];
    const starCount = 16;

    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const startDist = 60 + Math.random() * 30;
      const startColor = Math.random() > 0.5 ? 0x60a5fa : 0xa78bfa;
      const star = this.scene.add.circle(
        x + Math.cos(angle) * startDist,
        y + Math.sin(angle) * startDist,
        2 + Math.random() * 3,
        startColor,
        0.8,
      );
      star.setDepth(9998);
      star.setScrollFactor(0);
      stars.push(star);

      // 星星向中心汇聚
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 3,
        y: y + Math.sin(angle) * 3,
        duration: 600 + Math.random() * 200,
        ease: 'Power2',
      });
    }

    // === 阶段 2: 中心爆发 ===
    this.scene.time.delayedCall(700, () => {
      // 星星向外扩散
      for (const star of stars) {
        const angle = Math.atan2(star.y - y, star.x - x);
        this.scene.tweens.add({
          targets: star,
          x: x + Math.cos(angle) * 80,
          y: y + Math.sin(angle) * 80,
          alpha: 0,
          duration: 400,
          onComplete: () => star.destroy(),
        });
      }

      // 中心光圈
      const ring = this.scene.add.graphics();
      ring.setDepth(9999);
      ring.setScrollFactor(0);
      ring.lineStyle(3, 0x60a5fa, 0.8);
      ring.strokeCircle(x, y, 5);

      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onUpdate: (_tween: Phaser.Tweens.Tween, target: any, key: string, current: number) => {
          const progress = 1 - (target.alpha ?? 0);
          ring.clear();
          ring.lineStyle(3, 0x60a5fa, target.alpha ?? 0);
          ring.strokeCircle(x, y, 5 + progress * 40);
        },
        onComplete: () => ring.destroy(),
      });

      // 中心闪光
      const centerGlow = this.scene.add.graphics();
      centerGlow.setDepth(9997);
      centerGlow.setScrollFactor(0);
      centerGlow.fillStyle(0x60a5fa, 0.3);
      centerGlow.fillCircle(x, y, 20);

      this.scene.tweens.add({
        targets: centerGlow,
        alpha: 0,
        duration: 500,
        onComplete: () => centerGlow.destroy(),
      });
    });

    // === 阶段 3: 完成回调 ===
    this.scene.time.delayedCall(1200, () => {
      onComplete?.();
    });
  }

  /** 画锯齿闪电线 */
  private drawLightning(
    g: Phaser.GameObjects.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    segments: number,
    color: number,
    width: number,
  ): void {
    g.lineStyle(width, color, 0.95);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const perpX = -dy;
    const perpY = dx;
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

    g.beginPath();
    g.moveTo(x1, y1);

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = x1 + dx * t;
      const baseY = y1 + dy * t;
      const jitter = (Math.random() - 0.5) * 40;
      const px = baseX + (perpX / perpLen) * jitter;
      const py = baseY + (perpY / perpLen) * jitter;
      g.lineTo(px, py);
    }

    g.lineTo(x2, y2);
    g.strokePath();
  }
}
