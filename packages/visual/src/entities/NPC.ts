// ============================================================
// NPC.ts — NPC 实体（继承 Entity）
// ============================================================

import { Direction, type MapData, type NPCDef } from '../types';
import { WALK_FRAME_INTERVAL, TILE_HALF_W, TILE_HALF_H, SCREEN_WIDTH, SCREEN_HEIGHT, INDOOR_SCALE, INDOOR_ACTOR_DEPTH_BASE } from '../config';
import { Entity } from './Entity';
import { isFrameValid } from '../utils/MathUtils';
import type { IndoorActorDef, IndoorActorVisualDef } from '../content/IndoorActorTypes';

function visualScaleX(visual: IndoorActorVisualDef): number {
  return visual.flipX ? -visual.scale : visual.scale;
}

export class NPC extends Entity {
  readonly npcDef: NPCDef;
  actor: IndoorActorDef | null;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;

  constructor(scene: Phaser.Scene, mapData: MapData, npcDef: NPCDef, actor: IndoorActorDef | null = null) {
    super(scene, mapData, npcDef.id, npcDef.mapX, npcDef.mapY);
    this.npcDef = npcDef;
    this.actor = actor;
    this.direction = npcDef.defaultDir;
    this.createSprite();
  }

  private createSprite(): void {
    if (this.actor) {
      this.createActorSprite(this.actor);
      this.createNameLabel();
      return;
    }

    // NPC 使用 JYQXZ npc_map 精灵图
    const texKey = this.npcDef.charKey;
    const texture = this.scene.textures.get(texKey);
    if (texture && texture.key !== '__MISSING') {
      const isSmap = texKey.startsWith('smap_');
      const isIndoorCharacter = texKey.startsWith('token_center_') || texKey.startsWith('indoor_character_');
      this.sprite = this.scene.add.image(
        this.npcDef.pixelOffsetX ?? 0,
        this.npcDef.pixelOffsetY ?? 0,
        texKey,
      )
        .setOrigin(this.npcDef.originX ?? 0.5, this.npcDef.originY ?? 1.0)
        .setScale(this.npcDef.scale ?? (isIndoorCharacter ? 0.36 : isSmap ? 2.2 : 2.5))
        .setAlpha(this.npcDef.alpha ?? 1);
      this.container.add(this.sprite);
    } else {
      // 备用：用彩色图形代替
      const body = this.scene.add.graphics();
      body.fillStyle(0x60a5fa);
      body.fillRoundedRect(-5, -1, 10, 11, 2);
      body.fillCircle(0, -6, 6);
      this.container.add(body);
    }

    this.createNameLabel();
  }

  private createActorSprite(actor: IndoorActorDef): void {
    const visual = actor.visual;
    if (visual.kind === 'static_texture') {
      this.sprite = this.scene.add.image(
        this.npcDef.pixelOffsetX ?? 0,
        visual.offsetY,
        visual.textureKey,
      )
        .setOrigin(this.npcDef.originX ?? 0.5, this.npcDef.originY ?? 1.0)
        .setScale(visualScaleX(visual), visual.scale)
        .setAlpha(this.npcDef.alpha ?? 1);
      this.container.add(this.sprite);
      return;
    }

    if (visual.kind === 'chars_atlas') {
      const frameKey = `${visual.charKey}_d${this.direction}_f0`;
      const frame = this.scene.textures.getFrame('chars', frameKey);
      if (isFrameValid(frame)) {
        this.sprite = this.scene.add.image(0, visual.offsetY, 'chars', frameKey)
          .setOrigin(0.5, 1.0)
          .setScale(visualScaleX(visual), visual.scale);
        this.container.add(this.sprite);
        return;
      }
    }

    const body = this.scene.add.graphics();
    body.fillStyle(0x60a5fa);
    body.fillRoundedRect(-5, -1, 10, 11, 2);
    body.fillCircle(0, -6, 6);
    this.container.add(body);
  }

  applyActorRuntimeEdit(actor: IndoorActorDef): void {
    this.actor = actor;
    this.mapX = actor.position.x;
    this.mapY = actor.position.y;
    this.direction = actor.position.direction;
    this.applyActorVisualRuntimeEdit(actor.visual);
    this.update(0, 0, this.mapX, this.mapY);
  }

  private applyActorVisualRuntimeEdit(visual: IndoorActorVisualDef): void {
    if (this.sprite) {
      if (visual.kind === 'static_texture') {
        this.sprite.setTexture(visual.textureKey);
        this.sprite.setPosition(this.npcDef.pixelOffsetX ?? 0, visual.offsetY);
        this.sprite.setScale(visualScaleX(visual), visual.scale);
      } else if (visual.kind === 'chars_atlas') {
        const frameKey = `${visual.charKey}_d${this.direction}_f0`;
        if (isFrameValid(this.scene.textures.getFrame('chars', frameKey))) {
          this.sprite.setTexture('chars', frameKey);
        }
        this.sprite.setPosition(0, visual.offsetY);
        this.sprite.setScale(visualScaleX(visual), visual.scale);
      }
    }
  }

  private createNameLabel(): void {
    this.label = this.scene.add.text(0, 14, this.npcDef.name, {
      fontSize: '9px',
      color: '#fbbf24',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);
    this.container.add(this.label);
  }

  update(time: number, delta: number, playerX: number, playerY: number): void {
    if (this.indoorMode) {
      // 室内模式：用缩放后的容器本地坐标定位（NPC 已在 indoorContainer 内）
      const s = INDOOR_SCALE;
      this.container.x = TILE_HALF_W * s * ((this.mapX - this.indoorCx) - (this.mapY - this.indoorCy)) + SCREEN_WIDTH / 2;
      this.container.y = TILE_HALF_H * s * ((this.mapX - this.indoorCx) + (this.mapY - this.indoorCy)) + SCREEN_HEIGHT / 2;
      const depthX = this.npcDef.depthMapX ?? this.mapX;
      const depthY = this.npcDef.depthMapY ?? this.mapY;
      this.container.setDepth(INDOOR_ACTOR_DEPTH_BASE + depthX + depthY + (this.npcDef.depthBias ?? 0));
    } else {
      this.updateScreenPosition(playerX, playerY);
    }
  }

  /** 设置室内模式 */
  setIndoorMode(indoor: boolean, cx: number, cy: number): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
    if (indoor) {
      this.update(0, 0, this.mapX, this.mapY);
    }
  }

  get dialogueId(): string {
    return this.npcDef.dialogueId;
  }

  getCharKey(): string {
    return this.npcDef.charKey;
  }
}
