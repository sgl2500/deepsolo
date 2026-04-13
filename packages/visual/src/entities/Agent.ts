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
  private readonly isLpc: boolean;

  // 讨论模式
  private _inDiscussion = false;
  private _faceTargetX = 0;
  private _faceTargetY = 0;

  // LPC 方向映射: game Direction(Up=0,Right=1,Left=2,Down=3) → LPC row(Up=0,Left=1,Down=2,Right=3)
  private static readonly LPC_DIR_ROW = [0, 3, 1, 2];

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
    this.isLpc = strategy.id === 'e2';
    this.direction = [Direction.Up, Direction.Right, Direction.Left, Direction.Down][index % 4];

    this.createSprite();
  }

  private createSprite(): void {
    if (this.isLpc) {
      this.createLpcSprite();
      return;
    }
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
      // 面向讨论中心
      this.direction = this.getDirection(
        this._faceTargetX - this.mapX,
        this._faceTargetY - this.mapY,
      );
      this.updateScreenPosition(playerX, playerY);
      this.updateWalkAnimation(time, false, this.phase, 'player');
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
    this.updateWalkAnimation(time, this.moving, this.phase, 'player');
  }

  /** 进入讨论模式，移向讨论中心 */
  enterDiscussion(centerX: number, centerY: number, slotAngle: number): void {
    this._inDiscussion = true;
    this._faceTargetX = centerX;
    this._faceTargetY = centerY;
    // 在讨论中心周围围成圈
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

  /** 设置移动目标（供外部调用） */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
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

  /** LPC 站立帧：行0/2（上/下）在第0帧，行1/3（左/右）在第7帧 */
  private static readonly LPC_STAND = [0, 7, 0, 7];

  /** 使用 LPC 精灵图创建 e2 角色精灵 */
  private createLpcSprite(): void {
    const dirRow = Agent.LPC_DIR_ROW[this.direction];
    const fIdx = dirRow * 8 + Agent.LPC_STAND[dirRow];
    const frame = this.scene.textures.getFrame('lpc_e2', fIdx);

    if (isFrameValid(frame)) {
      this.sprite = this.scene.add.image(5, 14, 'lpc_e2', fIdx)
        .setOrigin(0.5, 1.0)
        .setScale(2.1);
      this.container.add(this.sprite);
    } else {
      const body = this.scene.add.graphics();
      body.fillStyle(0x60a5fa);
      body.fillRoundedRect(-5, -1, 10, 11, 2);
      body.fillCircle(0, -6, 6);
      this.container.add(body);
    }

    const isEmerged = this.strategy.category === 'emerged';
    const nameColor = isEmerged ? '#60a5fa' : '#9ca3af';
    this.label = this.scene.add.text(5, 22, this.strategy.name, {
      fontSize: '8px',
      color: nameColor,
      stroke: '#000',
      strokeThickness: 2,
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);
    this.container.add(this.label);

    const retColor = this.strategy.returnPct >= 0 ? '#34d399' : '#f87171';
    const retText = `${this.strategy.returnPct >= 0 ? '+' : ''}${this.strategy.returnPct.toFixed(1)}%`;
    const retLabel = this.scene.add.text(5, 32, retText, {
      fontSize: '8px',
      color: retColor,
      stroke: '#000',
      strokeThickness: 2,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.container.add(retLabel);
  }

  /** 重写行走动画：e2 使用 LPC 精灵图 */
  protected updateWalkAnimation(time: number, moving: boolean, phaseOffset = 0, overrideCharKey?: string): void {
    if (this.isLpc) {
      if (!this.sprite) return;
      if (moving) {
        this.frameIndex = Math.floor(time / WALK_FRAME_INTERVAL + phaseOffset) % 7;
      } else {
        const dirRow = Agent.LPC_DIR_ROW[this.direction];
        this.frameIndex = Agent.LPC_STAND[dirRow];
      }
      const dirRow = Agent.LPC_DIR_ROW[this.direction];
      const fIdx = dirRow * 8 + this.frameIndex;
      const frame = this.scene.textures.getFrame('lpc_e2', fIdx);
      if (isFrameValid(frame)) {
        this.sprite.setTexture('lpc_e2', fIdx);
      }
      return;
    }
    super.updateWalkAnimation(time, moving, phaseOffset, overrideCharKey);
  }
}
