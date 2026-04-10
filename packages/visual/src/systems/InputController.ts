// ============================================================
// InputController.ts — 输入控制
// ============================================================

import type { Direction } from '../types';

export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  /** 获取移动方向 (-1, 0, 1) */
  getMovement(): { dx: number; dy: number } {
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;
    return { dx, dy };
  }

  /** 获取当前方向 */
  getDirection(): Direction | null {
    const { dx, dy } = this.getMovement();
    if (dx === 0 && dy === 0) return null;
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 0 : 3;
    return dx > 0 ? 1 : 2;
  }
}
