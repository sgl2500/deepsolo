// ============================================================
// Entity.ts — 实体基类
// ============================================================

import { Direction, type MapData } from '../types';
import { WALK_FRAME_COUNT, WALK_FRAME_INTERVAL } from '../config';
import { toScreen } from '../utils/IsoProjection';
import { isFrameValid } from '../utils/MathUtils';

export abstract class Entity {
  id: string;
  mapX: number;
  mapY: number;
  direction: Direction = Direction.Down;
  protected frameIndex = 0;
  protected moving = false;
  protected sprite: Phaser.GameObjects.Image | null = null;
  protected label: Phaser.GameObjects.Text | null = null;

  readonly container: Phaser.GameObjects.Container;

  protected readonly scene: Phaser.Scene;
  protected mapData: MapData;

  constructor(scene: Phaser.Scene, mapData: MapData, id: string, mapX: number, mapY: number) {
    this.scene = scene;
    this.mapData = mapData;
    this.id = id;
    this.mapX = mapX;
    this.mapY = mapY;

    const screen = toScreen(mapX, mapY, mapX, mapY); // 初始位置
    this.container = scene.add.container(screen.x, screen.y);
  }

  /** 每帧更新 */
  abstract update(time: number, delta: number, playerX: number, playerY: number): void;

  /** 更新屏幕位置 */
  updateScreenPosition(playerX: number, playerY: number): void {
    const screen = toScreen(this.mapX, this.mapY, playerX, playerY);
    this.container.x = screen.x;
    this.container.y = screen.y;
    this.container.setDepth(this.mapX + this.mapY);
  }

  /** 更新行走动画 */
  protected updateWalkAnimation(time: number, moving: boolean, phaseOffset = 0, overrideCharKey?: string): void {
    if (!this.sprite) return;
    if (moving) {
      this.frameIndex = Math.floor(time / WALK_FRAME_INTERVAL + phaseOffset) % WALK_FRAME_COUNT;
    } else {
      this.frameIndex = 0;
    }
    const charKey = overrideCharKey ?? this.getCharKey();
    const frameKey = `${charKey}_d${this.direction}_f${this.frameIndex}`;
    const frame = this.scene.textures.getFrame('chars', frameKey);
    if (isFrameValid(frame) && this.sprite.frame.name !== frameKey) {
      this.sprite.setTexture('chars', frameKey);
    }
  }

  /** 获取角色 key（子类覆盖） */
  protected getCharKey(): string {
    return 'player';
  }

  /** 获取移动方向 */
  protected getDirection(dx: number, dy: number): Direction {
    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy < 0 ? Direction.Up : Direction.Down;
    }
    return dx > 0 ? Direction.Right : Direction.Left;
  }

  destroy(): void {
    this.container.destroy();
  }
}
