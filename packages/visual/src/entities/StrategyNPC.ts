// ============================================================
// StrategyNPC.ts — 门派室内策略 NPC
// ============================================================

import { type MapData, type Strategy } from '../types';
import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W, INDOOR_SCALE, INDOOR_ACTOR_DEPTH_BASE } from '../config';
import { Entity } from './Entity';
import type { IndoorActorDef, IndoorActorVisualDef } from '../content/IndoorActorTypes';
import type { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { isFrameValid } from '../utils/MathUtils';

function visualScaleX(visual: IndoorActorVisualDef): number {
  return visual.flipX ? -visual.scale : visual.scale;
}

export class StrategyNPC extends Entity {
  readonly strategy: Strategy;
  actor: IndoorActorDef;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;
  private visual: IndoorActorVisualDef;
  private spine: SpineGameObject | null = null;

  constructor(scene: Phaser.Scene, mapData: MapData, strategy: Strategy, actor: IndoorActorDef) {
    super(scene, mapData, actor.id, actor.position.x, actor.position.y);
    this.strategy = strategy;
    this.actor = actor;
    this.visual = actor.visual;
    this.direction = actor.position.direction;
    this.createSprite();
  }

  private createSprite(): void {
    const visual = this.visual;
    if (visual.kind === 'spine') {
      this.createSpineSprite(visual);
    } else if (visual.kind === 'static_texture') {
      this.sprite = this.scene.add.image(0, visual.offsetY, visual.textureKey)
        .setOrigin(0.5, 1.0)
        .setScale(visualScaleX(visual), visual.scale);
      this.container.add(this.sprite);
    } else {
      const charKey = visual.charKey;
      const frameKey = `${charKey}_d${this.direction}_f0`;
      const frame = this.scene.textures.getFrame('chars', frameKey);

      if (isFrameValid(frame)) {
        this.sprite = this.scene.add.image(0, this.visual.offsetY, 'chars', frameKey)
          .setOrigin(0.5, 1.0)
          .setScale(visualScaleX(this.visual), this.visual.scale);
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

  private createSpineSprite(visual: Extract<IndoorActorVisualDef, { kind: 'spine' }>): void {
    if (this.scene.add.spine) {
      try {
        this.spine = this.scene.add.spine(0, visual.offsetY, visual.dataKey, visual.atlasKey);
        this.spine.setScale(visualScaleX(visual), visual.scale);
        const animations = this.spine.skeleton.data.animations.map(animation => animation.name);
        if (animations.includes(visual.defaultAnimation)) {
          this.spine.animationState.setAnimation(0, visual.defaultAnimation, true);
        }
        this.container.add(this.spine);
        return;
      } catch (error) {
        console.warn(`[StrategyNPC] Spine 角色 ${this.strategy.id} 创建失败，使用静态贴图兜底。`, error);
      }
    }

    if (visual.fallbackTextureKey) {
      this.sprite = this.scene.add.image(0, visual.offsetY, visual.fallbackTextureKey)
        .setOrigin(0.5, 1.0)
        .setScale(visualScaleX(visual), visual.scale);
      this.container.add(this.sprite);
    }
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
    const visual = this.visual;
    if (visual.kind === 'chars_atlas') {
      this.updateWalkAnimation(time, false, 0, visual.charKey);
    }
  }

  setIndoorMode(indoor: boolean, cx: number, cy: number): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
  }

  getCharKey(): string {
    return this.visual.kind === 'chars_atlas' ? this.visual.charKey : 'player';
  }

  applyActorRuntimeEdit(actor: IndoorActorDef): void {
    this.actor = actor;
    this.visual = actor.visual;
    this.mapX = actor.position.x;
    this.mapY = actor.position.y;
    this.direction = actor.position.direction;
    this.applyActorVisualRuntimeEdit(actor.visual);
    this.update(0, 0, this.mapX, this.mapY);
  }

  private applyActorVisualRuntimeEdit(visual: IndoorActorVisualDef): void {
    if (visual.kind === 'spine') {
      this.spine?.setPosition(0, visual.offsetY);
      this.spine?.setScale(visualScaleX(visual), visual.scale);
      if (this.spine) {
        const animations = this.spine.skeleton.data.animations.map(animation => animation.name);
        if (animations.includes(visual.defaultAnimation)) {
          this.spine.animationState.setAnimation(0, visual.defaultAnimation, true);
        }
      }
      if (this.sprite && visual.fallbackTextureKey) {
        this.sprite.setTexture(visual.fallbackTextureKey);
        this.sprite.setPosition(0, visual.offsetY);
        this.sprite.setScale(visualScaleX(visual), visual.scale);
      }
      return;
    }

    if (this.sprite) {
      if (visual.kind === 'static_texture') {
        this.sprite.setTexture(visual.textureKey);
        this.sprite.setPosition(0, visual.offsetY);
        this.sprite.setScale(visualScaleX(visual), visual.scale);
      } else {
        const frameKey = `${visual.charKey}_d${this.direction}_f0`;
        if (isFrameValid(this.scene.textures.getFrame('chars', frameKey))) {
          this.sprite.setTexture('chars', frameKey);
        }
        this.sprite.setPosition(0, visual.offsetY);
        this.sprite.setScale(visualScaleX(visual), visual.scale);
      }
    }
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
