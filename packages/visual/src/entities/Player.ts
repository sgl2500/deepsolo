// ============================================================
// Player.ts — 玩家实体
// ============================================================

import { Direction, type MapData } from '../types';
import { MOVE_SPEED, MAP_BORDER, SCREEN_WIDTH, SCREEN_HEIGHT, TILE_HALF_W, TILE_HALF_H } from '../config';
import { Entity } from './Entity';
import { clamp, isFrameValid } from '../utils/MathUtils';
import { getTile } from '../utils/IsoProjection';
import type { InputController } from '../systems/InputController';

export class Player extends Entity {
  private inputController: InputController;
  private mapWidth: number;
  private mapHeight: number;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;

  constructor(scene: Phaser.Scene, mapData: MapData, inputController: InputController) {
    super(scene, mapData, 'player', mapData.width / 2, mapData.height / 2);
    this.inputController = inputController;
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
    this.direction = Direction.Down;
    this.createSprite();
  }

  private createSprite(): void {
    const frameKey = 'player_d0_f0';
    const frame = this.scene.textures.getFrame('chars', frameKey);

    if (isFrameValid(frame)) {
      this.sprite = this.scene.add.image(0, 14, 'chars', frameKey)
        .setOrigin(0.5, 1.0)
        .setScale(0.6);
      this.container.add(this.sprite);
    }

    this.label = this.scene.add.text(5, 20, '观察者', {
      fontSize: '9px',
      color: '#60a5fa',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);
    this.container.add(this.label);
  }

  update(time: number, delta: number, playerX: number, playerY: number): void {
    const input = this.inputController.getMovement();
    this.moving = input.dx !== 0 || input.dy !== 0;

    if (this.moving) {
      const speed = MOVE_SPEED * (delta / 16);
      let newX = this.mapX + input.dx * speed;
      let newY = this.mapY + input.dy * speed;

      newX = clamp(newX, MAP_BORDER, this.mapWidth - MAP_BORDER - 1);
      newY = clamp(newY, MAP_BORDER, this.mapHeight - MAP_BORDER - 1);

      if (this.isBlocked(newX, newY)) {
        if (input.dx !== 0 && !this.isBlocked(this.mapX + input.dx * speed, this.mapY)) {
          newX = this.mapX + input.dx * speed;
          newY = this.mapY;
        } else if (input.dy !== 0 && !this.isBlocked(this.mapX, this.mapY + input.dy * speed)) {
          newX = this.mapX;
          newY = this.mapY + input.dy * speed;
        } else {
          newX = this.mapX;
          newY = this.mapY;
        }
      }

      this.mapX = newX;
      this.mapY = newY;
      this.direction = this.getDirection(input.dx, input.dy);
    }

    // 位置：室内模式相对房间中心，世界模式固定屏幕中心
    if (this.indoorMode) {
      this.container.x = TILE_HALF_W * ((this.mapX - this.indoorCx) - (this.mapY - this.indoorCy)) + SCREEN_WIDTH / 2;
      this.container.y = TILE_HALF_H * ((this.mapX - this.indoorCx) + (this.mapY - this.indoorCy)) + SCREEN_HEIGHT / 2;
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

  /** 检查指定位置是否被墙壁阻挡 */
  private isBlocked(x: number, y: number): boolean {
    const sv = getTile(this.mapData, 1, x, y);
    if (sv === 0) return false;       // 空地
    if (sv === 307) return false;     // 门口可通过
    return true;                       // 其他 surface 瓦片都是墙
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
  setIndoorMode(indoor: boolean, cx: number, cy: number): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
  }
}
