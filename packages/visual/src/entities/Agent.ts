// ============================================================
// Agent.ts — 策略 Agent 实体
// ============================================================

import { Direction, AgentState, type Strategy, type MapData, type CharMeta } from '../types';
import { AGENT_SPEED, WANDER_RANGE, WANDER_INTERVAL_BASE, STATE_REGIONS } from '../config';
import { Entity } from './Entity';
import { randomInt, isFrameValid } from '../utils/MathUtils';

export class Agent extends Entity {
  readonly strategy: Strategy;
  private targetX: number;
  private targetY: number;
  private phase: number;
  private wanderTime = 0;
  private charKey: string;
  private charMeta: CharMeta;

  constructor(
    scene: Phaser.Scene,
    mapData: MapData,
    charMeta: CharMeta,
    strategy: Strategy,
    index: number,
  ) {
    const region = STATE_REGIONS[strategy.state];
    const mx = region.x + (index % 4 - 1.5) * 5;
    const my = region.y + (Math.floor(index / 4) - 1) * 5;
    super(scene, mapData, strategy.id, mx, my);

    this.strategy = strategy;
    this.targetX = mx;
    this.targetY = my;
    this.phase = index * 1.3;
    this.charKey = charMeta.mapping[strategy.id] || 'player';
    this.charMeta = charMeta;
    this.direction = [Direction.Up, Direction.Right, Direction.Left, Direction.Down][index % 4];

    this.createSprite();
  }

  private createSprite(): void {
    const frameKey = `${this.charKey}_d${this.direction}_f0`;
    const frame = this.scene.textures.getFrame('chars', frameKey);
    const meta = this.charMeta.chars[frameKey];

    if (meta && isFrameValid(frame)) {
      this.sprite = this.scene.add.image(5, 14, 'chars', frameKey)
        .setOrigin(0.5, 1.0)
        .setScale(0.6);
      this.container.add(this.sprite);

      // 名称标签
      const isHot = this.strategy.category === 'hot';
      const isEmerged = this.strategy.category === 'emerged';
      const nameColor = isHot ? '#fbbf24' : isEmerged ? '#60a5fa' : '#9ca3af';
      this.label = this.scene.add.text(5, 20, this.strategy.name, {
        fontSize: '8px',
        color: nameColor,
        stroke: '#000',
        strokeThickness: 2,
        fontFamily: 'PingFang SC, monospace',
      }).setOrigin(0.5);
      this.container.add(this.label);

      // 收益率标签
      const retColor = this.strategy.returnPct >= 0 ? '#34d399' : '#f87171';
      const retText = `${this.strategy.returnPct >= 0 ? '+' : ''}${this.strategy.returnPct.toFixed(1)}%`;
      const retLabel = this.scene.add.text(5, 30, retText, {
        fontSize: '8px',
        color: retColor,
        stroke: '#000',
        strokeThickness: 2,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.container.add(retLabel);
    } else {
      // Fallback：几何图形
      const body = this.scene.add.graphics();
      const isHot = this.strategy.category === 'hot';
      const isEmerged = this.strategy.category === 'emerged';
      const col = isHot ? 0xfbbf24 : isEmerged ? 0x60a5fa : 0x6b7280;
      body.fillStyle(col);
      body.fillRoundedRect(-5, -1, 10, 11, 2);
      body.fillCircle(0, -6, 6);
      this.container.add(body);

      const nameColor = isHot ? '#fbbf24' : isEmerged ? '#60a5fa' : '#9ca3af';
      this.label = this.scene.add.text(0, 17, this.strategy.name, {
        fontSize: '8px',
        color: nameColor,
        stroke: '#000',
        strokeThickness: 2,
        fontFamily: 'PingFang SC, monospace',
      }).setOrigin(0.5);
      this.container.add(this.label);
    }
  }

  update(time: number, delta: number, playerX: number, playerY: number): void {
    const adx = this.targetX - this.mapX;
    const ady = this.targetY - this.mapY;
    const dist = Math.sqrt(adx * adx + ady * ady);
    this.moving = dist > 0.3;

    if (this.moving) {
      const speed = AGENT_SPEED * (delta / 16);
      this.mapX += (adx / dist) * speed;
      this.mapY += (ady / dist) * speed;
      this.direction = this.getDirection(adx, ady);
    } else if (!this.wanderTime || time - this.wanderTime > WANDER_INTERVAL_BASE + this.phase * 1000) {
      this.targetX = this.mapX + randomInt(-WANDER_RANGE, WANDER_RANGE);
      this.targetY = this.mapY + randomInt(-WANDER_RANGE, WANDER_RANGE);
      this.wanderTime = time;
    }

    this.updateScreenPosition(playerX, playerY);
    // Agent 行走动画统一使用 player 帧（player 有完整 4 方向×7 帧）
    this.updateWalkAnimation(time, this.moving, this.phase, 'player');
  }

  /** 设置新状态对应的漫步目标 */
  moveToStateRegion(state: AgentState): void {
    const region = STATE_REGIONS[state];
    this.targetX = region.x + randomInt(-region.radius, region.radius);
    this.targetY = region.y + randomInt(-region.radius, region.radius);
  }

  getCharKey(): string {
    return this.charKey;
  }
}
