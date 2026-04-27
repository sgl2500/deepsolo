// ============================================================
// Player.ts — 玩家实体
// ============================================================

import { Direction, type MapData } from '../types';
import { MOVE_SPEED, MAP_BORDER, SCREEN_WIDTH, SCREEN_HEIGHT, TILE_HALF_W, TILE_HALF_H, INDOOR_SCALE, WALK_FRAME_INTERVAL, WALK_FRAME_COUNT } from '../config';
import { Entity } from './Entity';
import { clamp } from '../utils/MathUtils';
import { getTile } from '../utils/IsoProjection';
import { isBlockedByIndoorFurniture } from '../content/IndoorFurnitureCollision';
import type { InputController } from '../systems/InputController';

/** 方向 → player_walk 精灵图行号 (Row0=右上, Row1=右下, Row2=左上, Row3=左下) */
const DIR_ROW: Record<number, number> = {
  [Direction.Up]: 0,
  [Direction.Right]: 1,
  [Direction.Left]: 2,
  [Direction.Down]: 3,
};
const WALK_COLS = 7;

export class Player extends Entity {
  private inputController: InputController;
  private mapWidth: number;
  private mapHeight: number;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;
  private indoorBuildingId: string | null = null;

  constructor(scene: Phaser.Scene, mapData: MapData, inputController: InputController) {
    super(scene, mapData, 'player', mapData.width / 2, mapData.height / 2);
    this.inputController = inputController;
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
    this.direction = Direction.Down;
    this.createSprite();
  }

  private createSprite(): void {
    const row = DIR_ROW[this.direction] ?? 0;
    const frameIdx = row * WALK_COLS + 0;

    this.sprite = this.scene.add.image(0, 14, 'player_walk', frameIdx)
      .setOrigin(0.5, 1.0)
      .setScale(3.0);
    this.container.add(this.sprite);

    this.label = this.scene.add.text(5, 20, '观察者', {
      fontSize: '9px',
      color: '#60a5fa',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);
    this.container.add(this.label);
  }

  /** 覆写：使用 player_walk 精灵图编号帧 */
  protected updateWalkAnimation(time: number, moving: boolean, _phaseOffset = 0, _overrideCharKey?: string): void {
    if (!this.sprite) return;
    if (moving) {
      this.frameIndex = Math.floor(time / WALK_FRAME_INTERVAL) % WALK_FRAME_COUNT;
    } else {
      this.frameIndex = 0;
    }
    const row = DIR_ROW[this.direction] ?? 0;
    const frameIdx = row * WALK_COLS + this.frameIndex;
    const name = String(frameIdx);
    if (this.sprite.frame.name !== name) {
      this.sprite.setTexture('player_walk', frameIdx);
    }
  }

  update(time: number, delta: number, playerX: number, playerY: number): void {
    const input = this.inputController.getMovement();
    this.moving = input.dx !== 0 || input.dy !== 0;

    if (this.moving) {
      const speed = MOVE_SPEED * (delta / 16);
      let newX = this.mapX + input.dx * speed;
      let newY = this.mapY + input.dy * speed;

      const border = this.indoorMode ? 0 : MAP_BORDER;
      newX = clamp(newX, border, this.mapWidth - border - 1);
      newY = clamp(newY, border, this.mapHeight - border - 1);

      if (this.isBlocked(newX, newY)) {
        if (input.dx !== 0 && !this.isBlocked(this.mapX + input.dx * speed, this.mapY)) {
          newX = this.mapX + input.dx * speed;
          newY = this.mapY;
        } else if (input.dy !== 0 && !this.isBlocked(this.mapX, this.mapY + input.dy * speed)) {
          newX = this.mapX;
          newY = this.mapY;
        } else {
          newX = this.mapX;
          newY = this.mapY;
        }
      }

      this.mapX = newX;
      this.mapY = newY;
      this.direction = this.getDirection(input.dx, input.dy);
    }

    // 位置：室内模式用容器本地坐标（玩家在 indoorContainer 内）
    if (this.indoorMode) {
      const s = INDOOR_SCALE;
      this.container.x = TILE_HALF_W * s * ((this.mapX - this.indoorCx) - (this.mapY - this.indoorCy)) + SCREEN_WIDTH / 2;
      this.container.y = TILE_HALF_H * s * ((this.mapX - this.indoorCx) + (this.mapY - this.indoorCy)) + SCREEN_HEIGHT / 2;
      this.container.setDepth(this.mapX + this.mapY);
      if (this.sprite) this.sprite.y = 0;
    } else {
      this.container.x = SCREEN_WIDTH / 2;
      this.container.y = SCREEN_HEIGHT / 2;
      this.container.setDepth(this.mapY);
      if (this.sprite) this.sprite.y = 14;
    }

    this.updateWalkAnimation(time, this.moving);
  }

  getCharKey(): string {
    return 'player';
  }

  /** 检查指定位置是否被墙壁阻挡（仅室内生效） */
  private isBlocked(x: number, y: number): boolean {
    if (!this.indoorMode) return false;  // 世界地图无碰撞
    if (isBlockedByIndoorFurniture(this.indoorBuildingId, x, y)) return true;
    // 检查 surface 层
    const sv = getTile(this.mapData, 1, x, y);
    if (sv !== 0 && sv !== 307) return true;  // surface 有墙（门口 307 除外）
    // 检查 building 层（前景墙，如底部墙角）
    const bv = getTile(this.mapData, 2, x, y);
    if (bv !== 0) {
      // 屋顶瓦片（yoff ≤ 30）不阻挡，前景墙阻挡
      // 简化判断：622 是屋顶，其他 building 瓦片是前景墙
      if (bv !== 622) return true;
    }
    return false;
  }

  getDirection2(dx: number, dy: number): Direction {
    return this.getDirection(dx, dy);
  }

  /** 直接设置地图位置（用于场景切换） */
  setMapPosition(x: number, y: number): void {
    this.mapX = x;
    this.mapY = y;
  }

  /** 切换地图数据（进入/退出室内时调用） */
  switchMapData(mapData: MapData): void {
    this.mapData = mapData;
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
  }

  /** 设置室内模式 */
  setIndoorMode(indoor: boolean, cx: number, cy: number, buildingId: string | null = null): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
    this.indoorBuildingId = indoor ? buildingId : null;
  }

  get isIndoor(): boolean { return this.indoorMode; }
  get indoorCenterX(): number { return this.indoorCx; }
  get indoorCenterY(): number { return this.indoorCy; }

  /** 立即应用室内模式的视觉状态（淡入前调用，避免过渡期间显示世界模式外观） */
  applyIndoorVisual(time: number): void {
    this.container.setDepth(this.mapX + this.mapY);
    if (this.sprite) this.sprite.y = 0;
    this.updateWalkAnimation(time, false);
  }
}
