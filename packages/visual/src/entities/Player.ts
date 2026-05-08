// ============================================================
// Player.ts — 玩家实体
// ============================================================

import { Direction, type MapData } from '../types';
import { MOVE_SPEED, MAP_BORDER, SCREEN_WIDTH, SCREEN_HEIGHT, TILE_HALF_W, TILE_HALF_H, INDOOR_SCALE, INDOOR_ACTOR_DEPTH_BASE } from '../config';
import { Entity } from './Entity';
import { clamp } from '../utils/MathUtils';
import { getTile } from '../utils/IsoProjection';
import { isBlockedByIndoorCharacter } from '../content/IndoorCharacterCollision';
import { isBlockedByLockedIndoorExit } from '../content/IndoorExitLocks';
import { isBlockedByIndoorFurniture } from '../content/IndoorFurnitureCollision';
import { isBlockedByWorldBuildingCollision } from '../content/WorldBuildingCollision';
import type { InputController } from '../systems/InputController';
import type { PlayerAppearanceDef } from '../content/PlayerAppearanceCatalog';
import { getSelectedPlayerAppearance, subscribePlayerAppearance } from '../systems/player/PlayerAppearanceStore';
import {
  applyPlayerAppearanceSprite,
  getPlayerAppearanceFrame,
  getPlayerAppearanceScale,
  updatePlayerAppearanceWalkFrame,
} from '../systems/player/PlayerSpriteAnimator';

export class Player extends Entity {
  private inputController: InputController;
  private mapWidth: number;
  private mapHeight: number;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;
  private indoorBuildingId: string | null = null;
  private indoorExitBlocked = false;
  private appearance: PlayerAppearanceDef = getSelectedPlayerAppearance();
  private unsubscribeAppearance: (() => void) | null = null;
  private visualMove = { dx: 0, dy: 1 };
  private shadow: Phaser.GameObjects.Ellipse | null = null;

  constructor(scene: Phaser.Scene, mapData: MapData, inputController: InputController) {
    super(scene, mapData, 'player', mapData.width / 2, mapData.height / 2);
    this.inputController = inputController;
    this.mapWidth = mapData.width;
    this.mapHeight = mapData.height;
    this.direction = Direction.Down;
    this.createSprite();
    this.unsubscribeAppearance = subscribePlayerAppearance((appearance) => {
      this.appearance = appearance;
      if (this.sprite) {
        applyPlayerAppearanceSprite(this.sprite, appearance, this.direction, this.indoorMode, this.visualMove);
        this.updatePseudoWalkVisual(0, false);
      }
    });
  }

  private createSprite(): void {
    const frameIdx = getPlayerAppearanceFrame(this.appearance, this.direction, 0);

    this.shadow = this.scene.add.ellipse(0, this.appearance.worldOffsetY + 1, 48, 13, 0x000000, 0.28);
    this.shadow.setVisible(false);
    this.container.add(this.shadow);

    this.sprite = this.scene.add.image(0, this.appearance.worldOffsetY, this.appearance.textureKey, frameIdx);
    applyPlayerAppearanceSprite(this.sprite, this.appearance, this.direction, this.indoorMode, this.visualMove);
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

  /** 覆写：使用当前选择的人物外观配置驱动行走帧 */
  protected updateWalkAnimation(time: number, moving: boolean, _phaseOffset = 0, _overrideCharKey?: string): void {
    if (!this.sprite) return;
    this.frameIndex = updatePlayerAppearanceWalkFrame(
      this.sprite,
      this.appearance,
      this.direction,
      moving,
      time,
      this.visualMove,
    );
    this.updatePseudoWalkVisual(time, moving);
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
      this.visualMove = { dx: input.dx, dy: input.dy };
    }

    // 位置：室内模式用容器本地坐标（玩家在 indoorContainer 内）
    if (this.indoorMode) {
      const s = INDOOR_SCALE;
      this.container.x = TILE_HALF_W * s * ((this.mapX - this.indoorCx) - (this.mapY - this.indoorCy)) + SCREEN_WIDTH / 2;
      this.container.y = TILE_HALF_H * s * ((this.mapX - this.indoorCx) + (this.mapY - this.indoorCy)) + SCREEN_HEIGHT / 2;
      this.container.setDepth(INDOOR_ACTOR_DEPTH_BASE + this.mapX + this.mapY);
      if (this.sprite) this.sprite.y = this.appearance.indoorOffsetY;
    } else {
      this.container.x = SCREEN_WIDTH / 2;
      this.container.y = SCREEN_HEIGHT / 2;
      this.container.setDepth(this.mapX + this.mapY);
      if (this.sprite) this.sprite.y = this.appearance.worldOffsetY;
    }

    this.updateWalkAnimation(time, this.moving);
  }

  getCharKey(): string {
    return 'player';
  }

  /** 检查指定位置是否被墙壁阻挡（仅室内生效） */
  private isBlocked(x: number, y: number): boolean {
    if (!this.indoorMode) return isBlockedByWorldBuildingCollision(x, y);
    if (isBlockedByLockedIndoorExit(this.indoorBuildingId, this.indoorExitBlocked, x, y)) return true;
    if (isBlockedByIndoorFurniture(this.indoorBuildingId, x, y)) return true;
    if (isBlockedByIndoorCharacter(this.indoorBuildingId, x, y)) return true;
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
    if (!indoor) this.indoorExitBlocked = false;
  }

  /** 设置当前室内出口是否被剧情临时阻挡 */
  setIndoorExitBlocked(blocked: boolean): void {
    this.indoorExitBlocked = blocked;
  }

  get isIndoor(): boolean { return this.indoorMode; }
  get indoorCenterX(): number { return this.indoorCx; }
  get indoorCenterY(): number { return this.indoorCy; }

  /** 立即应用室内模式的视觉状态（淡入前调用，避免过渡期间显示世界模式外观） */
  applyIndoorVisual(time: number): void {
    this.container.setDepth(INDOOR_ACTOR_DEPTH_BASE + this.mapX + this.mapY);
    if (this.sprite) this.sprite.y = this.appearance.indoorOffsetY;
    this.updateWalkAnimation(time, false);
  }

  private updatePseudoWalkVisual(time: number, moving: boolean): void {
    if (!this.sprite) return;

    const baseY = this.indoorMode ? this.appearance.indoorOffsetY : this.appearance.worldOffsetY;
    const renderScale = getPlayerAppearanceScale(this.appearance, this.indoorMode);
    const pseudoWalk = this.appearance.pseudoWalk;
    if (!pseudoWalk) {
      this.sprite.setPosition(0, baseY).setScale(renderScale);
      this.shadow?.setVisible(false);
      return;
    }

    const phase = moving ? (time / pseudoWalk.stepIntervalMs) * Math.PI : 0;
    const step = moving ? Math.abs(Math.sin(phase)) : 0;
    const sway = moving ? Math.sin(phase * 0.5) * pseudoWalk.swayX : 0;
    const squash = moving ? 1 - step * pseudoWalk.squashY : 1;

    this.sprite
      .setPosition(sway, baseY - step * pseudoWalk.bobHeight)
      .setScale(renderScale, renderScale * squash);

    if (this.shadow) {
      const shadowScale = 1 - step * pseudoWalk.shadowScale;
      this.shadow
        .setVisible(true)
        .setPosition(0, baseY + 1)
        .setSize(pseudoWalk.shadowWidth, pseudoWalk.shadowHeight)
        .setScale(shadowScale, shadowScale)
        .setAlpha(pseudoWalk.shadowAlpha * (1 - step * 0.25));
    }
  }

  override destroy(): void {
    this.unsubscribeAppearance?.();
    super.destroy();
  }
}
