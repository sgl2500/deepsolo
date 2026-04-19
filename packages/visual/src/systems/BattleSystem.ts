// ============================================================
// BattleSystem.ts — 战斗引擎（回合循环 + 伤害计算 + AI + 渲染）
// ============================================================

import {
  type BattlePerson,
  type BattleAction,
  type BattleResult,
  type WugongDef,
  WugongType,
  Direction,
  ManualPhase,
} from '../types';
import {
  ARENA_SIZE,
  BATTLE_ANIM_SPEED,
  BATTLE_TURN_DELAY,
  BATTLE_LOG_MAX,
  FIGHT_FRAMES_PER_DIR,
  FIGHT_FRAME_INTERVAL,
  BATTLE_TILE_SCALE,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_HALF_W,
  TILE_HALF_H,
  WALK_FRAME_COUNT,
  WALK_FRAME_INTERVAL,
} from '../config';
import { createBattlePerson, NORMAL_ATTACK, WUGONG_DEFS, EFT_FRAME_COUNTS } from '../data/BattleData';
import type { EventBus } from '../core/EventBus';

// ── 战斗状态 ──

type Phase = 'idle' | 'running' | 'animating' | 'ended' | 'manual';

/** 手动控制键盘输入类型 */
type BattleInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

/**
 * JYQXZ Fight000 精灵帧布局 (Attack Type 0):
 *   右上: 40-51  (12帧)
 *   右下: 52-63  (12帧)
 *   左上: 64-75  (12帧)
 *   左下: 76-87  (12帧)
 *
 * 等距视角下 DeepSolo Direction → Fight 帧偏移:
 *   Direction.Up(0)    → 右上 → 40
 *   Direction.Right(1) → 右下 → 52
 *   Direction.Left(2)  → 左上 → 64
 *   Direction.Down(3)  → 左下 → 76
 */
const DIR_TO_FIGHT_OFFSET: Record<number, number> = {
  [Direction.Up]: 40,
  [Direction.Right]: 52,
  [Direction.Left]: 64,
  [Direction.Down]: 76,
};

/** Direction 枚举值 → chars atlas 方向后缀 */
const DIR_CHARS_D: Record<number, number> = {
  [Direction.Up]: 0,
  [Direction.Right]: 1,
  [Direction.Left]: 2,
  [Direction.Down]: 3,
};

/** 根据 frame index 获取 fight sprite 的 texture key */
function fightKey(frameIdx: number): string {
  return `fight000_${String(frameIdx).padStart(4, '0')}`;
}

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
  /** 角色 sprite 初始缩放 */
  private readonly spriteScale = 2.0;
  /** chars 走路帧缩放 (fight视觉高度100 / chars帧高度195 ≈ 0.51) */
  private readonly walkSpriteScale = 0.51;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private hpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private logTexts: Phaser.GameObjects.Text[] = [];
  private roundLabel: Phaser.GameObjects.Text | null = null;
  private endOverlay: Phaser.GameObjects.Container | null = null;

  // ── 手动控制 ──
  private isAutoMode = true;
  private manualPhase: ManualPhase = ManualPhase.ActionMenu;
  private currentManualPerson: BattlePerson | null = null;
  private savedPos: { x: number; y: number } | null = null;

  // 光标
  private cursorGridPos = { x: 0, y: 0 };
  private cursorSprite: Phaser.GameObjects.Graphics | null = null;

  // 范围覆盖
  private moveRangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private attackRangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private moveRangeCells: { x: number; y: number }[] = [];

  // 操作菜单
  private menuContainer: Phaser.GameObjects.Container | null = null;
  private menuCursorIndex = 0;
  private menuHighlight: Phaser.GameObjects.Graphics | null = null;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private readonly MENU_ITEMS = ['移动', '攻击', '防御', '休息', '状态', '自动'];

  // 武功子菜单
  private wugongContainer: Phaser.GameObjects.Container | null = null;
  private wugongCursorIndex = 0;
  private availableSkills: WugongDef[] = [];
  private selectedSkill: WugongDef | null = null;

  // 键盘
  private battleKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    confirm: Phaser.Input.Keyboard.Key;
    cancel: Phaser.Input.Keyboard.Key;
    toggleAuto: Phaser.Input.Keyboard.Key;
  };

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
    this.isAutoMode = true;

    this.initBattleKeys();
    this.renderArena();
    this.renderPersons();
    this.renderHUD();

    this.eventBus.emit('battle:start', { redId, blueId });

    // 延迟开始第一回合
    this.scene.time.delayedCall(800, () => this.nextTurn());
  }

  /** 每帧更新 */
  update(_time: number, _delta: number): void {
    if (this.phase === 'idle' || this.phase === 'ended') return;

    // Tab 键切换手动/自动
    if (this.battleKeys?.toggleAuto && Phaser.Input.Keyboard.JustDown(this.battleKeys.toggleAuto)) {
      if (this.phase === 'manual') {
        this.switchToAuto();
        return;
      } else {
        // 自动 → 手动：下一回合开始生效
        this.isAutoMode = false;
        this.addLog('>> 下一回合切换为手动模式 (Tab切回自动)');
        return;
      }
    }

    if (this.phase !== 'manual') return;

    const input = this.getBattleInput();
    if (!input) return;

    switch (this.manualPhase) {
      case ManualPhase.ActionMenu:   this.handleMenuInput(input); break;
      case ManualPhase.MoveSelect:   this.handleMoveSelectInput(input); break;
      case ManualPhase.WugongSelect: this.handleWugongSelectInput(input); break;
      case ManualPhase.TargetSelect: this.handleTargetSelectInput(input); break;
    }
  }

  /** 清理战斗 */
  destroy(): void {
    this.cleanup();
  }

  // ============================================================
  // 回合驱动
  // ============================================================

  private initBattleKeys(): void {
    const kb = this.scene.input.keyboard!;
    this.battleKeys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      confirm: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      cancel: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      toggleAuto: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
    };
  }

  private getBattleInput(): BattleInput | null {
    const k = this.battleKeys;
    if (!k) return null;
    if (Phaser.Input.Keyboard.JustDown(k.up)) return 'up';
    if (Phaser.Input.Keyboard.JustDown(k.down)) return 'down';
    if (Phaser.Input.Keyboard.JustDown(k.left)) return 'left';
    if (Phaser.Input.Keyboard.JustDown(k.right)) return 'right';
    if (Phaser.Input.Keyboard.JustDown(k.confirm)) return 'confirm';
    if (Phaser.Input.Keyboard.JustDown(k.cancel)) return 'cancel';
    return null;
  }

  // ── 手动模式进入/退出 ──

  private enterManualMode(person: BattlePerson): void {
    this.phase = 'manual';
    this.currentManualPerson = person;
    this.savedPos = { ...person.pos };
    this.manualPhase = ManualPhase.ActionMenu;
    this.menuCursorIndex = 0;
    this.addLog(`>> ${person.name} 的回合 (手动)`);
    this.showActionMenu(person);
  }

  exitManualMode(): void {
    this.hideActionMenu();
    this.hideWugongMenu();
    this.clearRangeOverlays();
    this.hideCursor();
    this.hideHintText();
    this.currentManualPerson = null;
    this.savedPos = null;
    this.selectedSkill = null;
  }

  private switchToAuto(): void {
    this.isAutoMode = true;
    const person = this.currentManualPerson;
    this.exitManualMode();
    this.phase = 'running';
    this.addLog('>> 切换为自动模式');
    if (person && person.alive) {
      this.executePersonTurn(person);
    } else {
      this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
    }
  }

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
    if (this.isAutoMode) {
      this.executePersonTurn(person);
    } else {
      this.enterManualMode(person);
    }
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
  // 手动控制 — 菜单输入处理
  // ============================================================

  private handleMenuInput(input: BattleInput): void {
    const items = this.MENU_ITEMS.length;
    if (input === 'up') {
      this.menuCursorIndex = (this.menuCursorIndex - 1 + items) % items;
      this.updateMenuHighlight();
    } else if (input === 'down') {
      this.menuCursorIndex = (this.menuCursorIndex + 1) % items;
      this.updateMenuHighlight();
    } else if (input === 'confirm') {
      switch (this.menuCursorIndex) {
        case 0: this.enterMoveSelect(); break;
        case 1: this.enterWugongSelect(); break;
        case 2: this.executeManualAction('defend'); break;
        case 3: this.executeManualAction('rest'); break;
        case 4: this.showStatusInLog(); break;
        case 5: this.switchToAuto(); break;
      }
    } else if (input === 'cancel') {
      // ESC 从菜单 = 结束回合（等同休息）
      this.executeManualAction('rest');
    }
  }

  private handleMoveSelectInput(input: BattleInput): void {
    if (input === 'up') {
      this.moveCursorBy(0, -1);
    } else if (input === 'down') {
      this.moveCursorBy(0, 1);
    } else if (input === 'left') {
      this.moveCursorBy(-1, 0);
    } else if (input === 'right') {
      this.moveCursorBy(1, 0);
    } else if (input === 'confirm') {
      const inRange = this.moveRangeCells.some(c => c.x === this.cursorGridPos.x && c.y === this.cursorGridPos.y);
      if (inRange) {
        this.executeManualMove();
      } else {
        this.addLog(`不能移动到(${this.cursorGridPos.x},${this.cursorGridPos.y}) 范围${this.moveRangeCells.length}格`);
      }
    } else if (input === 'cancel') {
      this.clearRangeOverlays();
      this.hideCursor();
      this.hideHintText();
      this.manualPhase = ManualPhase.ActionMenu;
      this.showActionMenu(this.currentManualPerson!);
    }
  }

  private handleWugongSelectInput(input: BattleInput): void {
    const count = this.availableSkills.length;
    if (input === 'up') {
      this.wugongCursorIndex = (this.wugongCursorIndex - 1 + count) % count;
      this.updateWugongHighlight();
    } else if (input === 'down') {
      this.wugongCursorIndex = (this.wugongCursorIndex + 1) % count;
      this.updateWugongHighlight();
    } else if (input === 'confirm') {
      const skill = this.availableSkills[this.wugongCursorIndex];
      if (!skill) return;
      const person = this.currentManualPerson!;
      if (person.mp < skill.mpCost) {
        this.addLog(`MP不足，${skill.name}需要${skill.mpCost}MP`);
        return;
      }
      this.selectedSkill = skill;
      this.hideWugongMenu();
      // 进入选中心点
      this.enterTargetSelect();
    } else if (input === 'cancel') {
      this.hideWugongMenu();
      this.manualPhase = ManualPhase.ActionMenu;
      this.showActionMenu(this.currentManualPerson!);
    }
  }

  private handleTargetSelectInput(input: BattleInput): void {
    if (input === 'up') {
      this.moveCursorBy(0, -1);
    } else if (input === 'down') {
      this.moveCursorBy(0, 1);
    } else if (input === 'left') {
      this.moveCursorBy(-1, 0);
    } else if (input === 'right') {
      this.moveCursorBy(1, 0);
    } else if (input === 'confirm') {
      // 以光标为中心点释放技能
      this.executeManualAttack();
    } else if (input === 'cancel') {
      this.clearRangeOverlays();
      this.hideCursor();
      this.hideHintText();
      this.enterWugongSelect();
    }
  }

  // ── 手动行动执行 ──

  private executeManualAction(action: 'defend' | 'rest'): void {
    const person = this.currentManualPerson!;
    this.hideActionMenu();

    if (action === 'defend') {
      this.addLog(`${person.name} 防御，伤害减半`);
      // 防御效果：标记，下一回合恢复（简化实现）
    } else {
      // 休息：恢复少量 MP
      const mpRecover = Math.floor(person.maxMp * 0.1);
      person.mp = Math.min(person.maxMp, person.mp + mpRecover);
      this.addLog(`${person.name} 休息，恢复 ${mpRecover} MP`);
    }

    this.exitManualMode();
    this.phase = 'running';
    this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
  }

  private executeManualMove(): void {
    const person = this.currentManualPerson!;
    const target = { ...this.cursorGridPos };

    this.clearRangeOverlays();
    this.hideCursor();
    this.hideHintText();

    this.addLog(`移动到 (${target.x},${target.y})`);

    // 如果位置没变，直接回菜单
    if (target.x === person.pos.x && target.y === person.pos.y) {
      this.manualPhase = ManualPhase.ActionMenu;
      this.showActionMenu(person);
      return;
    }

    this.phase = 'animating';
    this.animateMove(person, target, () => {
      this.phase = 'manual';
      this.manualPhase = ManualPhase.ActionMenu;
      this.showActionMenu(person);
    });
  }

  private showStatusInLog(): void {
    const person = this.currentManualPerson!;
    this.addLog(`${person.name} HP:${person.hp}/${person.maxHp} MP:${person.mp}/${person.maxMp} ATK:${person.attack} DEF:${person.defense}`);
  }

  // ── 手动子阶段进入 ──

  private enterMoveSelect(): void {
    const person = this.currentManualPerson!;
    this.hideActionMenu();
    this.moveRangeCells = this.calcMoveRange(person.pos, person.moveRange);
    this.showMoveRange(this.moveRangeCells);
    this.cursorGridPos = { ...person.pos };
    this.showCursor(person.pos.x, person.pos.y);
    this.showHintText('方向键移动光标，Space确认，ESC取消');
    this.addLog(`可移动 ${this.moveRangeCells.length} 格 (从${person.pos.x},${person.pos.y})`);
    this.manualPhase = ManualPhase.MoveSelect;
  }

  private enterWugongSelect(): void {
    const person = this.currentManualPerson!;
    this.hideActionMenu();
    // 专属武功 + 普通攻击
    this.availableSkills = [person.wugong, NORMAL_ATTACK];
    this.wugongCursorIndex = 0;
    this.renderWugongMenu(person);
    this.manualPhase = ManualPhase.WugongSelect;
  }

  private enterTargetSelect(): void {
    const person = this.currentManualPerson!;
    const skill = this.selectedSkill!;
    this.hideWugongMenu();
    // 光标初始定位到敌人位置（方便瞄准）
    const enemy = this.getEnemy(person);
    this.cursorGridPos = enemy ? { ...enemy.pos } : { ...person.pos };
    this.showCursor(this.cursorGridPos.x, this.cursorGridPos.y);
    const aoe = skill.aoeSize ?? 1;
    const half = Math.floor(aoe / 2);
    this.showHintText(`[${skill.name}] 方向键选中心点，Space释放${aoe > 1 ? `(${aoe}x${aoe}范围)` : ''}`);
    this.manualPhase = ManualPhase.TargetSelect;
  }

  /** 以光标为中心释放技能 */
  private executeManualAttack(): void {
    const person = this.currentManualPerson!;
    const skill = this.selectedSkill!;
    const centerX = this.cursorGridPos.x;
    const centerY = this.cursorGridPos.y;

    this.clearRangeOverlays();
    this.hideCursor();
    this.hideActionMenu();
    this.hideHintText();
    this.manualPhase = ManualPhase.ActionMenu;
    this.phase = 'animating';

    // 消耗 MP
    person.mp = Math.max(0, person.mp - skill.mpCost);

    const isSpecial = skill.id !== 'normal_attack';
    const aoeSize = skill.aoeSize ?? 1;
    const half = Math.floor(aoeSize / 2);

    // 找 AoE 范围内的敌人
    const targets: BattlePerson[] = [];
    for (const p of this.persons) {
      if (!p.alive || p.team === person.team) continue;
      const dx = p.pos.x - centerX;
      const dy = p.pos.y - centerY;
      if (Math.abs(dx) <= half && Math.abs(dy) <= half) {
        targets.push(p);
      }
    }

    // 面朝中心点方向
    const fakeTarget = { x: centerX, y: centerY };
    this.faceToward(person, fakeTarget);

    // 显示武功名
    if (isSpecial) {
      this.showKungfuName(skill.name, skill.type);
    }
    const nameDelay = isSpecial ? 400 : 100;

    this.scene.time.delayedCall(nameDelay, () => {
      // 播放攻击帧
      this.cycleAttackFrames(person);

      const attackerSprite = this.sprites.get(person.id);
      if (attackerSprite) {
        const s = this.spriteScale;
        this.scene.tweens.add({
          targets: attackerSprite,
          scaleX: s * 0.85, scaleY: s * 0.9,
          duration: 120, ease: 'Quad.easeIn',
          onComplete: () => {
            this.scene.tweens.add({
              targets: attackerSprite,
              scaleX: s * 1.15, scaleY: s * 1.15,
              duration: 150, ease: 'Back.easeOut',
              onComplete: () => {
                // ===== 播放技能特效（以中心点扩散） =====
                const centerScreen = this.arenaToScreen(centerX, centerY);
                if (aoeSize >= 3) {
                  this.playAoeEffect(centerX, centerY, skill.effectId, aoeSize);
                } else {
                  this.playEftSprite(centerScreen.x, centerScreen.y, skill.effectId);
                }

                // ===== 处理伤害 =====
                this.scene.time.delayedCall(250, () => {
                  // 恢复攻击者缩放
                  if (attackerSprite) {
                    this.scene.tweens.add({
                      targets: attackerSprite,
                      scaleX: this.spriteScale, scaleY: this.spriteScale,
                      duration: 200, ease: 'Quad.easeOut',
                      onComplete: () => this.resetSpriteFrame(person),
                    });
                  }

                  if (targets.length > 0) {
                    for (const target of targets) {
                      const { damage, hit } = this.calcDamage(person, target, skill);
                      const targetScreen = this.arenaToScreen(target.pos.x, target.pos.y);
                      const targetSprite = this.sprites.get(target.id);

                      if (hit && damage > 0) {
                        target.hp = Math.max(0, target.hp - damage);
                        this.updateHPBar(target);
                        this.playHitFlash(targetScreen.x, targetScreen.y);
                        if (targetSprite) {
                          targetSprite.setTint(0xff4444);
                          this.scene.tweens.add({
                            targets: targetSprite,
                            x: targetScreen.x - 4, duration: 40, yoyo: true, repeat: 3,
                            onComplete: () => {
                              targetSprite.clearTint();
                              this.scene.tweens.add({ targets: targetSprite, x: targetScreen.x, duration: 50 });
                            },
                          });
                        }
                        this.scene.time.delayedCall(80, () => {
                          this.showDamageNumber(targetScreen.x, targetScreen.y - 45, damage, damage > 80);
                        });
                        this.addLog(`${person.name} [${skill.name}] → ${target.name} ${damage}伤害！`);
                        if (target.hp <= 0) {
                          target.alive = false;
                          this.scene.time.delayedCall(500, () => this.playDeathEffect(target));
                        }
                      } else {
                        this.showDamageNumber(targetScreen.x, targetScreen.y - 45, 0, false);
                        this.addLog(`${person.name} [${skill.name}] → ${target.name} 未命中！`);
                      }
                    }
                  } else {
                    // 空挥：只显示技能效果
                    this.addLog(`${person.name} [${skill.name}] → 空挥`);
                  }

                  this.eventBus.emit('battle:action', {
                    actorId: person.id, actorName: person.name,
                    action: skill.name, damage: 0, targetHp: 0, hit: targets.length > 0,
                  });

                  this.scene.time.delayedCall(700, () => {
                    const result = this.checkEnd();
                    if (result) { this.endBattle(result); return; }
                    this.phase = 'running';
                    this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
                  });
                });
              },
            });
          },
        });
      } else {
        const centerScreen = this.arenaToScreen(centerX, centerY);
        this.playEftSprite(centerScreen.x, centerScreen.y, skill.effectId);
        this.scene.time.delayedCall(500, () => {
          const result = this.checkEnd();
          if (result) { this.endBattle(result); return; }
          this.phase = 'running';
          this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
        });
      }
    });
  }

  // ── 攻击范围计算 ──

  private calcAttackRange(pos: { x: number; y: number }, range: number): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (nx < 0 || nx >= ARENA_SIZE || ny < 0 || ny >= ARENA_SIZE) continue;
        result.push({ x: nx, y: ny });
      }
    }
    return result;
  }

  private getPersonAt(x: number, y: number): BattlePerson | undefined {
    return this.persons.find(p => p.alive && p.pos.x === x && p.pos.y === y);
  }

  // ── 光标 ──

  private moveCursorBy(dx: number, dy: number): void {
    const nx = this.cursorGridPos.x + dx;
    const ny = this.cursorGridPos.y + dy;
    if (nx < 0 || nx >= ARENA_SIZE || ny < 0 || ny >= ARENA_SIZE) return;
    this.cursorGridPos = { x: nx, y: ny };
    this.updateCursorPosition();
    this.showHintText(`光标(${nx},${ny}) 方向键移动，Space确认`);
  }

  private showCursor(gx: number, gy: number): void {
    this.hideCursor();
    const screen = this.arenaToScreen(gx, gy);
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;

    this.cursorSprite = this.scene.add.graphics();
    this.cursorSprite.setDepth(9000);
    this.cursorSprite.setScrollFactor(0);

    this.drawCursorDiamond(this.cursorSprite, screen.x, screen.y, hw, hh, 0xfbbf24);

    this.container?.add(this.cursorSprite);

    // 闪烁 tween
    this.scene.tweens.add({
      targets: this.cursorSprite,
      alpha: { from: 1, to: 0.3 },
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
  }

  private updateCursorPosition(): void {
    if (!this.cursorSprite) return;
    const screen = this.arenaToScreen(this.cursorGridPos.x, this.cursorGridPos.y);
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;

    this.cursorSprite.clear();
    this.drawCursorDiamond(this.cursorSprite, screen.x, screen.y, hw, hh, 0xfbbf24);
  }

  /** 画一个明显的光标菱形：填充 + 粗边框 */
  private drawCursorDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, hw: number, hh: number, color: number): void {
    const e = 3; // 外扩像素
    g.fillStyle(color, 0.35);
    g.beginPath();
    g.moveTo(cx, cy - hh - e);
    g.lineTo(cx + hw + e, cy);
    g.lineTo(cx, cy + hh + e);
    g.lineTo(cx - hw - e, cy);
    g.closePath();
    g.fillPath();

    g.lineStyle(2, color, 0.9);
    g.beginPath();
    g.moveTo(cx, cy - hh - e);
    g.lineTo(cx + hw + e, cy);
    g.lineTo(cx, cy + hh + e);
    g.lineTo(cx - hw - e, cy);
    g.closePath();
    g.strokePath();
  }

  private hideCursor(): void {
    if (this.cursorSprite) {
      this.scene.tweens.killTweensOf(this.cursorSprite);
      this.cursorSprite.destroy();
      this.cursorSprite = null;
    }
  }

  // ── 提示文字 ──

  private hintText: Phaser.GameObjects.Text | null = null;

  private showHintText(text: string): void {
    this.hideHintText();
    this.hintText = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 130, text, {
      fontSize: '12px',
      color: '#fbbf24',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(9500).setScrollFactor(0);
    this.container?.add(this.hintText);
  }

  private hideHintText(): void {
    if (this.hintText) {
      this.hintText.destroy();
      this.hintText = null;
    }
  }

  // ── 范围覆盖渲染 ──

  private showMoveRange(cells: { x: number; y: number }[]): void {
    this.clearMoveRange();
    this.moveRangeOverlay = this.scene.add.graphics();
    this.moveRangeOverlay.setDepth(8000);
    this.moveRangeOverlay.setScrollFactor(0);

    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;

    for (const c of cells) {
      const s = this.arenaToScreen(c.x, c.y);
      this.moveRangeOverlay.fillStyle(0x3b82f6, 0.25);
      this.moveRangeOverlay.beginPath();
      this.moveRangeOverlay.moveTo(s.x, s.y - hh);
      this.moveRangeOverlay.lineTo(s.x + hw, s.y);
      this.moveRangeOverlay.lineTo(s.x, s.y + hh);
      this.moveRangeOverlay.lineTo(s.x - hw, s.y);
      this.moveRangeOverlay.closePath();
      this.moveRangeOverlay.fillPath();
    }

    this.container?.add(this.moveRangeOverlay);
  }

  private showAttackRange(cells: { x: number; y: number }[]): void {
    this.clearAttackRange();
    this.attackRangeOverlay = this.scene.add.graphics();
    this.attackRangeOverlay.setDepth(8000);
    this.attackRangeOverlay.setScrollFactor(0);

    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;

    for (const c of cells) {
      const s = this.arenaToScreen(c.x, c.y);
      this.attackRangeOverlay.fillStyle(0xef4444, 0.25);
      this.attackRangeOverlay.beginPath();
      this.attackRangeOverlay.moveTo(s.x, s.y - hh);
      this.attackRangeOverlay.lineTo(s.x + hw, s.y);
      this.attackRangeOverlay.lineTo(s.x, s.y + hh);
      this.attackRangeOverlay.lineTo(s.x - hw, s.y);
      this.attackRangeOverlay.closePath();
      this.attackRangeOverlay.fillPath();
    }

    this.container?.add(this.attackRangeOverlay);
  }

  private clearRangeOverlays(): void {
    this.clearMoveRange();
    this.clearAttackRange();
  }

  private clearMoveRange(): void {
    if (this.moveRangeOverlay) {
      this.moveRangeOverlay.destroy();
      this.moveRangeOverlay = null;
    }
  }

  private clearAttackRange(): void {
    if (this.attackRangeOverlay) {
      this.attackRangeOverlay.destroy();
      this.attackRangeOverlay = null;
    }
  }

  // ── 操作菜单 ──

  private showActionMenu(person: BattlePerson): void {
    this.hideActionMenu();
    const menuX = SCREEN_WIDTH - 150;
    const menuY = SCREEN_HEIGHT / 2 - 100;
    const itemH = 26;
    const menuW = 130;
    const menuH = this.MENU_ITEMS.length * itemH + 16;

    this.menuContainer = this.scene.add.container(menuX, menuY);
    this.menuContainer.setDepth(9500);
    this.menuContainer.setScrollFactor(0);

    // 背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRoundedRect(0, 0, menuW, menuH, 6);
    bg.lineStyle(1, 0xfbbf24, 0.6);
    bg.strokeRoundedRect(0, 0, menuW, menuH, 6);
    this.menuContainer.add(bg);

    // 高亮条
    this.menuHighlight = this.scene.add.graphics();
    this.menuHighlight.fillStyle(0xfbbf24, 0.25);
    this.menuHighlight.fillRoundedRect(4, 8 + this.menuCursorIndex * itemH, menuW - 8, itemH - 4, 3);
    this.menuContainer.add(this.menuHighlight);

    // 菜单项
    this.menuTexts = [];
    for (let i = 0; i < this.MENU_ITEMS.length; i++) {
      const isSelected = i === this.menuCursorIndex;
      const t = this.scene.add.text(menuW / 2, 14 + i * itemH, this.MENU_ITEMS[i], {
        fontSize: '13px',
        color: isSelected ? '#fbbf24' : '#cccccc',
        fontStyle: isSelected ? 'bold' : 'normal',
      }).setOrigin(0.5, 0);
      this.menuContainer.add(t);
      this.menuTexts.push(t);
    }

    this.container?.add(this.menuContainer);
  }

  private updateMenuHighlight(): void {
    if (!this.menuHighlight) return;
    const itemH = 26;
    const menuW = 130;
    this.menuHighlight.clear();
    this.menuHighlight.fillStyle(0xfbbf24, 0.25);
    this.menuHighlight.fillRoundedRect(4, 8 + this.menuCursorIndex * itemH, menuW - 8, itemH - 4, 3);

    for (let i = 0; i < this.menuTexts.length; i++) {
      const isSelected = i === this.menuCursorIndex;
      this.menuTexts[i].setColor(isSelected ? '#fbbf24' : '#cccccc');
      this.menuTexts[i].setStyle({ fontStyle: isSelected ? 'bold' : 'normal' });
    }
  }

  private hideActionMenu(): void {
    if (this.menuContainer) {
      this.menuContainer.destroy(true);
      this.menuContainer = null;
    }
    this.menuHighlight = null;
    this.menuTexts = [];
  }

  // ── 武功子菜单 ──

  private renderWugongMenu(person: BattlePerson): void {
    this.hideWugongMenu();
    const menuX = SCREEN_WIDTH - 290;
    const menuY = SCREEN_HEIGHT / 2 - 60;
    const itemH = 26;
    const menuW = 130;
    const menuH = this.availableSkills.length * itemH + 16;

    this.wugongContainer = this.scene.add.container(menuX, menuY);
    this.wugongContainer.setDepth(9600);
    this.wugongContainer.setScrollFactor(0);

    // 背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRoundedRect(0, 0, menuW, menuH, 6);
    bg.lineStyle(1, 0x44ffaa, 0.6);
    bg.strokeRoundedRect(0, 0, menuW, menuH, 6);
    this.wugongContainer.add(bg);

    // 武功项
    for (let i = 0; i < this.availableSkills.length; i++) {
      const skill = this.availableSkills[i];
      const hasMp = person.mp >= skill.mpCost;
      const isSelected = i === this.wugongCursorIndex;
      const label = skill.mpCost > 0 ? `${skill.name} (${skill.mpCost}MP)` : skill.name;

      const t = this.scene.add.text(menuW / 2, 14 + i * itemH, label, {
        fontSize: '12px',
        color: !hasMp ? '#666666' : isSelected ? '#44ffaa' : '#cccccc',
        fontStyle: isSelected ? 'bold' : 'normal',
      }).setOrigin(0.5, 0);
      this.wugongContainer.add(t);
    }

    this.container?.add(this.wugongContainer);
  }

  private updateWugongHighlight(): void {
    // 简化：重新渲染
    if (this.currentManualPerson) {
      this.renderWugongMenu(this.currentManualPerson);
    }
  }

  private hideWugongMenu(): void {
    if (this.wugongContainer) {
      this.wugongContainer.destroy(true);
      this.wugongContainer = null;
    }
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

    // 先面朝移动方向
    this.faceToward(person, target);

    person.pos = { ...target };
    const screenPos = this.arenaToScreen(target.x, target.y);

    // 切换到 chars 走路帧 + 匹配缩放
    sprite.setScale(this.walkSpriteScale);
    const walkTimer = this.cycleWalkFrames(person);

    this.scene.tweens.add({
      targets: sprite,
      x: screenPos.x,
      y: screenPos.y,
      duration: BATTLE_ANIM_SPEED,
      ease: 'Linear',
      onComplete: () => {
        if (walkTimer) walkTimer.remove();
        // 恢复 fight 精灵 + 原始缩放
        sprite.setScale(this.spriteScale);
        this.resetSpriteFrame(person);
        this.faceToward(person, this.getEnemy(person)?.pos ?? person.pos);
        done();
      },
    });
  }

  /** 移动时用 chars atlas 走路帧播放行走动画 */
  private cycleWalkFrames(person: BattlePerson): Phaser.Time.TimerEvent | null {
    const sprite = this.sprites.get(person.id);
    if (!sprite) return null;
    const d = DIR_CHARS_D[person.facing] ?? 0;
    let step = 0;
    const timer = this.scene.time.addEvent({
      delay: WALK_FRAME_INTERVAL,
      repeat: -1,
      callback: () => {
        const f = step % WALK_FRAME_COUNT;
        const frameKey = `player_d${d}_f${f}`;
        const frame = this.scene.textures.getFrame('chars', frameKey);
        if (frame) {
          sprite.setTexture('chars', frameKey);
        }
        step++;
      },
    });
    // 立即显示第一帧走路（f1 而非 f0 站立）
    const firstKey = `player_d${d}_f1`;
    if (this.scene.textures.getFrame('chars', firstKey)) {
      sprite.setTexture('chars', firstKey);
    }
    return timer;
  }

  /** 用 JYQXZ fight 精灵帧播放攻击动画 */
  private cycleAttackFrames(person: BattlePerson): void {
    const sprite = this.sprites.get(person.id);
    if (!sprite) return;
    const dirOffset = DIR_TO_FIGHT_OFFSET[person.facing] ?? 0;
    let step = 0;
    const timer = this.scene.time.addEvent({
      delay: FIGHT_FRAME_INTERVAL,
      repeat: FIGHT_FRAMES_PER_DIR - 1,
      callback: () => {
        const frameIdx = dirOffset + step;
        const key = fightKey(frameIdx);
        const tex = this.scene.textures.exists(key);
        if (tex) sprite.setTexture(key);
        step++;
      },
    });
    this.scene.time.delayedCall(FIGHT_FRAMES_PER_DIR * FIGHT_FRAME_INTERVAL + 50, () => timer.remove());
  }

  /** 恢复角色精灵到站立帧（fight sprite 第 0 帧） */
  private resetSpriteFrame(person: BattlePerson): void {
    const sprite = this.sprites.get(person.id);
    if (!sprite) return;
    const dirOffset = DIR_TO_FIGHT_OFFSET[person.facing] ?? 0;
    const key = fightKey(dirOffset);
    if (this.scene.textures.exists(key)) sprite.setTexture(key);
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

    const attackerScreen = this.arenaToScreen(attacker.pos.x, attacker.pos.y);
    const targetScreen = this.arenaToScreen(target.pos.x, target.pos.y);

    // 面朝目标
    this.faceToward(attacker, target.pos);

    const isSpecial = skill.id !== 'normal_attack';
    const isAoe = (skill.aoeSize ?? 1) >= 3;

    // ===== 阶段 1: 武功名显示 (350ms) =====
    if (isSpecial) {
      this.showKungfuName(skill.name, skill.type);
    }
    const nameDelay = isSpecial ? 400 : 100;

    // ===== 阶段 2: 蓄力 + 帧动画（原地发招） =====
    this.scene.time.delayedCall(nameDelay, () => {
      // 启动 fight 精灵帧动画
      this.cycleAttackFrames(attacker);

      if (attackerSprite) {
        const s = this.spriteScale;
        // 蓄力微蹲
        this.scene.tweens.add({
          targets: attackerSprite,
          scaleX: s * 0.85,
          scaleY: s * 0.9,
          duration: 120,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // 原地弹出（不冲过去）
            this.scene.tweens.add({
              targets: attackerSprite,
              scaleX: s * 1.15,
              scaleY: s * 1.15,
              duration: 150,
              ease: 'Back.easeOut',
              onComplete: () => {
                // ===== 阶段 3: 武功特效 =====
                if (isAoe) {
                  this.playAoeEffect(target.pos.x, target.pos.y, skill.effectId, 3);
                } else {
                  this.playEftSprite(targetScreen.x, targetScreen.y, skill.effectId);
                }

                // ===== 阶段 4: 命中反馈 =====
                this.scene.time.delayedCall(250, () => {
                  // 恢复初始缩放
                  this.scene.tweens.add({
                    targets: attackerSprite,
                    scaleX: this.spriteScale,
                    scaleY: this.spriteScale,
                    duration: 200,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                      this.resetSpriteFrame(attacker);
                    },
                  });

                  if (hit && damage > 0) {
                    target.hp = Math.max(0, target.hp - damage);
                    this.updateHPBar(target);

                    this.playHitFlash(targetScreen.x, targetScreen.y);

                    if (targetSprite) {
                      targetSprite.setTint(0xff4444);
                      this.scene.tweens.add({
                        targets: targetSprite,
                        x: targetScreen.x - 4,
                        duration: 40,
                        yoyo: true,
                        repeat: 3,
                        onComplete: () => {
                          targetSprite.clearTint();
                          this.scene.tweens.add({
                            targets: targetSprite,
                            x: targetScreen.x,
                            duration: 50,
                          });
                        },
                      });
                    }

                    this.scene.time.delayedCall(80, () => {
                      this.showDamageNumber(targetScreen.x, targetScreen.y - 45, damage, damage > 80);
                    });

                    if (target.hp <= 0) {
                      target.alive = false;
                      this.scene.time.delayedCall(500, () => this.playDeathEffect(target));
                    }
                  } else {
                    this.showDamageNumber(targetScreen.x, targetScreen.y - 45, 0, false);
                  }

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

                  this.scene.time.delayedCall(hit ? 700 : 300, done);
                });
              },
            });
          },
        });
      } else {
        this.playEftSprite(targetScreen.x, targetScreen.y, skill.effectId);
        this.scene.time.delayedCall(500, done);
      }
    });
  }

  /** 3x3 范围特效：在以 (cx, cy) 为中心的 aoeSize×aoeSize 格上播放特效 */
  private playAoeEffect(centerX: number, centerY: number, effectId: string, size: number): void {
    const half = Math.floor(size / 2);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        if (tx < 0 || tx >= ARENA_SIZE || ty < 0 || ty >= ARENA_SIZE) continue;
        const screen = this.arenaToScreen(tx, ty);
        // 给每个格子加一点随机延迟，形成波浪扩散感
        const dist = Math.abs(dx) + Math.abs(dy);
        const delay = dist * 40;
        this.scene.time.delayedCall(delay, () => {
          this.playEftSprite(screen.x, screen.y, effectId);
        });
      }
    }
  }

  // ============================================================
  // 战斗特效 — 武功名放大显示
  // ============================================================

  private showKungfuName(name: string, type: WugongType): void {
    const colors: Record<number, string> = {
      [WugongType.Fist]: '#ff8844',
      [WugongType.Sword]: '#44aaff',
      [WugongType.Blade]: '#ff4466',
      [WugongType.Special]: '#aa66ff',
      [WugongType.Neigong]: '#44ffaa',
    };
    const color = colors[type] ?? '#fbbf24';

    const txt = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 80, name, {
      fontSize: '10px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9998).setScrollFactor(0).setAlpha(0);
    this.container!.add(txt);

    // 放大 + 淡入效果
    this.scene.tweens.add({
      targets: txt,
      alpha: 1,
      fontSize: '28px',
      duration: 250,
      ease: 'Back.easeOut',
      hold: 100,
      onComplete: () => {
        // 缩小淡出
        this.scene.tweens.add({
          targets: txt,
          alpha: 0,
          y: txt.y - 15,
          duration: 150,
          onComplete: () => txt.destroy(),
        });
      },
    });
  }

  // ============================================================
  // 战斗特效 — JYQXZ 原版武功特效贴图播放
  // ============================================================

  /** 播放 JYQXZ eft 特效贴图序列 */
  private playEftSprite(cx: number, cy: number, effectId: string): void {
    const frameCount = EFT_FRAME_COUNTS[effectId];
    if (!frameCount) return;

    // 创建特效精灵，从第一帧开始
    const firstKey = `eft_${effectId}_0000`;
    if (!this.scene.textures.exists(firstKey)) return;

    const sprite = this.scene.add.image(cx, cy - 20, firstKey);
    sprite.setScale(1.5);
    sprite.setOrigin(0.5, 0.7);
    sprite.setDepth(9998);
    sprite.setScrollFactor(0);
    this.container!.add(sprite);

    let step = 0;
    const timer = this.scene.time.addEvent({
      delay: 60,
      repeat: frameCount - 1,
      callback: () => {
        step++;
        const key = `eft_${effectId}_${String(step).padStart(4, '0')}`;
        if (this.scene.textures.exists(key)) {
          sprite.setTexture(key);
        }
      },
    });

    // 播完后淡出销毁
    const totalTime = frameCount * 60 + 100;
    this.scene.time.delayedCall(totalTime, () => {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 120,
        onComplete: () => sprite.destroy(),
      });
      timer.remove();
    });
  }

  // ============================================================
  // 战斗特效 — 命中闪光
  // ============================================================

  private playHitFlash(cx: number, cy: number): void {
    const flash = this.scene.add.graphics();
    flash.setDepth(9997);
    flash.setScrollFactor(0);
    this.container!.add(flash);

    flash.fillStyle(0xffffff, 0.5);
    flash.fillCircle(cx, cy, 20);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  // ============================================================
  // 战斗特效 — 屏幕震动
  // ============================================================

  private shakeScreen(): void {
    if (!this.container) return;
    const origX = this.container.x;
    const origY = this.container.y;

    // 快速左右抖动
    const offsets = [-3, 3, -2, 2, -1, 1, 0];
    let i = 0;
    const timer = this.scene.time.addEvent({
      delay: 30,
      repeat: offsets.length - 1,
      callback: () => {
        if (this.container) {
          this.container.x = origX + (offsets[i] ?? 0);
        }
        i++;
      },
    });
    this.scene.time.delayedCall(offsets.length * 30 + 50, () => {
      if (this.container) this.container.x = origX;
      timer.remove();
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
    // 更新精灵朝向（fight sprite 站立帧）
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      const dirOffset = DIR_TO_FIGHT_OFFSET[person.facing] ?? 0;
      const key = fightKey(dirOffset);
      if (this.scene.textures.exists(key)) sprite.setTexture(key);
    }
  }

  /** 竞技场地图坐标 → 屏幕坐标（使用战场专用缩放） */
  private arenaToScreen(x: number, y: number): { x: number; y: number } {
    const cx = (ARENA_SIZE - 1) / 2;
    const cy = (ARENA_SIZE - 1) / 2;
    const dx = x - cx;
    const dy = y - cy;
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;
    return {
      x: hw * (dx - dy) + SCREEN_WIDTH / 2,
      y: hh * (dx + dy) + SCREEN_HEIGHT / 2,
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
        this.drawDiamond(grid, screen.x, screen.y, TILE_HALF_W * BATTLE_TILE_SCALE, TILE_HALF_H * BATTLE_TILE_SCALE, 0x2a2e3a, 0x3a3e4a);
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

      // 使用 JYQXZ fight 精灵
      const dirOffset = DIR_TO_FIGHT_OFFSET[person.facing] ?? 0;
      const key = fightKey(dirOffset);
      let sprite: Phaser.GameObjects.Image;
      const hasFight = this.scene.textures.exists(key);

      if (hasFight) {
        sprite = this.scene.add.image(screen.x, screen.y, key);
        sprite.setScale(this.spriteScale);
        sprite.setOrigin(0.5, 0.85);
      } else {
        // 回退：用 chars atlas 的站立帧
        const frameKey = `player_d${person.facing}_f0`;
        const frame = this.scene.textures.getFrame('chars', frameKey);
        if (frame) {
          sprite = this.scene.add.image(screen.x, screen.y, 'chars', frameKey);
          sprite.setScale(0.7);
          sprite.setOrigin(0.5, 0.85);
        } else {
          // 最终回退：彩色圆
          sprite = this.scene.add.image(screen.x, screen.y, '__DEFAULT');
          const g = this.scene.add.graphics();
          g.setScrollFactor(0);
          g.fillStyle(tint, 0.9);
          g.fillCircle(screen.x, screen.y, 12);
          g.fillStyle(0xffffff, 0.8);
          g.fillCircle(screen.x, screen.y - 4, 5);
          this.container!.add(g);
          sprite.setVisible(false);
          sprite.setOrigin(0.5, 0.85);
        }
      }

      sprite.setDepth(screen.y + 100);
      sprite.setScrollFactor(0);
      this.container!.add(sprite);
      this.sprites.set(person.id, sprite);

      // 队伍颜色标记（半透明底色圆）
      const marker = this.scene.add.circle(screen.x, screen.y + 5, 14, tint, 0.2);
      marker.setDepth(screen.y + 99);
      marker.setScrollFactor(0);
      this.container!.add(marker);

      // 名字标签
      const nameColor = person.team === 'red' ? '#ff6666' : '#6699ff';
      const label = this.scene.add.text(screen.x, screen.y + 12, person.name, {
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

    // 模式提示
    const hint = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 15, '按 Tab 切换手动/自动模式', {
      fontSize: '11px',
      color: '#666666',
    }).setOrigin(0.5, 0.5);
    hint.setScrollFactor(0);
    this.container!.add(hint);
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

  private showDamageNumber(x: number, y: number, damage: number, isCrit: boolean): void {
    const text = damage > 0 ? (isCrit ? `${damage} !!` : `-${damage}`) : 'MISS';
    const color = isCrit ? '#fbbf24' : damage > 0 ? '#ff4444' : '#888888';
    const fontSize = isCrit ? '24px' : damage > 0 ? '18px' : '16px';

    const txt = this.scene.add.text(x, y, text, {
      fontSize,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isCrit ? 5 : 3,
    }).setOrigin(0.5, 0.5);
    txt.setScrollFactor(0);
    txt.setDepth(9998);
    this.container!.add(txt);

    // 先弹起再上飘淡出
    this.scene.tweens.add({
      targets: txt,
      y: y - 15,
      scaleX: isCrit ? 1.3 : 1,
      scaleY: isCrit ? 1.3 : 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: txt,
          y: y - 45,
          alpha: 0,
          scaleX: isCrit ? 0.8 : 0.9,
          scaleY: isCrit ? 0.8 : 0.9,
          duration: 600,
          ease: 'Power2',
          onComplete: () => txt.destroy(),
        });
      },
    });
  }

  private playDeathEffect(person: BattlePerson): void {
    const sprite = this.sprites.get(person.id);
    const pos = this.arenaToScreen(person.pos.x, person.pos.y);

    // 死亡粒子爆发
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI * 2 * i / 10;
      const color = person.team === 'red' ? 0xff6666 : 0x6699ff;
      const p = this.scene.add.circle(pos.x, pos.y, 3 + Math.random() * 2, color, 0.8);
      p.setDepth(9998);
      p.setScrollFactor(0);
      this.container!.add(p);
      this.scene.tweens.add({
        targets: p,
        x: pos.x + Math.cos(angle) * (20 + Math.random() * 25),
        y: pos.y + Math.sin(angle) * (20 + Math.random() * 25),
        alpha: 0,
        duration: 500 + Math.random() * 200,
        onComplete: () => p.destroy(),
      });
    }

    // 精灵缩小消失
    if (sprite) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        y: sprite.y - 20,
        duration: 600,
        ease: 'Power2',
      });
    }
    const label = this.nameLabels.get(person.id);
    if (label) {
      this.scene.tweens.add({
        targets: label,
        alpha: 0,
        duration: 400,
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
    this.exitManualMode();
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
