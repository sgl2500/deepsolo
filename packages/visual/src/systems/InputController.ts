// ============================================================
// InputController.ts — 输入控制
// ============================================================

import type { Direction } from '../types';

export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey: Phaser.Input.Keyboard.Key;
  private inspectKey: Phaser.Input.Keyboard.Key;
  private cancelKey: Phaser.Input.Keyboard.Key;
  private battleKey: Phaser.Input.Keyboard.Key;
  private giftKey: Phaser.Input.Keyboard.Key;
  private skipStoryKey: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE) as Phaser.Input.Keyboard.Key;
    this.inspectKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T) as Phaser.Input.Keyboard.Key;
    this.cancelKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) as Phaser.Input.Keyboard.Key;
    this.battleKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B) as Phaser.Input.Keyboard.Key;
    this.giftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G) as Phaser.Input.Keyboard.Key;
    this.skipStoryKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K) as Phaser.Input.Keyboard.Key;
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

  /** 空格键是否刚按下（交互键） */
  isInteractPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.interactKey);
  }

  /** T 键是否刚按下（查看角色） */
  isInspectPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.inspectKey);
  }

  /** ESC 键是否刚按下（取消键） */
  isCancelPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.cancelKey);
  }

  /** B 键是否刚按下（战斗键） */
  isBattlePressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.battleKey);
  }

  /** G 键是否刚按下（赠送元宝） */
  isGiftPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.giftKey);
  }

  /** K 键是否刚按下（跳过当前剧情） */
  isSkipStoryPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.skipStoryKey);
  }
}
