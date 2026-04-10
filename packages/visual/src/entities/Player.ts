// ============================================================
// Player.ts — 玩家实体
// ============================================================

import { Direction, type MapData } from '../types';
import { MOVE_SPEED, MAP_BORDER, SCREEN_WIDTH, SCREEN_HEIGHT } from '../config';
import { Entity } from './Entity';
import { clamp, isFrameValid } from '../utils/MathUtils';
import type { InputController } from '../systems/InputController';

export class Player extends Entity {
  private inputController: InputController;
  private mapWidth: number;
  private mapHeight: number;

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
    // 自身就是玩家，playerX/playerY 就是自己
    const input = this.inputController.getMovement();
    this.moving = input.dx !== 0 || input.dy !== 0;

    if (this.moving) {
      const speed = MOVE_SPEED * (delta / 16);
      this.mapX = clamp(this.mapX + input.dx * speed, MAP_BORDER, this.mapWidth - MAP_BORDER - 1);
      this.mapY = clamp(this.mapY + input.dy * speed, MAP_BORDER, this.mapHeight - MAP_BORDER - 1);

      // 更新方向
      this.direction = this.getDirection(input.dx, input.dy);
    }

    // 玩家固定在屏幕中心
    this.container.x = SCREEN_WIDTH / 2;
    this.container.y = SCREEN_HEIGHT / 2;
    // 深度按 mapY 排序，确保和其他实体遮挡正确
    this.container.setDepth(this.mapY);

    this.updateWalkAnimation(time, this.moving);
  }

  getCharKey(): string {
    return 'player';
  }

  getDirection2(dx: number, dy: number): Direction {
    return this.getDirection(dx, dy);
  }
}
