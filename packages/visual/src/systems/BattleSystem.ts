// ============================================================
// BattleSystem.ts — 战斗引擎（回合循环 + 伤害计算 + AI + 渲染）
// ============================================================

import {
  type BattlePerson,
  type BattleAction,
  type BattleResult,
  type WugongDef,
  Direction,
  ManualPhase,
} from '../types';
import {
  ARENA_SIZE,
  BATTLE_ANIM_SPEED,
  BATTLE_TURN_DELAY,
  BATTLE_LOG_MAX,
  BATTLE_TILE_SCALE,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  TILE_HALF_W,
  TILE_HALF_H,
} from '../config';
import { createBattlePerson, createPlayerBattlePerson, NORMAL_ATTACK, EFT_FRAME_COUNTS } from '../data/BattleData';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { BattleAnimator } from './BattleAnimator';
import { getBattleSkillVisual, type BattleSkillVisualDef } from '../content/BattleSkillVisuals';

// ── 战斗状态 ──

type Phase = 'idle' | 'running' | 'animating' | 'ended' | 'manual';

/** 手动控制键盘输入类型 */
type BattleInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

const BATTLE_STATUS_PANEL_W = 360;
const BATTLE_STATUS_PANEL_H = 86;
const BATTLE_HUD_MARGIN = 16;
const BATTLE_COMMAND_COLS = 2;
const BATTLE_COMMAND_ITEM_H = 36;
const BATTLE_MOVE_STEP_DURATION = 260;

export class BattleSystem {
  private scene: Phaser.Scene;
  private eventBus: EventBus;
  private store: GameStore;
  private animator: BattleAnimator;

  // 战斗数据
  private persons: BattlePerson[] = [];
  private round = 0;
  private phase: Phase = 'idle';
  private turnQueue: BattlePerson[] = [];

  // 渲染对象
  private container: Phaser.GameObjects.Container | null = null;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private hpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private mpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private hpValueLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private mpValueLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private groundMarks: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private activeRing: Phaser.GameObjects.Graphics | null = null;
  private activeRingPersonId: string | null = null;
  private targetRing: Phaser.GameObjects.Graphics | null = null;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private roundLabel: Phaser.GameObjects.Text | null = null;
  private endOverlay: Phaser.GameObjects.Container | null = null;

  // ── 手动控制 ──
  private isAutoMode = true;
  private controlledPersonId: string | null = null;
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

  constructor(scene: Phaser.Scene, eventBus: EventBus, store: GameStore) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.store = store;
    this.animator = new BattleAnimator(scene, 'fight000');
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

    const red = createBattlePerson(redId, 'red', { x: 5, y: 8 });
    const blue = createBattlePerson(blueId, 'blue', { x: 3, y: 1 });
    this.startWithPersons(red, blue, null, true);
  }

  /** 玩家挑战大地图 Agent */
  startPlayerVsAgent(agentId: string, agentName: string): void {
    if (this.phase !== 'idle') return;

    const player = createPlayerBattlePerson(this.store.playerProgress, 'red', { x: 5, y: 8 });
    const enemy = createBattlePerson(agentId, 'blue', { x: 3, y: 1 }, agentName);
    this.startWithPersons(player, enemy, 'player', false);
  }

  private startWithPersons(
    red: BattlePerson,
    blue: BattlePerson,
    controlledPersonId: string | null,
    autoMode: boolean,
  ): void {
    this.persons = [red, blue];
    this.faceToward(red, blue.pos);
    this.faceToward(blue, red.pos);
    this.round = 0;
    this.phase = 'running';
    this.isAutoMode = autoMode;
    this.controlledPersonId = controlledPersonId;
    this.turnQueue = [];

    this.initBattleKeys();
    this.renderArena();
    this.renderPersons();
    this.renderHUD();

    this.eventBus.emit('battle:start', { redId: red.id, blueId: blue.id });

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
    this.showActiveRing(person);
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
    this.hideActiveRing();
    this.hideTargetRing();
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
    if (this.isControlledPerson(person) && !this.isAutoMode) {
      this.enterManualMode(person);
    } else {
      this.executePersonTurn(person);
    }
  }

  private executePersonTurn(person: BattlePerson): void {
    const action = this.aiDecide(person);
    this.phase = 'animating';
    this.showActiveRing(person);

    this.executeAction(person, action, () => {
      // 动画完成后检查胜负
      const result = this.checkEnd();
      if (result) {
        this.endBattle(result);
        return;
      }

      this.phase = 'running';
      this.hideActiveRing();
      this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
    });
  }

  // ============================================================
  // 手动控制 — 菜单输入处理
  // ============================================================

  private handleMenuInput(input: BattleInput): void {
    const items = this.MENU_ITEMS.length;
    if (input === 'left') {
      this.menuCursorIndex = (this.menuCursorIndex - 1 + items) % items;
      this.updateMenuHighlight();
    } else if (input === 'right') {
      this.menuCursorIndex = (this.menuCursorIndex + 1) % items;
      this.updateMenuHighlight();
    } else if (input === 'up') {
      this.menuCursorIndex = (this.menuCursorIndex - BATTLE_COMMAND_COLS + items) % items;
      this.updateMenuHighlight();
    } else if (input === 'down') {
      this.menuCursorIndex = (this.menuCursorIndex + BATTLE_COMMAND_COLS) % items;
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
    if (input === 'up' || input === 'left') {
      this.wugongCursorIndex = (this.wugongCursorIndex - 1 + count) % count;
      this.updateWugongHighlight();
    } else if (input === 'down' || input === 'right') {
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
      this.hideTargetRing();
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
    this.availableSkills = this.uniqueSkills([person.wugong, NORMAL_ATTACK]);
    this.wugongCursorIndex = 0;
    this.renderWugongMenu(person);
    this.manualPhase = ManualPhase.WugongSelect;
  }

  private enterTargetSelect(): void {
    const person = this.currentManualPerson!;
    const skill = this.selectedSkill!;
    const visual = this.getSkillVisual(person, skill);
    this.hideWugongMenu();
    const attackRangeCells = this.calcAttackRange(person.pos, skill.attackRange);
    this.showAttackRange(attackRangeCells);
    // 光标初始定位到敌人位置（方便瞄准）
    const enemy = this.getEnemy(person);
    this.cursorGridPos = enemy && attackRangeCells.some(c => c.x === enemy.pos.x && c.y === enemy.pos.y)
      ? { ...enemy.pos }
      : { ...attackRangeCells[0] ?? person.pos };
    this.showCursor(this.cursorGridPos.x, this.cursorGridPos.y);
    this.showTargetRing(this.cursorGridPos.x, this.cursorGridPos.y);
    const aoe = this.getSkillAreaSize(skill, visual);
    this.showHintText(`[${skill.name}] 攻击距离 ${skill.attackRange}，选择红色范围内目标，Space释放${aoe > 1 ? `(${aoe}x${aoe}范围)` : ''}`);
    this.manualPhase = ManualPhase.TargetSelect;
  }

  /** 以光标为中心释放技能 */
  private executeManualAttack(): void {
    const person = this.currentManualPerson!;
    const skill = this.selectedSkill!;
    const visual = this.getSkillVisual(person, skill);
    const skillLabel = this.getSkillBattleLabel(person, skill);
    const centerX = this.cursorGridPos.x;
    const centerY = this.cursorGridPos.y;

    if (!this.isInAttackRange(person.pos, { x: centerX, y: centerY }, skill.attackRange)) {
      this.addLog(`${skill.name} 攻击距离不足，无法打到 (${centerX},${centerY})`);
      this.showHintText(`[${skill.name}] 只能攻击红色范围内的格子`);
      return;
    }

    this.clearRangeOverlays();
    this.hideCursor();
    this.hideTargetRing();
    this.hideActionMenu();
    this.hideHintText();
    this.manualPhase = ManualPhase.ActionMenu;
    this.phase = 'animating';

    // 消耗 MP
    person.mp = Math.max(0, person.mp - skill.mpCost);
    this.updateHPBar(person);

    const aoeSize = this.getSkillAreaSize(skill, visual);
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
    if (visual.showCastText) {
      this.showKungfuName(visual.castText, visual.castTextColor);
    }
    const nameDelay = visual.showCastText ? 400 : 100;

    this.scene.time.delayedCall(nameDelay, () => {
      // 播放攻击帧
      const attackerSprite = this.sprites.get(person.id);
      if (attackerSprite) this.animator.playAttack(attackerSprite, person);
      if (attackerSprite) {
        const s = this.animator.scale;
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
                if (visual.targetMode === 'aoe' && aoeSize >= 3) {
                  this.playAoeEffect(centerX, centerY, visual.effectId, aoeSize, visual.effectScale);
                } else {
                  this.playEftSprite(centerScreen.x, centerScreen.y, visual.effectId, visual.effectScale);
                }
                if (visual.cameraShake) this.shakeScreen();

                // ===== 处理伤害 =====
                this.scene.time.delayedCall(visual.impactDelayMs, () => {
                  // 恢复攻击者缩放
                  if (attackerSprite) {
                    this.scene.tweens.add({
                      targets: attackerSprite,
                      scaleX: this.animator.scale, scaleY: this.animator.scale,
                      duration: 200, ease: 'Quad.easeOut',
                      onComplete: () => this.resetSpriteFrame(person),
                    });
                  }

                  let hitAny = false;
                  if (targets.length > 0) {
                    for (const target of targets) {
                      const { damage, hit } = this.calcDamage(person, target, skill);
                      const targetScreen = this.arenaToScreen(target.pos.x, target.pos.y);
                      const targetSprite = this.sprites.get(target.id);

                      if (hit && damage > 0) {
                        hitAny = true;
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
                        this.addLog(`${person.name} [${skillLabel}] → ${target.name} ${damage}伤害！`);
                        if (visual.hitStopMs > 0) this.hitStop(visual.hitStopMs);
                        if (target.hp <= 0) {
                          target.alive = false;
                          this.scene.time.delayedCall(500, () => this.playDeathEffect(target));
                        }
                      } else {
                        this.showDamageNumber(targetScreen.x, targetScreen.y - 45, 0, false);
                        this.addLog(`${person.name} [${skillLabel}] → ${target.name} 未命中！`);
                      }
                    }
                  } else {
                    // 空挥：只显示技能效果
                    this.addLog(`${person.name} [${skillLabel}] → 空挥`);
                  }

                  this.recordBattleMartialUse(person, skill, hitAny);

                  this.eventBus.emit('battle:action', {
                    actorId: person.id, actorName: person.name,
                    action: skillLabel, damage: 0, targetHp: 0, hit: hitAny,
                  });

                  this.scene.time.delayedCall(700, () => {
                    const result = this.checkEnd();
                    if (result) { this.endBattle(result); return; }
                    this.exitManualMode();
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
        this.playEftSprite(centerScreen.x, centerScreen.y, visual.effectId, visual.effectScale);
        this.scene.time.delayedCall(500, () => {
          const result = this.checkEnd();
          if (result) { this.endBattle(result); return; }
          this.exitManualMode();
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
    this.updateTargetRingPosition();
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
    const area = this.getCommandAreaRect();
    this.hintText = this.scene.add.text(area.x + area.w / 2, area.y - 18, text, {
      fontSize: '12px',
      color: '#fbbf24',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: area.w + 80 },
    }).setOrigin(0.5, 0.5).setDepth(9700).setScrollFactor(0);
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
    const area = this.getCommandAreaRect();
    const menuW = area.w;
    const gap = 7;
    const itemW = (menuW - gap * (BATTLE_COMMAND_COLS + 1)) / BATTLE_COMMAND_COLS;

    this.menuContainer = this.scene.add.container(area.x, area.y);
    this.menuContainer.setDepth(9700);
    this.menuContainer.setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x070707, 0.72);
    bg.fillRoundedRect(0, 0, area.w, area.h, 12);
    bg.lineStyle(1, 0xd6a64d, 0.62);
    bg.strokeRoundedRect(0, 0, area.w, area.h, 12);
    bg.lineStyle(1, 0xfef3c7, 0.1);
    bg.strokeRoundedRect(6, 6, area.w - 12, area.h - 12, 8);
    this.menuContainer.add(bg);

    const title = this.scene.add.text(18, 12, `${person.name} 的回合`, {
      fontSize: '12px',
      color: '#b9a77f',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    this.menuContainer.add(title);

    const rule = this.scene.add.graphics();
    rule.lineStyle(1, 0xd6a64d, 0.28);
    rule.lineBetween(18, 38, menuW - 18, 38);
    this.menuContainer.add(rule);

    // 高亮块
    this.menuHighlight = this.scene.add.graphics();
    this.menuContainer.add(this.menuHighlight);

    // 菜单项
    this.menuTexts = [];
    for (let i = 0; i < this.MENU_ITEMS.length; i++) {
      const isSelected = i === this.menuCursorIndex;
      const col = i % BATTLE_COMMAND_COLS;
      const row = Math.floor(i / BATTLE_COMMAND_COLS);
      const x = gap + col * (itemW + gap);
      const y = 50 + row * (BATTLE_COMMAND_ITEM_H + gap);
      const itemBg = this.scene.add.graphics();
      itemBg.fillStyle(0xf3d59a, 0.08);
      itemBg.fillRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 9);
      itemBg.lineStyle(1, 0xd6a64d, 0.18);
      itemBg.strokeRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 9);
      this.menuContainer.add(itemBg);
      const t = this.scene.add.text(x + itemW / 2, y + BATTLE_COMMAND_ITEM_H / 2, this.MENU_ITEMS[i], {
        fontSize: '14px',
        color: isSelected ? '#f8d57a' : '#d7c9aa',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      }).setOrigin(0.5, 0.5);
      this.menuContainer.add(t);
      this.menuTexts.push(t);
    }
    this.updateMenuHighlight();

    this.container?.add(this.menuContainer);
  }

  private updateMenuHighlight(): void {
    if (!this.menuHighlight) return;
    const area = this.getCommandAreaRect();
    const gap = 7;
    const itemW = (area.w - gap * (BATTLE_COMMAND_COLS + 1)) / BATTLE_COMMAND_COLS;
    const col = this.menuCursorIndex % BATTLE_COMMAND_COLS;
    const row = Math.floor(this.menuCursorIndex / BATTLE_COMMAND_COLS);
    const x = gap + col * (itemW + gap);
    const y = 50 + row * (BATTLE_COMMAND_ITEM_H + gap);
    this.menuHighlight.clear();
    this.menuHighlight.fillStyle(0xd6a64d, 0.3);
    this.menuHighlight.fillRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 10);
    this.menuHighlight.lineStyle(1, 0xf8d57a, 0.8);
    this.menuHighlight.strokeRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 10);

    for (let i = 0; i < this.menuTexts.length; i++) {
      const isSelected = i === this.menuCursorIndex;
      this.menuTexts[i].setColor(isSelected ? '#fff1b8' : '#d7c9aa');
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
    const area = this.getCommandAreaRect();
    const menuW = area.w;
    const gap = 8;
    const cardH = 52;

    this.wugongContainer = this.scene.add.container(area.x, area.y);
    this.wugongContainer.setDepth(9700);
    this.wugongContainer.setScrollFactor(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x07131a, 0.72);
    bg.fillRoundedRect(0, 0, area.w, area.h, 12);
    bg.lineStyle(1, 0x44ffaa, 0.48);
    bg.strokeRoundedRect(0, 0, area.w, area.h, 12);
    bg.lineStyle(1, 0xfef3c7, 0.08);
    bg.strokeRoundedRect(6, 6, area.w - 12, area.h - 12, 8);
    this.wugongContainer.add(bg);

    const title = this.scene.add.text(18, 12, '选择武功', {
      fontSize: '12px',
      color: '#8fffd2',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    this.wugongContainer.add(title);

    const rule = this.scene.add.graphics();
    rule.lineStyle(1, 0x44ffaa, 0.25);
    rule.lineBetween(18, 38, menuW - 18, 38);
    this.wugongContainer.add(rule);

    // 武功项
    for (let i = 0; i < this.availableSkills.length; i++) {
      const skill = this.availableSkills[i];
      const hasMp = person.mp >= skill.mpCost;
      const isSelected = i === this.wugongCursorIndex;
      const y = 50 + i * (cardH + gap);
      const card = this.scene.add.graphics();
      card.fillStyle(isSelected ? 0x10453d : 0x0b1720, isSelected ? 0.76 : 0.42);
      card.fillRoundedRect(14, y, menuW - 28, cardH, 10);
      card.lineStyle(1, isSelected ? 0x44ffaa : 0x6b5b3a, isSelected ? 0.8 : 0.24);
      card.strokeRoundedRect(14, y, menuW - 28, cardH, 10);
      this.wugongContainer.add(card);

      const t = this.scene.add.text(28, y + 9, skill.name, {
        fontSize: '13px',
        color: !hasMp ? '#666666' : isSelected ? '#44ffaa' : '#cccccc',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      }).setOrigin(0, 0);
      this.wugongContainer.add(t);
      const detail = this.scene.add.text(28, y + 31, `内力 ${skill.mpCost} · 距离 ${skill.attackRange} · 威力 ${skill.power}`, {
        fontSize: '11px',
        color: hasMp ? '#b9a77f' : '#555555',
      }).setOrigin(0, 0);
      this.wugongContainer.add(detail);
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
    let bestScore = Infinity;
    for (const pos of reachable) {
      const d = this.manhattanDist(pos, enemy.pos);
      // 优先停在刚好能打到的位置；远程武功不要无脑贴脸。
      const inRange = d <= person.wugong.attackRange;
      const score = inRange
        ? Math.abs(d - person.wugong.attackRange) - 100
        : d;
      if (score < bestScore) {
        bestScore = score;
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

    const path = this.calcMovePath(person, target);
    if (path.length === 0) {
      done();
      return;
    }

    this.faceToward(person, path[0], false);
    let walkTimer: Phaser.Time.TimerEvent | null = null;
    let walkFacing = person.facing;
    const restartWalk = () => {
      walkTimer?.remove(false);
      walkTimer = this.animator.hasWalkTexture(person)
        ? this.animator.playWalk(sprite, person)
        : null;
      walkFacing = person.facing;
    };
    restartWalk();

    let idx = 0;
    const stepMove = () => {
      const next = path[idx];
      if (!next) {
        walkTimer?.remove(false);
        walkTimer = null;
        this.resetSpriteFrame(person);
        this.faceToward(person, this.getEnemy(person)?.pos ?? person.pos);
        this.updatePersonVisualPosition(person);
        done();
        return;
      }

      this.faceToward(person, next, false);
      if (person.facing !== walkFacing) restartWalk();
      person.pos = { ...next };
      const screenPos = this.arenaToScreen(next.x, next.y);

      this.scene.tweens.add({
        targets: sprite,
        x: screenPos.x,
        y: screenPos.y - 3,
        duration: BATTLE_MOVE_STEP_DURATION,
        ease: 'Linear',
        onUpdate: () => {
          this.updatePersonDepthAndGround(person);
          this.updateActiveRingPosition();
        },
        onComplete: () => {
          sprite.y = screenPos.y;
          this.updatePersonVisualPosition(person);
          idx++;
          stepMove();
        },
      });
    };

    stepMove();
  }

  /** 恢复角色精灵到战斗站立帧 */
  private resetSpriteFrame(person: BattlePerson): void {
    const sprite = this.sprites.get(person.id);
    if (!sprite) return;
    this.animator.resetToIdle(sprite, person);
  }

  private animateAttack(
    attacker: BattlePerson,
    target: BattlePerson,
    skill: WugongDef,
    done: () => void,
  ): void {
    const targetSprite = this.sprites.get(target.id);
    const attackerSprite = this.sprites.get(attacker.id);
    const visual = this.getSkillVisual(attacker, skill);
    const skillLabel = this.getSkillBattleLabel(attacker, skill);

    // 伤害计算
    const { damage, hit } = this.calcDamage(attacker, target, skill);
    // 消耗内力
    attacker.mp = Math.max(0, attacker.mp - skill.mpCost);
    this.updateHPBar(attacker);

    const attackerScreen = this.arenaToScreen(attacker.pos.x, attacker.pos.y);
    const targetScreen = this.arenaToScreen(target.pos.x, target.pos.y);

    // 面朝目标
    this.faceToward(attacker, target.pos);

    const areaSize = this.getSkillAreaSize(skill, visual);
    const isAoe = visual.targetMode === 'aoe' && areaSize >= 3;

    // ===== 阶段 1: 武功名显示 (350ms) =====
    if (visual.showCastText) {
      this.showKungfuName(visual.castText, visual.castTextColor);
    }
    const nameDelay = visual.showCastText ? 400 : 100;

    // ===== 阶段 2: 蓄力 + 帧动画（原地发招） =====
    this.scene.time.delayedCall(nameDelay, () => {
      // 启动战斗动作帧动画
      if (attackerSprite) this.animator.playAttack(attackerSprite, attacker);

      if (attackerSprite) {
        const s = this.animator.scale;
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
                  this.playAoeEffect(target.pos.x, target.pos.y, visual.effectId, areaSize, visual.effectScale);
                } else {
                  this.playEftSprite(targetScreen.x, targetScreen.y, visual.effectId, visual.effectScale);
                }
                if (visual.cameraShake) this.shakeScreen();

                // ===== 阶段 4: 命中反馈 =====
                this.scene.time.delayedCall(visual.impactDelayMs, () => {
                  // 恢复初始缩放
                  this.scene.tweens.add({
                    targets: attackerSprite,
                    scaleX: this.animator.scale,
                    scaleY: this.animator.scale,
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

                    if (visual.hitStopMs > 0) this.hitStop(visual.hitStopMs);
                    if (target.hp <= 0) {
                      target.alive = false;
                      this.scene.time.delayedCall(500, () => this.playDeathEffect(target));
                    }
                  } else {
                    this.showDamageNumber(targetScreen.x, targetScreen.y - 45, 0, false);
                  }

                  this.recordBattleMartialUse(attacker, skill, hit && damage > 0);

                  const actionText = hit
                    ? `${attacker.name} 使用 [${skillLabel}] → ${target.name} 受到 ${damage} 伤害！`
                    : `${attacker.name} 使用 [${skillLabel}] → 未命中！`;
                  this.addLog(actionText);

                  this.eventBus.emit('battle:action', {
                    actorId: attacker.id,
                    actorName: attacker.name,
                    action: skillLabel,
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
        this.playEftSprite(targetScreen.x, targetScreen.y, visual.effectId, visual.effectScale);
        this.scene.time.delayedCall(500, done);
      }
    });
  }

  /** 3x3 范围特效：在以 (cx, cy) 为中心的 aoeSize×aoeSize 格上播放特效 */
  private playAoeEffect(centerX: number, centerY: number, effectId: string, size: number, scale = 1.5): void {
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
          this.playEftSprite(screen.x, screen.y, effectId, scale);
        });
      }
    }
  }

  // ============================================================
  // 战斗特效 — 武功名放大显示
  // ============================================================

  private showKungfuName(name: string, color = '#fbbf24'): void {
    const txt = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 80, name, {
      fontSize: '10px',
      color,
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
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

  /** 播放 JYQXZ eft 特效贴图序列（使用 _info.json 逐帧偏移精确定位） */
  private playEftSprite(cx: number, cy: number, effectId: string, scale = 1.5): void {
    const frameCount = EFT_FRAME_COUNTS[effectId];
    if (!frameCount) return;

    const firstKey = `eft_${effectId}_0000`;
    if (!this.scene.textures.exists(firstKey)) return;

    // 读取逐帧偏移数据
    const info: Array<{ w: number; h: number; xoff: number; yoff: number }> | undefined
      = this.scene.cache.json.get(`eft_${effectId}_info`);

    const sprite = this.scene.add.image(cx, cy, firstKey);
    sprite.setScale(scale);
    sprite.setDepth(9998);
    sprite.setScrollFactor(0);

    // 用第一帧的 xoff/yoff 设置 origin（锚点对齐格子中心）
    if (info && info[0]) {
      const f = info[0];
      sprite.setOrigin(f.w > 0 ? f.xoff / f.w : 0.5, f.h > 0 ? f.yoff / f.h : 0.7);
    } else {
      sprite.setOrigin(0.5, 0.7);
    }

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
          // 每帧更新 origin（帧尺寸变化时保持锚点位置正确）
          if (info && info[step]) {
            const f = info[step];
            sprite.setOrigin(f.w > 0 ? f.xoff / f.w : 0.5, f.h > 0 ? f.yoff / f.h : 0.7);
          }
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

  private hitStop(durationMs: number): void {
    if (!this.container) return;
    this.scene.tweens.pauseAll();
    this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.resumeAll();
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
    const base = this.getEffectiveSkillPower(attacker, skill) * atk / (atk + def + 50);

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

    this.syncPlayerVitalsAfterBattle();
    this.addLog(`★ 战斗结束！${res.winnerName} 获胜！`);
    this.renderEndScreen(res);

    // 3 秒后清理战斗，再恢复大地图，避免结束面板和大地图同时显示。
    this.scene.time.delayedCall(3000, () => {
      this.cleanup();
      this.phase = 'idle';
      this.eventBus.emit('battle:end', res);
    });
  }

  private syncPlayerVitalsAfterBattle(): void {
    const player = this.persons.find(p => p.id === 'player');
    if (!player) return;
    const hp = player.hp <= 0 ? 1 : Math.ceil(player.hp);
    const mp = Math.ceil(player.mp);
    this.store.setPlayerVitals(hp, mp);
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

  private calcMovePath(person: BattlePerson, target: { x: number; y: number }): { x: number; y: number }[] {
    if (person.pos.x === target.x && person.pos.y === target.y) return [];

    const startKey = `${person.pos.x},${person.pos.y}`;
    const targetKey = `${target.x},${target.y}`;
    const visited = new Set<string>([startKey]);
    const prev = new Map<string, string>();
    const queue: { x: number; y: number }[] = [{ ...person.pos }];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (`${cur.x},${cur.y}` === targetKey) break;

      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || nx >= ARENA_SIZE || ny < 0 || ny >= ARENA_SIZE) continue;
        if (visited.has(key)) continue;
        const occupied = this.persons.some(p => p.id !== person.id && p.alive && p.pos.x === nx && p.pos.y === ny);
        if (occupied) continue;
        visited.add(key);
        prev.set(key, `${cur.x},${cur.y}`);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!visited.has(targetKey)) return [];
    const reversed: { x: number; y: number }[] = [];
    let curKey = targetKey;
    while (curKey !== startKey) {
      const [x, y] = curKey.split(',').map(Number);
      reversed.push({ x, y });
      const parent = prev.get(curKey);
      if (!parent) return [];
      curKey = parent;
    }
    return reversed.reverse();
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private getEnemy(person: BattlePerson): BattlePerson | undefined {
    const enemyTeam = person.team === 'red' ? 'blue' : 'red';
    return this.persons.find(p => p.team === enemyTeam && p.alive);
  }

  private isControlledPerson(person: BattlePerson): boolean {
    return !!this.controlledPersonId && person.id === this.controlledPersonId;
  }

  private uniqueSkills(skills: WugongDef[]): WugongDef[] {
    const seen = new Set<string>();
    return skills.filter((skill) => {
      if (seen.has(skill.id)) return false;
      seen.add(skill.id);
      return true;
    });
  }

  private getMartialIdForSkill(skill: WugongDef): string {
    if (skill.id === 'normal_attack') return 'basic_attack';
    return skill.id;
  }

  private getPlayerMartialLevel(skill: WugongDef): number {
    return this.store.getMartialProgress(this.getMartialIdForSkill(skill)).level;
  }

  private getSkillVisual(person: BattlePerson, skill: WugongDef): BattleSkillVisualDef {
    const level = person.id === 'player' ? this.getPlayerMartialLevel(skill) : 1;
    return getBattleSkillVisual(skill, level);
  }

  private getSkillBattleLabel(person: BattlePerson, skill: WugongDef): string {
    if (person.id !== 'player') return skill.name;
    const level = this.getPlayerMartialLevel(skill);
    return `${skill.name} Lv.${level}`;
  }

  private getEffectiveSkillPower(attacker: BattlePerson, skill: WugongDef): number {
    if (attacker.id !== 'player') return skill.power;
    const martialId = this.getMartialIdForSkill(skill);
    return Math.round(skill.power * this.store.getMartialPowerMultiplier(martialId));
  }

  private getSkillAreaSize(skill: WugongDef, visual: BattleSkillVisualDef): number {
    if (visual.targetMode === 'single') return 1;
    return Math.max(1, skill.aoeSize ?? 1);
  }

  private recordBattleMartialUse(person: BattlePerson, skill: WugongDef, hit: boolean): void {
    if (person.id !== 'player') return;
    const result = this.store.recordMartialUse(this.getMartialIdForSkill(skill), hit);
    if (result.leveledUp) {
      this.addLog(`★ ${skill.name} 升至 Lv.${result.level}！`);
    } else if (skill.id === 'normal_attack') {
      const progressText = result.requiredExp > 0
        ? `${result.exp}/${result.requiredExp}`
        : '已满级';
      this.addLog(`${skill.name} 熟练度 +${result.gainedExp} (${progressText})`);
    }
  }

  private manhattanDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private isInAttackRange(
    from: { x: number; y: number },
    target: { x: number; y: number },
    range: number,
  ): boolean {
    return this.manhattanDist(from, target) <= range;
  }

  private faceToward(person: BattlePerson, target: { x: number; y: number }, updateSprite = true): void {
    const dx = target.x - person.pos.x;
    const dy = target.y - person.pos.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      person.facing = dx > 0 ? Direction.Right : Direction.Left;
    } else {
      person.facing = dy > 0 ? Direction.Down : Direction.Up;
    }
    if (!updateSprite) return;
    // 更新精灵朝向（战斗动作层站立帧）
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      this.animator.resetToIdle(sprite, person);
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
    const center = this.getBoardCenter();
    return {
      x: hw * (dx - dy) + center.x,
      y: hh * (dx + dy) + center.y,
    };
  }

  private getBoardCenter(): { x: number; y: number } {
    return {
      x: Math.round(SCREEN_WIDTH / 2),
      y: Math.round(SCREEN_HEIGHT / 2 + 24),
    };
  }

  private getBattleInfoRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: SCREEN_WIDTH - 360 - BATTLE_HUD_MARGIN,
      y: 22,
      w: 360,
      h: 66,
    };
  }

  private getStatusPanelRect(person: BattlePerson): { x: number; y: number; w: number; h: number } {
    return {
      x: BATTLE_HUD_MARGIN,
      y: person.team === 'red' ? 24 : 122,
      w: BATTLE_STATUS_PANEL_W,
      h: BATTLE_STATUS_PANEL_H,
    };
  }

  private getLogPanelRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: BATTLE_HUD_MARGIN,
      y: SCREEN_HEIGHT - 174,
      w: 392,
      h: 154,
    };
  }

  private getCommandAreaRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: SCREEN_WIDTH - 346,
      y: SCREEN_HEIGHT - 198,
      w: 326,
      h: 178,
    };
  }

  // ============================================================
  // 渲染 — 战场
  // ============================================================

  private renderArena(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(5000);
    this.container.setScrollFactor(0);

    // 武侠战棋舞台：深色幕布 + 暖金边光，保留棋盘焦点。
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x070b12, 0.96);
    bg.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    bg.fillStyle(0x6b2f12, 0.12);
    bg.fillCircle(SCREEN_WIDTH * 0.18, SCREEN_HEIGHT * 0.18, 240);
    bg.fillStyle(0x0f766e, 0.1);
    bg.fillCircle(SCREEN_WIDTH * 0.78, SCREEN_HEIGHT * 0.78, 260);
    bg.lineStyle(2, 0x8a5a21, 0.35);
    bg.strokeRoundedRect(18, 18, SCREEN_WIDTH - 36, SCREEN_HEIGHT - 36, 18);
    bg.setScrollFactor(0);
    this.container.add(bg);

    // 用 smap 瓦片贴图渲染地板（与策略茶馆相同的 smap_588）
    const floorTexKey = 'smap_588';
    const hasFloor = this.scene.textures.exists(floorTexKey);

    if (hasFloor) {
      // 读取瓦片偏移数据
      const smapInfo = this.scene.cache.json.get('smap_info') as Array<{ idx: number; xoff: number; yoff: number }> | undefined;
      let ox = TILE_HALF_W;
      let oy = 17;
      if (Array.isArray(smapInfo)) {
        const entry = smapInfo.find(t => t.idx === 588);
        if (entry) { ox = entry.xoff; oy = entry.yoff; }
      }
      const scale = BATTLE_TILE_SCALE;

      for (let y = 0; y < ARENA_SIZE; y++) {
        for (let x = 0; x < ARENA_SIZE; x++) {
          const screen = this.arenaToScreen(x, y);
          const img = this.scene.add.image(
            screen.x - ox * scale,
            screen.y - oy * scale,
            floorTexKey,
          );
          img.setOrigin(0, 0);
          img.setScale(scale);
          img.setScrollFactor(0);
          this.container.add(img);
        }
      }
    }

    // 网格边框叠加层（半透明细线）
    const grid = this.scene.add.graphics();
    grid.setScrollFactor(0);

    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const screen = this.arenaToScreen(x, y);
        this.drawDiamond(grid, screen.x, screen.y, TILE_HALF_W * BATTLE_TILE_SCALE, TILE_HALF_H * BATTLE_TILE_SCALE, -1, 0x3a3e4a);
      }
    }
    this.container.add(grid);

    // 标题
    const boardCenter = this.getBoardCenter();
    const title = this.scene.add.text(boardCenter.x, 24, '江湖切磋', {
      fontSize: '22px',
      color: '#fef3c7',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      stroke: '#2b1608',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    title.setScrollFactor(0);
    this.container.add(title);
  }

  /** 画一个等距菱形（fillColor<0 时只画边框） */
  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    hw: number, hh: number,
    fillColor: number, lineColor: number,
  ): void {
    g.beginPath();
    g.moveTo(cx, cy - hh);     // 上
    g.lineTo(cx + hw, cy);     // 右
    g.lineTo(cx, cy + hh);     // 下
    g.lineTo(cx - hw, cy);     // 左
    g.closePath();
    if (fillColor >= 0) {
      g.fillStyle(fillColor, 0.6);
      g.fillPath();
    }
    g.lineStyle(1, lineColor, 0.4);
    g.strokePath();
  }

  // ============================================================
  // 渲染 — 角色
  // ============================================================

  private renderPersons(): void {
    for (const person of this.persons) {
      const screen = this.arenaToScreen(person.pos.x, person.pos.y);

      // 使用独立战斗动作层的站立帧
      const key = this.animator.getIdleTextureKey(person);
      let sprite: Phaser.GameObjects.Image;
      const hasFight = this.animator.hasIdleTexture(person);

      if (hasFight) {
        sprite = this.scene.add.image(screen.x, screen.y, key);
        sprite.setScale(this.animator.scale);
        sprite.setOrigin(this.animator.originX, this.animator.originY);
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
          g.fillStyle(person.team === 'red' ? 0xd97706 : 0x38bdf8, 0.9);
          g.fillCircle(screen.x, screen.y, 12);
          g.fillStyle(0xffffff, 0.8);
          g.fillCircle(screen.x, screen.y - 4, 5);
          this.container!.add(g);
          sprite.setVisible(false);
          sprite.setOrigin(0.5, 0.85);
        }
      }

      const shadow = this.scene.add.graphics();
      shadow.setPosition(screen.x, screen.y + 9);
      shadow.setScrollFactor(0);
      shadow.setDepth(screen.y + 88);
      shadow.fillStyle(0x000000, 0.34);
      shadow.fillEllipse(0, 0, 34, 12);
      this.container!.add(shadow);
      this.groundMarks.set(person.id, shadow);

      sprite.setDepth(screen.y + 100);
      sprite.setScrollFactor(0);
      this.container!.add(sprite);
      this.sprites.set(person.id, sprite);
    }
  }

  private updatePersonVisualPosition(person: BattlePerson): void {
    const screen = this.arenaToScreen(person.pos.x, person.pos.y);
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      sprite.setPosition(screen.x, screen.y);
    }
    this.updatePersonDepthAndGround(person);
    this.updateActiveRingPosition();
    this.updateTargetRingPosition();
  }

  private updatePersonDepthAndGround(person: BattlePerson): void {
    const screen = this.arenaToScreen(person.pos.x, person.pos.y);
    const sprite = this.sprites.get(person.id);
    const shadow = this.groundMarks.get(person.id);
    if (sprite) sprite.setDepth(screen.y + 100);
    if (shadow) {
      shadow.setPosition(screen.x, screen.y + 9);
      shadow.setDepth(screen.y + 88);
    }
  }

  private showActiveRing(person: BattlePerson): void {
    this.hideActiveRing();
    const screen = this.arenaToScreen(person.pos.x, person.pos.y);
    const ring = this.scene.add.graphics();
    ring.setScrollFactor(0);
    ring.setDepth(screen.y + 89);
    ring.setPosition(screen.x, screen.y + 9);
    ring.lineStyle(2, 0xfbbf24, 0.95);
    ring.strokeEllipse(0, 0, 46, 18);
    ring.lineStyle(1, 0xfef3c7, 0.45);
    ring.strokeEllipse(0, 0, 58, 24);
    this.container!.add(ring);
    this.activeRing = ring;
    this.activeRingPersonId = person.id;
  }

  private hideActiveRing(): void {
    if (this.activeRing) {
      this.activeRing.destroy();
      this.activeRing = null;
    }
    this.activeRingPersonId = null;
  }

  private updateActiveRingPosition(): void {
    if (!this.activeRing || !this.activeRingPersonId) return;
    const person = this.persons.find(p => p.id === this.activeRingPersonId);
    if (!person) return;
    const screen = this.arenaToScreen(person.pos.x, person.pos.y);
    this.activeRing.setPosition(screen.x, screen.y + 9);
    this.activeRing.setDepth(screen.y + 89);
  }

  private showTargetRing(gx: number, gy: number): void {
    this.hideTargetRing();
    const screen = this.arenaToScreen(gx, gy);
    const ring = this.scene.add.graphics();
    ring.setScrollFactor(0);
    ring.setDepth(screen.y + 90);
    ring.setPosition(screen.x, screen.y + 9);
    ring.lineStyle(2, 0xef4444, 0.95);
    ring.strokeEllipse(0, 0, 50, 19);
    this.container!.add(ring);
    this.targetRing = ring;
  }

  private hideTargetRing(): void {
    if (this.targetRing) {
      this.targetRing.destroy();
      this.targetRing = null;
    }
  }

  private updateTargetRingPosition(): void {
    if (!this.targetRing) return;
    const screen = this.arenaToScreen(this.cursorGridPos.x, this.cursorGridPos.y);
    this.targetRing.setPosition(screen.x, screen.y + 9);
    this.targetRing.setDepth(screen.y + 90);
  }

  // ============================================================
  // 渲染 — HUD
  // ============================================================

  private renderHUD(): void {
    // 参考经典战棋布局：四角浮层，不用整条侧栏抢战场视觉中心。
    const info = this.getBattleInfoRect();
    const infoBg = this.scene.add.graphics();
    infoBg.setScrollFactor(0);
    infoBg.fillStyle(0x070707, 0.66);
    infoBg.fillRoundedRect(info.x, info.y, info.w, info.h, 14);
    infoBg.lineStyle(1, 0xd6a64d, 0.58);
    infoBg.strokeRoundedRect(info.x, info.y, info.w, info.h, 14);
    infoBg.lineStyle(1, 0xfef3c7, 0.1);
    infoBg.strokeRoundedRect(info.x + 6, info.y + 6, info.w - 12, info.h - 12, 10);
    this.container!.add(infoBg);

    const sideTitle = this.scene.add.text(info.x + 18, info.y + 13, '战局', {
      fontSize: '17px',
      color: '#fef3c7',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      stroke: '#2b1608',
      strokeThickness: 1,
    });
    sideTitle.setScrollFactor(0);
    this.container!.add(sideTitle);

    this.roundLabel = this.scene.add.text(info.x + info.w - 18, info.y + 15, '第 1 回合', {
      fontSize: '13px',
      color: '#fbbf24',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    }).setOrigin(1, 0);
    this.roundLabel.setScrollFactor(0);
    this.container!.add(this.roundLabel);

    const subtitle = this.scene.add.text(info.x + 18, info.y + 39, 'Space 确认 · Esc 返回 · Tab 自动', {
      fontSize: '10px',
      color: '#a7afbf',
    });
    subtitle.setScrollFactor(0);
    this.container!.add(subtitle);

    // 双方状态卡
    for (const person of this.persons) {
      const isRed = person.team === 'red';
      const rect = this.getStatusPanelRect(person);

      const bg = this.scene.add.graphics();
      bg.setScrollFactor(0);
      bg.fillStyle(isRed ? 0x2b130b : 0x091827, 0.46);
      bg.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 12);
      bg.fillStyle(isRed ? 0xd97706 : 0x38bdf8, 0.28);
      bg.fillRoundedRect(rect.x, rect.y, 4, rect.h, 2);
      bg.lineStyle(1, isRed ? 0xd97706 : 0x38bdf8, 0.34);
      bg.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 12);
      this.container!.add(bg);

      const portraitBg = this.scene.add.graphics();
      portraitBg.setScrollFactor(0);
      portraitBg.fillStyle(0x050505, 0.72);
      portraitBg.fillRoundedRect(rect.x + 12, rect.y + 12, 62, 62, 8);
      portraitBg.lineStyle(1, isRed ? 0xd97706 : 0x38bdf8, 0.45);
      portraitBg.strokeRoundedRect(rect.x + 12, rect.y + 12, 62, 62, 8);
      this.container!.add(portraitBg);

      const portraitKey = this.animator.getIdleTextureKey(person);
      if (this.scene.textures.exists(portraitKey)) {
        const portrait = this.scene.add.image(rect.x + 43, rect.y + 68, portraitKey);
        portrait.setOrigin(this.animator.originX, this.animator.originY);
        portrait.setScale(this.animator.scale * 0.58);
        portrait.setScrollFactor(0);
        this.container!.add(portrait);
      }

      const textX = rect.x + 92;
      const camp = this.scene.add.text(textX, rect.y + 8, isRed ? '主角' : '对手', {
        fontSize: '11px',
        color: '#b9a77f',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      });
      camp.setScrollFactor(0);
      this.container!.add(camp);

      const nameText = this.scene.add.text(textX, rect.y + 24, person.name, {
        fontSize: '15px',
        color: isRed ? '#fef3c7' : '#dbeafe',
        fontStyle: 'bold',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      });
      nameText.setScrollFactor(0);
      this.container!.add(nameText);

      const wugongText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 27, this.getSkillBattleLabel(person, person.wugong), {
        fontSize: '11px',
        color: '#b9a77f',
      }).setOrigin(1, 0);
      wugongText.setScrollFactor(0);
      this.container!.add(wugongText);

      const hpBar = this.scene.add.graphics();
      hpBar.setScrollFactor(0);
      this.container!.add(hpBar);
      this.hpBars.set(person.id, hpBar);

      const mpBar = this.scene.add.graphics();
      mpBar.setScrollFactor(0);
      this.container!.add(mpBar);
      this.mpBars.set(person.id, mpBar);

      const hpText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 49, '', {
        fontSize: '10px',
        color: '#d1fae5',
      }).setOrigin(1, 0.5);
      hpText.setScrollFactor(0);
      this.container!.add(hpText);
      this.hpValueLabels.set(person.id, hpText);

      const mpText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 64, '', {
        fontSize: '10px',
        color: '#dbeafe',
      }).setOrigin(1, 0.5);
      mpText.setScrollFactor(0);
      this.container!.add(mpText);
      this.mpValueLabels.set(person.id, mpText);

      this.updateHPBar(person);
    }

    // 左下战斗记录
    const logRect = this.getLogPanelRect();
    const logBg = this.scene.add.graphics();
    logBg.setScrollFactor(0);
    logBg.fillStyle(0x070b12, 0.36);
    logBg.fillRoundedRect(logRect.x, logRect.y, logRect.w, logRect.h, 14);
    logBg.lineStyle(1, 0xd6a64d, 0.24);
    logBg.lineBetween(logRect.x, logRect.y + 30, logRect.x + logRect.w, logRect.y + 30);
    this.container!.add(logBg);
    const logTitle = this.scene.add.text(logRect.x + 16, logRect.y + 12, '战斗记录', {
      fontSize: '12px',
      color: '#fbbf24',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    logTitle.setScrollFactor(0);
    this.container!.add(logTitle);

    for (let i = 0; i < BATTLE_LOG_MAX; i++) {
      const t = this.scene.add.text(logRect.x + 16, logRect.y + 38 + i * 20, '', {
        fontSize: '11px',
        color: '#d1d5db',
        wordWrap: { width: logRect.w - 32 },
      }).setOrigin(0, 0);
      t.setScrollFactor(0);
      this.container!.add(t);
      this.logTexts.push(t);
    }

    this.renderTurnOrder();
  }

  private renderTurnOrder(): void {
    const centerX = SCREEN_WIDTH / 2;
    const y = SCREEN_HEIGHT - 54;
    const spacing = 96;
    const startX = centerX - ((this.persons.length - 1) * spacing) / 2;

    const rail = this.scene.add.graphics();
    rail.setScrollFactor(0);
    rail.lineStyle(4, 0x2b2113, 0.72);
    rail.lineBetween(startX - 64, y + 24, startX + (this.persons.length - 1) * spacing + 64, y + 24);
    rail.lineStyle(2, 0xd6a64d, 0.62);
    rail.lineBetween(startX - 64, y + 24, startX + (this.persons.length - 1) * spacing + 64, y + 24);
    this.container!.add(rail);

    this.persons.forEach((person, i) => {
      const x = startX + i * spacing;
      const isRed = person.team === 'red';
      const frame = this.scene.add.graphics();
      frame.setScrollFactor(0);
      frame.fillStyle(0x070707, 0.78);
      frame.lineStyle(2, isRed ? 0xfbbf24 : 0x7dd3fc, 0.8);
      frame.beginPath();
      frame.moveTo(x, y - 18);
      frame.lineTo(x + 34, y + 16);
      frame.lineTo(x, y + 50);
      frame.lineTo(x - 34, y + 16);
      frame.closePath();
      frame.fillPath();
      frame.strokePath();
      this.container!.add(frame);

      const key = this.animator.getIdleTextureKey(person);
      if (this.scene.textures.exists(key)) {
        const icon = this.scene.add.image(x, y + 34, key);
        icon.setOrigin(this.animator.originX, this.animator.originY);
        icon.setScale(this.animator.scale * 0.42);
        icon.setScrollFactor(0);
        this.container!.add(icon);
      }
    });
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
    const rect = this.getStatusPanelRect(person);

    // HP 颜色根据比例变化
    const ratio = person.hp / person.maxHp;
    const hpColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444;
    const hpBar = this.hpBars.get(person.id);
    if (hpBar) this.drawHPBar(hpBar, rect.x + 92, rect.y + 47, rect.w - 106, 8, person.hp, person.maxHp, hpColor);

    const mpBar = this.mpBars.get(person.id);
    if (mpBar) this.drawHPBar(mpBar, rect.x + 92, rect.y + 62, rect.w - 106, 6, person.mp, person.maxMp, 0x3b82f6);

    this.hpValueLabels.get(person.id)?.setText(`生命 ${person.hp}/${person.maxHp}`);
    this.mpValueLabels.get(person.id)?.setText(`内力 ${person.mp}/${person.maxMp}`);
  }

  private updateRoundLabel(): void {
    if (this.roundLabel) {
      this.roundLabel.setText(`第 ${this.round} 回合`);
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
    this.mpBars.clear();
    this.hpValueLabels.clear();
    this.mpValueLabels.clear();
    this.groundMarks.clear();
    this.hideActiveRing();
    this.hideTargetRing();
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
    this.controlledPersonId = null;
    this.isAutoMode = true;
  }
}
