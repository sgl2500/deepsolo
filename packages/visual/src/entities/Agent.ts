// ============================================================
// Agent.ts — 策略 Agent 实体
// ============================================================

import { Direction, AgentState, type Strategy, type MapData, type CharMeta } from '../types';
import { AGENT_SPEED, WANDER_RANGE, WANDER_INTERVAL_BASE, STATE_REGIONS, DISCUSSION_RING_RADIUS, WALK_FRAME_INTERVAL } from '../config';
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

  // 讨论模式
  private _inDiscussion = false;
  private _faceTargetX = 0;
  private _faceTargetY = 0;

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
    this.charKey = 'player';
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
    // 讨论模式：不漫游，面向讨论中心
    if (this._inDiscussion) {
      this.moving = false;
      this.direction = this.getDirection(
        this._faceTargetX - this.mapX,
        this._faceTargetY - this.mapY,
      );
      this.updateScreenPosition(playerX, playerY);
      this.updateWalkAnimation(time, false, this.phase, this.charKey);
      return;
    }

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
    this.updateWalkAnimation(time, this.moving, this.phase, this.charKey);
  }

  /** 进入讨论模式，移向讨论中心 */
  enterDiscussion(centerX: number, centerY: number, slotAngle: number): void {
    this._inDiscussion = true;
    this._faceTargetX = centerX;
    this._faceTargetY = centerY;
    this.targetX = centerX + Math.cos(slotAngle) * DISCUSSION_RING_RADIUS;
    this.targetY = centerY + Math.sin(slotAngle) * DISCUSSION_RING_RADIUS;
  }

  /** 退出讨论模式 */
  exitDiscussion(): void {
    this._inDiscussion = false;
  }

  get inDiscussion(): boolean {
    return this._inDiscussion;
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  moveToStateRegion(state: AgentState): void {
    const region = STATE_REGIONS[state];
    this.targetX = region.x + randomInt(-region.radius, region.radius);
    this.targetY = region.y + randomInt(-region.radius, region.radius);
  }

  getCharKey(): string {
    return this.charKey;
  }
}
