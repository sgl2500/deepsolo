// ============================================================
// StrategyNPC.ts — 门派室内策略 NPC
// ============================================================

import { type MapData, type Strategy } from '../types';
import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W, INDOOR_SCALE, INDOOR_ACTOR_DEPTH_BASE } from '../config';
import { Entity } from './Entity';
import type { StrategyNpcSlot } from '../content/StrategyNpcPlacement';
import { getStrategyNpcVisual, type StrategyNpcVisualDef } from '../content/StrategyNpcVisuals';
import { isFrameValid } from '../utils/MathUtils';

export class StrategyNPC extends Entity {
  readonly strategy: Strategy;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;
  private readonly visual: StrategyNpcVisualDef;

  constructor(scene: Phaser.Scene, mapData: MapData, strategy: Strategy, slot: StrategyNpcSlot) {
    super(scene, mapData, `strategy_${strategy.id}`, slot.mapX, slot.mapY);
    this.strategy = strategy;
    this.visual = getStrategyNpcVisual(strategy);
    this.direction = slot.direction;
    this.createSprite();
  }

  private createSprite(): void {
    if (this.visual.kind === 'static_texture' && this.visual.textureKey) {
      this.sprite = this.scene.add.image(0, this.visual.offsetY, this.visual.textureKey)
        .setOrigin(0.5, 1.0)
        .setScale(this.visual.scale);
      this.container.add(this.sprite);
    } else {
      const charKey = this.visual.charKey ?? 'player';
      const frameKey = `${charKey}_d${this.direction}_f0`;
      const frame = this.scene.textures.getFrame('chars', frameKey);

      if (isFrameValid(frame)) {
        this.sprite = this.scene.add.image(0, this.visual.offsetY, 'chars', frameKey)
          .setOrigin(0.5, 1.0)
          .setScale(this.visual.scale);
        this.container.add(this.sprite);
      } else {
        const body = this.scene.add.graphics();
        body.fillStyle(0xfbbf24);
        body.fillRoundedRect(-5, -1, 10, 11, 2);
        body.fillCircle(0, -6, 6);
        this.container.add(body);
      }
    }

    const nameColor = this.strategy.category === 'hot'
      ? '#fbbf24'
      : this.strategy.category === 'emerged'
        ? '#60a5fa'
        : '#e5e7eb';
    this.label = this.scene.add.text(0, 24, this.strategy.name, {
      fontSize: '9px',
      color: nameColor,
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);
    this.container.add(this.label);

    const retColor = this.strategy.returnPct >= 0 ? '#34d399' : '#f87171';
    const retText = `${this.strategy.returnPct >= 0 ? '+' : ''}${this.strategy.returnPct.toFixed(1)}%`;
    const retLabel = this.scene.add.text(0, 35, retText, {
      fontSize: '8px',
      color: retColor,
      stroke: '#000',
      strokeThickness: 2,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(retLabel);
  }

  update(time: number, _delta: number, playerX: number, playerY: number): void {
    if (this.indoorMode) {
      const s = INDOOR_SCALE;
      this.container.x = TILE_HALF_W * s * ((this.mapX - this.indoorCx) - (this.mapY - this.indoorCy)) + SCREEN_WIDTH / 2;
      this.container.y = TILE_HALF_H * s * ((this.mapX - this.indoorCx) + (this.mapY - this.indoorCy)) + SCREEN_HEIGHT / 2;
      this.container.setDepth(INDOOR_ACTOR_DEPTH_BASE + this.mapX + this.mapY);
    } else {
      this.updateScreenPosition(playerX, playerY);
    }
    if (this.visual.kind === 'chars_atlas') {
      this.updateWalkAnimation(time, false, 0, this.visual.charKey ?? 'player');
    }
  }

  setIndoorMode(indoor: boolean, cx: number, cy: number): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
  }

  getCharKey(): string {
    return this.visual.charKey ?? 'player';
  }

  containsScreenPoint(screenX: number, screenY: number): boolean {
    if (this.sprite) {
      const bounds = this.sprite.getBounds();
      const padded = new Phaser.Geom.Rectangle(
        bounds.x - 8,
        bounds.y - 8,
        bounds.width + 16,
        bounds.height + 16,
      );
      if (Phaser.Geom.Rectangle.Contains(padded, screenX, screenY)) {
        return true;
      }
    }

    if (this.label) {
      const labelBounds = this.label.getBounds();
      if (Phaser.Geom.Rectangle.Contains(labelBounds, screenX, screenY)) {
        return true;
      }
    }

    return false;
  }
}
