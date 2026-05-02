// ============================================================
// NPC.ts — NPC 实体（继承 Entity）
// ============================================================

import { Direction, type MapData, type NPCDef } from '../types';
import { WALK_FRAME_INTERVAL, TILE_HALF_W, TILE_HALF_H, SCREEN_WIDTH, SCREEN_HEIGHT, INDOOR_SCALE, INDOOR_ACTOR_DEPTH_BASE } from '../config';
import { Entity } from './Entity';
import { isFrameValid } from '../utils/MathUtils';

export class NPC extends Entity {
  readonly npcDef: NPCDef;
  private indoorMode = false;
  private indoorCx = 0;
  private indoorCy = 0;

  constructor(scene: Phaser.Scene, mapData: MapData, npcDef: NPCDef) {
    super(scene, mapData, npcDef.id, npcDef.mapX, npcDef.mapY);
    this.npcDef = npcDef;
    this.direction = npcDef.defaultDir;
    this.createSprite();
  }

  private createSprite(): void {
    // NPC 使用 JYQXZ npc_map 精灵图
    const texKey = this.npcDef.charKey;
    const texture = this.scene.textures.get(texKey);
    if (texture && texture.key !== '__MISSING') {
      const isSmap = texKey.startsWith('smap_');
      this.sprite = this.scene.add.image(0, 0, texKey)
        .setOrigin(0.5, 1.0)
        .setScale(isSmap ? 2.2 : 2.5);
      this.container.add(this.sprite);
    } else {
      // 备用：用彩色图形代替
      const body = this.scene.add.graphics();
      body.fillStyle(0x60a5fa);
      body.fillRoundedRect(-5, -1, 10, 11, 2);
      body.fillCircle(0, -6, 6);
      this.container.add(body);
    }

    // 名字标签
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
      this.container.setDepth(INDOOR_ACTOR_DEPTH_BASE + this.mapX + this.mapY);
    } else {
      this.updateScreenPosition(playerX, playerY);
    }
  }

  /** 设置室内模式 */
  setIndoorMode(indoor: boolean, cx: number, cy: number): void {
    this.indoorMode = indoor;
    this.indoorCx = cx;
    this.indoorCy = cy;
  }

  get dialogueId(): string {
    return this.npcDef.dialogueId;
  }

  getCharKey(): string {
    return this.npcDef.charKey;
  }
}
