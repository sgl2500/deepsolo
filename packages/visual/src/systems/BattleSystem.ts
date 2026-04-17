// ============================================================
// BattleSystem.ts — 战斗引擎（回合循环 + 伤害计算 + AI + 渲染）
// ============================================================

import {
  type BattlePerson,
  type BattleAction,
  type BattleResult,
  type WugongDef,
  Direction,
} from '../types';
import {
  ARENA_SIZE,
  BATTLE_ANIM_SPEED,
  BATTLE_TURN_DELAY,
  BATTLE_LOG_MAX,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_HALF_W,
  TILE_HALF_H,
} from '../config';
import { createBattlePerson, NORMAL_ATTACK } from '../data/BattleData';
import type { EventBus } from '../core/EventBus';

// ── 战斗状态 ──

type Phase = 'idle' | 'running' | 'animating' | 'ended';

export class BattleSystem {
  private scene: Phaser.Scene;
  private eventBus: EventBus;

  // 战斗数据
  private persons: BattlePerson[] = [];
  private round = 0;
  private phase: Phase = 'idle';
  private turnQueue: BattlePerson[] = [];

  // 渲染对象
  private container: Phaser.GameObjects.Container | null = null;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private hpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private logTexts: Phaser.GameObjects.Text[] = [];
  private roundLabel: Phaser.GameObjects.Text | null = null;
  private endOverlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, eventBus: EventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
  }

  // ============================================================
  // 公开接口
  // ============================================================

  /** 是否正在战斗中 */
  isActive(): boolean {
    return this.phase !== 'idle';
  }

  /** 发起一场战斗 */
  start(redId: string, blueId: string): void {
    if (this.phase !== 'idle') return;

    const red = createBattlePerson(redId, 'red', { x: 1, y: 4 });
    const blue = createBattlePerson(blueId, 'blue', { x: 8, y: 4 });
    this.persons = [red, blue];
    this.round = 0;
    this.phase = 'running';

    this.renderArena();
    this.renderPersons();
    this.renderHUD();

    this.eventBus.emit('battle:start', { redId, blueId });

    // 延迟开始第一回合
    this.scene.time.delayedCall(800, () => this.nextTurn());
  }

  /** 每帧更新 */
  update(_time: number, _delta: number): void {
    // 目前由定时器驱动回合，帧更新保留给动画插值
  }

  /** 清理战斗 */
  destroy(): void {
    this.cleanup();
  }

  // ============================================================
  // 回合驱动
  // ============================================================

  private nextTurn(): void {
    if (this.phase === 'ended') return;

    // 检查是否需要新一轮
    if (this.turnQueue.length === 0) {
      this.round++;
      this.updateRoundLabel();
      // 按轻功降序排列
      const alive = this.persons.filter(p => p.alive);
      alive.sort((a, b) => b.speed - a.speed);
      this.turnQueue = [...alive];
    }

    if (this.turnQueue.length === 0) {
      this.endBattle();
      return;
    }

    const person = this.turnQueue.shift()!;
    this.executePersonTurn(person);
  }

  private executePersonTurn(person: BattlePerson): void {
    const action = this.aiDecide(person);
    this.phase = 'animating';

    this.executeAction(person, action, () => {
      // 动画完成后检查胜负
      const result = this.checkEnd();
      if (result) {
        this.endBattle(result);
        return;
      }

      this.phase = 'running';
      this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
    });
  }

  // ============================================================
  // AI 决策
  // ============================================================

  private aiDecide(person: BattlePerson): BattleAction {
    const enemy = this.getEnemy(person);
    if (!enemy) {
      return { type: 'move', target: { ...person.pos } };
    }

    const dist = this.manhattanDist(person.pos, enemy.pos);

    // 敌人在攻击范围内
    if (dist <= person.wugong.attackRange) {
      // MP 够用武功 → 用武功
      if (person.mp >= person.wugong.mpCost) {
        return { type: 'attack', skill: person.wugong, targetId: enemy.id };
      }
      // 否则普通攻击
      return { type: 'attack', skill: NORMAL_ATTACK, targetId: enemy.id };
    }

    // 不在攻击范围 → 朝敌人移动
    const reachable = this.calcMoveRange(person.pos, person.moveRange);
    let best = person.pos;
    let bestDist = Infinity;
    for (const pos of reachable) {
      const d = this.manhattanDist(pos, enemy.pos);
      if (d < bestDist) {
        bestDist = d;
        best = pos;
      }
    }
    return { type: 'move', target: best };
  }

  // ============================================================
  // 行动执行 + 动画
  // ============================================================

  private executeAction(
    person: BattlePerson,
    action: BattleAction,
    onComplete: () => void,
  ): void {
    if (action.type === 'move') {
      this.animateMove(person, action.target, onComplete);
    } else {
      const target = this.persons.find(p => p.id === action.targetId);
      if (!target) { onComplete(); return; }

      // 先面朝目标
      this.faceToward(person, target.pos);

      // 如果不在普通攻击范围但用了武功（远程），直接攻击
      // 否则可能需要先移动一步（简化：直接打）
      this.animateAttack(person, target, action.skill, onComplete);
    }
  }

  private animateMove(person: BattlePerson, target: { x: number; y: number }, done: () => void): void {
    const sprite = this.sprites.get(person.id);
    if (!sprite) { done(); return; }

    person.pos = { ...target };
    const screenPos = this.arenaToScreen(target.x, target.y);

    this.scene.tweens.add({
      targets: sprite,
      x: screenPos.x,
      y: screenPos.y,
      duration: BATTLE_ANIM_SPEED,
      ease: 'Linear',
      onComplete: () => {
        this.faceToward(person, this.getEnemy(person)?.pos ?? person.pos);
        done();
      },
    });
  }

  private animateAttack(
    attacker: BattlePerson,
    target: BattlePerson,
    skill: WugongDef,
    done: () => void,
  ): void {
    const targetSprite = this.sprites.get(target.id);
    const attackerSprite = this.sprites.get(attacker.id);

    // 伤害计算
    const { damage, hit } = this.calcDamage(attacker, target, skill);

    // 消耗内力
    attacker.mp = Math.max(0, attacker.mp - skill.mpCost);

    // 播放攻击特效
    const targetScreen = this.arenaToScreen(target.pos.x, target.pos.y);

    // 1) 攻击者小幅前冲
    if (attackerSprite) {
      const dx = targetScreen.x - attackerSprite.x;
      const dy = targetScreen.y - attackerSprite.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const rushDist = 10;

      this.scene.tweens.add({
        targets: attackerSprite,
        x: attackerSprite.x + (dx / len) * rushDist,
        y: attackerSprite.y + (dy / len) * rushDist,
        duration: 120,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }

    // 2) 延迟后显示伤害
    this.scene.time.delayedCall(200, () => {
      if (hit && damage > 0) {
        target.hp = Math.max(0, target.hp - damage);
        this.updateHPBar(target);
        this.showDamageNumber(targetScreen.x, targetScreen.y - 40, damage);

        // 目标闪红
        if (targetSprite) {
          targetSprite.setTint(0xff4444);
          this.scene.time.delayedCall(200, () => {
            targetSprite?.clearTint();
          });
        }

        // 检查死亡
        if (target.hp <= 0) {
          target.alive = false;
          this.playDeathEffect(target);
        }
      } else {
        this.showDamageNumber(targetScreen.x, targetScreen.y - 40, 0); // MISS
      }

      // 日志
      const actionText = hit
        ? `${attacker.name} 使用 [${skill.name}] → ${target.name} 受到 ${damage} 伤害！`
        : `${attacker.name} 使用 [${skill.name}] → 未命中！`;
      this.addLog(actionText);

      this.eventBus.emit('battle:action', {
        actorId: attacker.id,
        actorName: attacker.name,
        action: skill.name,
        damage: hit ? damage : 0,
        targetHp: target.hp,
        hit,
      });

      // 等 HP 条动画结束后回调
      this.scene.time.delayedCall(300, done);
    });
  }

  // ============================================================
  // 伤害计算
  // ============================================================

  private calcDamage(
    attacker: BattlePerson,
    defender: BattlePerson,
    skill: WugongDef,
  ): { damage: number; hit: boolean } {
    // 命中判定
    const hitRoll = Math.random() * 100;
    if (hitRoll >= skill.hitRate) {
      return { damage: 0, hit: false };
    }

    // 基础伤害
    const atk = attacker.attack;
    const def = defender.defense;
    const base = skill.power * atk / (atk + def + 50);

    // 随机波动 ±15%
    const randomMod = 0.85 + Math.random() * 0.30;

    const damage = Math.max(1, Math.round(base * randomMod));
    return { damage, hit: true };
  }

  // ============================================================
  // 胜负检查
  // ============================================================

  private checkEnd(): BattleResult | null {
    const redAlive = this.persons.find(p => p.team === 'red' && p.alive);
    const blueAlive = this.persons.find(p => p.team === 'blue' && p.alive);

    if (!redAlive) {
      const winner = this.persons.find(p => p.team === 'blue')!;
      const loser = this.persons.find(p => p.team === 'red')!;
      return { winnerId: winner.id, winnerName: winner.name, loserId: loser.id, loserName: loser.name, rounds: this.round };
    }
    if (!blueAlive) {
      const winner = this.persons.find(p => p.team === 'red')!;
      const loser = this.persons.find(p => p.team === 'blue')!;
      return { winnerId: winner.id, winnerName: winner.name, loserId: loser.id, loserName: loser.name, rounds: this.round };
    }
    return null;
  }

  private endBattle(result?: BattleResult): void {
    this.phase = 'ended';
    const res = result ?? {
      winnerId: '', winnerName: '', loserId: '', loserName: '', rounds: this.round,
    };

    this.addLog(`★ 战斗结束！${res.winnerName} 获胜！`);
    this.renderEndScreen(res);
    this.eventBus.emit('battle:end', res);

    // 3 秒后自动返回
    this.scene.time.delayedCall(3000, () => {
      this.cleanup();
      this.phase = 'idle';
    });
  }

  // ============================================================
  // 移动范围计算 (BFS)
  // ============================================================

  private calcMoveRange(pos: { x: number; y: number }, range: number): { x: number; y: number }[] {
    const visited = new Set<string>();
    const result: { x: number; y: number }[] = [];
    const queue: { x: number; y: number; steps: number }[] = [{ ...pos, steps: 0 }];
    visited.add(`${pos.x},${pos.y}`);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      result.push({ x: cur.x, y: cur.y });

      if (cur.steps >= range) continue;

      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || nx >= ARENA_SIZE || ny < 0 || ny >= ARENA_SIZE) continue;
        if (visited.has(key)) continue;
        // 检查是否有其他角色占据
        const occupied = this.persons.some(p => p.alive && p.pos.x === nx && p.pos.y === ny);
        if (occupied) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, steps: cur.steps + 1 });
      }
    }

    return result;
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private getEnemy(person: BattlePerson): BattlePerson | undefined {
    const enemyTeam = person.team === 'red' ? 'blue' : 'red';
    return this.persons.find(p => p.team === enemyTeam && p.alive);
  }

  private manhattanDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private faceToward(person: BattlePerson, target: { x: number; y: number }): void {
    const dx = target.x - person.pos.x;
    const dy = target.y - person.pos.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      person.facing = dx > 0 ? Direction.Right : Direction.Left;
    } else {
      person.facing = dy > 0 ? Direction.Down : Direction.Up;
    }
    // 更新精灵朝向帧
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      const charKey = this.getCharKey(person);
      const frameKey = `${charKey}_d${person.facing}_f0`;
      const frame = this.scene.textures.getFrame('chars', frameKey);
      if (frame) sprite.setTexture('chars', frameKey);
    }
  }

  private getCharKey(_person: BattlePerson): string {
    return 'player'; // 统一用 player 精灵
  }

  /** 竞技场地图坐标 → 屏幕坐标 */
  private arenaToScreen(x: number, y: number): { x: number; y: number } {
    // 以竞技场中心 (4.5, 4.5) 为视点
    const cx = (ARENA_SIZE - 1) / 2;
    const cy = (ARENA_SIZE - 1) / 2;
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: TILE_HALF_W * (dx - dy) + SCREEN_WIDTH / 2,
      y: TILE_HALF_H * (dx + dy) + SCREEN_HEIGHT / 2,
    };
  }

  // ============================================================
  // 渲染 — 战场
  // ============================================================

  private renderArena(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(5000);
    this.container.setScrollFactor(0);

    // 半透明黑色背景遮盖世界地图
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0e1a, 0.92);
    bg.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    bg.setScrollFactor(0);
    this.container.add(bg);

    // 画等距菱形网格
    const grid = this.scene.add.graphics();
    grid.setScrollFactor(0);

    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const screen = this.arenaToScreen(x, y);
        this.drawDiamond(grid, screen.x, screen.y, TILE_HALF_W, TILE_HALF_H, 0x2a2e3a, 0x3a3e4a);
      }
    }
    this.container.add(grid);

    // "VS" 标题
    const title = this.scene.add.text(SCREEN_WIDTH / 2, 20, '⚔ 策略对决 ⚔', {
      fontSize: '20px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    title.setScrollFactor(0);
    this.container.add(title);
  }

  /** 画一个等距菱形（填充 + 边框） */
  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    hw: number, hh: number,
    fillColor: number, lineColor: number,
  ): void {
    g.fillStyle(fillColor, 0.6);
    g.lineStyle(1, lineColor, 0.4);
    g.beginPath();
    g.moveTo(cx, cy - hh);     // 上
    g.lineTo(cx + hw, cy);     // 右
    g.lineTo(cx, cy + hh);     // 下
    g.lineTo(cx - hw, cy);     // 左
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  // ============================================================
  // 渲染 — 角色
  // ============================================================

  private renderPersons(): void {
    for (const person of this.persons) {
      const screen = this.arenaToScreen(person.pos.x, person.pos.y);
      const tint = person.team === 'red' ? 0xff6666 : 0x6699ff;

      // 精灵
      const frameKey = `player_d${person.facing}_f0`;
      const frame = this.scene.textures.getFrame('chars', frameKey);
      let sprite: Phaser.GameObjects.Image;
      if (frame) {
        sprite = this.scene.add.image(screen.x, screen.y, 'chars', frameKey);
        sprite.setScale(0.7);
      } else {
        // 回退：彩色圆
        sprite = this.scene.add.image(screen.x, screen.y, '__DEFAULT');
        // 用 graphics 代替
        const g = this.scene.add.graphics();
        g.setScrollFactor(0);
        g.fillStyle(tint, 0.9);
        g.fillCircle(screen.x, screen.y, 12);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(screen.x, screen.y - 4, 5);
        this.container!.add(g);
        sprite = this.scene.add.image(screen.x, screen.y, '__DEFAULT');
        sprite.setVisible(false);
      }
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(screen.y + 100);
      sprite.setScrollFactor(0);
      this.container!.add(sprite);
      this.sprites.set(person.id, sprite);

      // 名字标签
      const nameColor = person.team === 'red' ? '#ff6666' : '#6699ff';
      const label = this.scene.add.text(screen.x, screen.y + 10, person.name, {
        fontSize: '11px',
        color: nameColor,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      label.setScrollFactor(0);
      label.setDepth(screen.y + 101);
      this.container!.add(label);
      this.nameLabels.set(person.id, label);
    }
  }

  // ============================================================
  // 渲染 — HUD
  // ============================================================

  private renderHUD(): void {
    // 左右两侧 HP/MP 信息面板
    for (const person of this.persons) {
      const isRed = person.team === 'red';
      const panelX = isRed ? 20 : SCREEN_WIDTH - 220;
      const panelY = 50;

      // 背景
      const bg = this.scene.add.graphics();
      bg.setScrollFactor(0);
      bg.fillStyle(0x1a1a2e, 0.85);
      bg.fillRoundedRect(panelX, panelY, 200, 70, 6);
      bg.lineStyle(1, isRed ? 0xff4444 : 0x4488ff, 0.6);
      bg.strokeRoundedRect(panelX, panelY, 200, 70, 6);
      this.container!.add(bg);

      // 名字
      const nameText = this.scene.add.text(panelX + 10, panelY + 6, person.name, {
        fontSize: '13px',
        color: isRed ? '#ff8888' : '#88aaff',
        fontStyle: 'bold',
      });
      nameText.setScrollFactor(0);
      this.container!.add(nameText);

      // 武功名
      const wugongText = this.scene.add.text(panelX + 10 + person.name.length * 13 + 10, panelY + 6, `[${person.wugong.name}]`, {
        fontSize: '11px',
        color: '#aaa',
      });
      wugongText.setScrollFactor(0);
      this.container!.add(wugongText);

      // HP 条
      const hpBar = this.scene.add.graphics();
      hpBar.setScrollFactor(0);
      this.container!.add(hpBar);
      this.hpBars.set(person.id, hpBar);
      this.drawHPBar(hpBar, panelX + 10, panelY + 28, 180, 12, person.hp, person.maxHp, 0x22c55e);

      // MP 条
      const mpBar = this.scene.add.graphics();
      mpBar.setScrollFactor(0);
      this.container!.add(mpBar);
      this.drawHPBar(mpBar, panelX + 10, panelY + 48, 180, 8, person.mp, person.maxMp, 0x3b82f6);
    }

    // 回合标签
    this.roundLabel = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 110, '回合 1', {
      fontSize: '14px',
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.roundLabel.setScrollFactor(0);
    this.container!.add(this.roundLabel);

    // 日志区域
    for (let i = 0; i < BATTLE_LOG_MAX; i++) {
      const t = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 90 + i * 16, '', {
        fontSize: '12px',
        color: '#cccccc',
      }).setOrigin(0.5, 0);
      t.setScrollFactor(0);
      this.container!.add(t);
      this.logTexts.push(t);
    }
  }

  private drawHPBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    w: number, h: number,
    current: number, max: number,
    color: number,
  ): void {
    g.clear();
    // 背景
    g.fillStyle(0x333333, 0.8);
    g.fillRoundedRect(x, y, w, h, 2);
    // 前景
    const ratio = Math.max(0, current / max);
    const barW = Math.round(w * ratio);
    if (barW > 0) {
      g.fillStyle(color, 0.9);
      g.fillRoundedRect(x, y, barW, h, 2);
    }
    // 文字
    // (文字由单独的 Text 对象处理更灵活，这里省略)
  }

  private updateHPBar(person: BattlePerson): void {
    const bar = this.hpBars.get(person.id);
    if (!bar) return;
    const isRed = person.team === 'red';
    const panelX = isRed ? 20 : SCREEN_WIDTH - 220;
    const panelY = 50;

    // HP 颜色根据比例变化
    const ratio = person.hp / person.maxHp;
    const hpColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444;
    this.drawHPBar(bar, panelX + 10, panelY + 28, 180, 12, person.hp, person.maxHp, hpColor);

    // MP 条也需要更新
    // (MP 条是单独的 Graphics，暂不追踪 — 后续可添加)
  }

  private updateRoundLabel(): void {
    if (this.roundLabel) {
      this.roundLabel.setText(`回合 ${this.round}`);
    }
  }

  private addLog(text: string): void {
    // 上移已有日志
    for (let i = 0; i < this.logTexts.length - 1; i++) {
      this.logTexts[i].setText(this.logTexts[i + 1].text);
    }
    // 新日志加在最底行
    const last = this.logTexts[this.logTexts.length - 1];
    if (last) last.setText(text);
  }

  // ============================================================
  // 渲染 — 特效
  // ============================================================

  private showDamageNumber(x: number, y: number, damage: number): void {
    const text = damage > 0 ? `-${damage}` : 'MISS';
    const color = damage > 0 ? '#ff4444' : '#888888';
    const fontSize = damage > 80 ? '20px' : '16px';

    const txt = this.scene.add.text(x, y, text, {
      fontSize,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    txt.setScrollFactor(0);
    txt.setDepth(9998);
    this.container!.add(txt);

    this.scene.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  private playDeathEffect(person: BattlePerson): void {
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 500,
        ease: 'Power2',
      });
    }
    const label = this.nameLabels.get(person.id);
    if (label) {
      this.scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: 500,
      });
    }
  }

  // ============================================================
  // 渲染 — 结束画面
  // ============================================================

  private renderEndScreen(result: BattleResult): void {
    this.endOverlay = this.scene.add.container(0, 0);
    this.endOverlay.setDepth(9999);
    this.endOverlay.setScrollFactor(0);

    // 半透明遮罩
    const mask = this.scene.add.graphics();
    mask.fillStyle(0x000000, 0.6);
    mask.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    mask.setScrollFactor(0);
    this.endOverlay.add(mask);

    // 结果文字
    const title = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 40, '★ 战斗结束 ★', {
      fontSize: '28px',
      color: '#fbbf24',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    title.setScrollFactor(0);
    this.endOverlay.add(title);

    const winner = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10, `胜者: ${result.winnerName}`, {
      fontSize: '22px',
      color: '#22c55e',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    winner.setScrollFactor(0);
    this.endOverlay.add(winner);

    const rounds = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 45, `总回合: ${result.rounds}`, {
      fontSize: '16px',
      color: '#cccccc',
    }).setOrigin(0.5);
    rounds.setScrollFactor(0);
    this.endOverlay.add(rounds);

    const hint = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 80, '3 秒后自动返回...', {
      fontSize: '13px',
      color: '#888',
    }).setOrigin(0.5);
    hint.setScrollFactor(0);
    this.endOverlay.add(hint);
  }

  // ============================================================
  // 清理
  // ============================================================

  private cleanup(): void {
    this.sprites.clear();
    this.hpBars.clear();
    this.nameLabels.clear();
    this.logTexts = [];

    if (this.endOverlay) {
      this.endOverlay.destroy(true);
      this.endOverlay = null;
    }
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.roundLabel = null;
    this.persons = [];
    this.turnQueue = [];
  }
}
