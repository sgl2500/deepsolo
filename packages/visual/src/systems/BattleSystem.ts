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
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from '../config';
import { createBattlePerson, createPlayerBattlePerson, NORMAL_ATTACK, EFT_FRAME_COUNTS } from '../data/BattleData';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { BattleAnimator } from './BattleAnimator';
import { decideBattleAI } from './battle/BattleAI';
import { BattleBoardRenderer } from './battle/BattleBoardRenderer';
import { BattleInputController, type BattleInput } from './battle/BattleInputController';
import { BattleHUDRenderer } from './battle/BattleHUDRenderer';
import { getBattleSkillVisual, type BattleSkillVisualDef } from '../content/BattleSkillVisuals';
import { getMartialArtDef, getMartialLevel, getUnlockedCombatMartialArts, toTacticalWugongDef } from '../content/martial';
import {
  calcAttackRange,
  calcBattleDamage,
  calcMovePath,
  calcMoveRange,
  checkBattleEnd,
  getEnemy,
  getSkillAreaSize,
  isInAttackRange,
  uniqueSkills,
} from './battle/BattleRules';

// ── 战斗状态 ──

type Phase = 'idle' | 'running' | 'animating' | 'ended' | 'manual';

const BATTLE_COMMAND_COLS = 2;
const BATTLE_MOVE_STEP_DURATION = 260;

export class BattleSystem {
  private scene: Phaser.Scene;
  private eventBus: EventBus;
  private store: GameStore;
  private animator: BattleAnimator;
  private boardRenderer: BattleBoardRenderer;
  private hudRenderer: BattleHUDRenderer;

  // 战斗数据
  private persons: BattlePerson[] = [];
  private round = 0;
  private phase: Phase = 'idle';
  private turnQueue: BattlePerson[] = [];

  // 渲染对象
  private container: Phaser.GameObjects.Container | null = null;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private groundMarks: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private activeRing: Phaser.GameObjects.Graphics | null = null;
  private activeRingPersonId: string | null = null;
  private targetRing: Phaser.GameObjects.Graphics | null = null;

  // ── 手动控制 ──
  private isAutoMode = true;
  private controlledPersonId: string | null = null;
  private manualPhase: ManualPhase = ManualPhase.ActionMenu;
  private currentManualPerson: BattlePerson | null = null;
  private savedPos: { x: number; y: number } | null = null;

  // 光标
  private cursorGridPos = { x: 0, y: 0 };

  // 范围覆盖
  private moveRangeCells: { x: number; y: number }[] = [];

  // 操作菜单
  private menuCursorIndex = 0;
  private readonly MENU_ITEMS = ['移动', '攻击', '防御', '休息', '状态', '自动'];

  // 武功子菜单
  private wugongCursorIndex = 0;
  private availableSkills: WugongDef[] = [];
  private selectedSkill: WugongDef | null = null;

  // 键盘输入归一化
  private inputController: BattleInputController;

  constructor(scene: Phaser.Scene, eventBus: EventBus, store: GameStore) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.store = store;
    this.animator = new BattleAnimator(scene, 'fight000');
    this.boardRenderer = new BattleBoardRenderer(scene);
    this.hudRenderer = new BattleHUDRenderer(scene, this.animator);
    this.inputController = new BattleInputController(scene);
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

    const redStrategy = this.store.getStrategy(redId);
    const blueStrategy = this.store.getStrategy(blueId);
    const red = createBattlePerson(redId, 'red', { x: 5, y: 8 }, redStrategy?.name, redStrategy);
    const blue = createBattlePerson(blueId, 'blue', { x: 3, y: 1 }, blueStrategy?.name, blueStrategy);
    this.startWithPersons(red, blue, null, true);
  }

  /** 玩家挑战大地图 Agent */
  startPlayerVsAgent(agentId: string, agentName: string): void {
    if (this.phase !== 'idle') return;

    const player = createPlayerBattlePerson(this.store.playerProgress, 'red', { x: 5, y: 8 });
    const enemyStrategy = this.store.getStrategy(agentId);
    const enemy = createBattlePerson(agentId, 'blue', { x: 3, y: 1 }, agentName, enemyStrategy);
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

    this.inputController.init();
    this.container = this.boardRenderer.renderArena();
    this.renderPersons();
    this.hudRenderer.renderHUD(this.container!, this.persons, this.round, (person, skill) => this.getSkillBattleLabel(person, skill));

    this.eventBus.emit('battle:start', { redId: red.id, blueId: blue.id });

    // 延迟开始第一回合
    this.scene.time.delayedCall(800, () => this.nextTurn());
  }

  /** 每帧更新 */
  update(_time: number, _delta: number): void {
    if (this.phase === 'idle' || this.phase === 'ended') return;

    // Tab 键切换手动/自动
    if (this.inputController.consumeToggleAuto()) {
      if (this.phase === 'manual') {
        this.switchToAuto();
        return;
      } else {
        // 自动 → 手动：下一回合开始生效
        this.isAutoMode = false;
        this.hudRenderer.addLog('>> 下一回合切换为手动模式 (Tab切回自动)');
        return;
      }
    }

    if (this.phase !== 'manual') return;

    const input = this.inputController.consumeInput();
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

  // ── 手动模式进入/退出 ──

  private enterManualMode(person: BattlePerson): void {
    this.phase = 'manual';
    this.currentManualPerson = person;
    this.showActiveRing(person);
    this.savedPos = { ...person.pos };
    this.manualPhase = ManualPhase.ActionMenu;
    this.menuCursorIndex = 0;
    this.hudRenderer.addLog(`>> ${person.name} 的回合 (手动)`);
    this.hudRenderer.showActionMenu(this.container, person, this.MENU_ITEMS, this.menuCursorIndex);
  }

  exitManualMode(): void {
    this.hudRenderer.hideActionMenu();
    this.hudRenderer.hideWugongMenu();
    this.boardRenderer.clearRangeOverlays();
    this.boardRenderer.hideCursor();
    this.hideActiveRing();
    this.hideTargetRing();
    this.hudRenderer.hideHintText();
    this.currentManualPerson = null;
    this.savedPos = null;
    this.selectedSkill = null;
  }

  private switchToAuto(): void {
    this.isAutoMode = true;
    const person = this.currentManualPerson;
    this.exitManualMode();
    this.phase = 'running';
    this.hudRenderer.addLog('>> 切换为自动模式');
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
      this.hudRenderer.updateRoundLabel(this.round);
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
    const action = decideBattleAI(person, this.persons);
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
      this.hudRenderer.updateActionMenuHighlight(this.menuCursorIndex);
    } else if (input === 'right') {
      this.menuCursorIndex = (this.menuCursorIndex + 1) % items;
      this.hudRenderer.updateActionMenuHighlight(this.menuCursorIndex);
    } else if (input === 'up') {
      this.menuCursorIndex = (this.menuCursorIndex - BATTLE_COMMAND_COLS + items) % items;
      this.hudRenderer.updateActionMenuHighlight(this.menuCursorIndex);
    } else if (input === 'down') {
      this.menuCursorIndex = (this.menuCursorIndex + BATTLE_COMMAND_COLS) % items;
      this.hudRenderer.updateActionMenuHighlight(this.menuCursorIndex);
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
        this.hudRenderer.addLog(`不能移动到(${this.cursorGridPos.x},${this.cursorGridPos.y}) 范围${this.moveRangeCells.length}格`);
      }
    } else if (input === 'cancel') {
      this.boardRenderer.clearRangeOverlays();
      this.boardRenderer.hideCursor();
      this.hudRenderer.hideHintText();
      this.manualPhase = ManualPhase.ActionMenu;
      this.hudRenderer.showActionMenu(this.container, this.currentManualPerson!, this.MENU_ITEMS, this.menuCursorIndex);
    }
  }

  private handleWugongSelectInput(input: BattleInput): void {
    const count = this.availableSkills.length;
    if (input === 'up' || input === 'left') {
      this.wugongCursorIndex = (this.wugongCursorIndex - 1 + count) % count;
      this.hudRenderer.renderWugongMenu(this.container, this.currentManualPerson!, this.availableSkills, this.wugongCursorIndex);
    } else if (input === 'down' || input === 'right') {
      this.wugongCursorIndex = (this.wugongCursorIndex + 1) % count;
      this.hudRenderer.renderWugongMenu(this.container, this.currentManualPerson!, this.availableSkills, this.wugongCursorIndex);
    } else if (input === 'confirm') {
      const skill = this.availableSkills[this.wugongCursorIndex];
      if (!skill) return;
      const person = this.currentManualPerson!;
      if (person.mp < skill.mpCost) {
        this.hudRenderer.addLog(`MP不足，${skill.name}需要${skill.mpCost}MP`);
        return;
      }
      this.selectedSkill = skill;
      this.hudRenderer.hideWugongMenu();
      // 进入选中心点
      this.enterTargetSelect();
    } else if (input === 'cancel') {
      this.hudRenderer.hideWugongMenu();
      this.manualPhase = ManualPhase.ActionMenu;
      this.hudRenderer.showActionMenu(this.container, this.currentManualPerson!, this.MENU_ITEMS, this.menuCursorIndex);
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
      this.boardRenderer.clearRangeOverlays();
      this.boardRenderer.hideCursor();
      this.hideTargetRing();
      this.hudRenderer.hideHintText();
      this.enterWugongSelect();
    }
  }

  private moveCursorBy(dx: number, dy: number): void {
    const nx = this.cursorGridPos.x + dx;
    const ny = this.cursorGridPos.y + dy;
    if (nx < 0 || nx >= ARENA_SIZE || ny < 0 || ny >= ARENA_SIZE) return;

    this.cursorGridPos = { x: nx, y: ny };
    this.boardRenderer.updateCursorPosition(this.cursorGridPos);
    this.updateTargetRingPosition();
    this.hudRenderer.showHintText(this.container, `光标(${nx},${ny}) 方向键移动，Space确认`);
  }

  // ── 手动行动执行 ──

  private executeManualAction(action: 'defend' | 'rest'): void {
    const person = this.currentManualPerson!;
    this.hudRenderer.hideActionMenu();

    if (action === 'defend') {
      this.hudRenderer.addLog(`${person.name} 防御，伤害减半`);
      // 防御效果：标记，下一回合恢复（简化实现）
    } else {
      // 休息：恢复少量 MP
      const mpRecover = Math.floor(person.maxMp * 0.1);
      person.mp = Math.min(person.maxMp, person.mp + mpRecover);
      this.hudRenderer.addLog(`${person.name} 休息，恢复 ${mpRecover} MP`);
    }

    this.exitManualMode();
    this.phase = 'running';
    this.scene.time.delayedCall(BATTLE_TURN_DELAY, () => this.nextTurn());
  }

  private executeManualMove(): void {
    const person = this.currentManualPerson!;
    const target = { ...this.cursorGridPos };

    this.boardRenderer.clearRangeOverlays();
    this.boardRenderer.hideCursor();
    this.hudRenderer.hideHintText();

    this.hudRenderer.addLog(`移动到 (${target.x},${target.y})`);

    // 如果位置没变，直接回菜单
    if (target.x === person.pos.x && target.y === person.pos.y) {
      this.manualPhase = ManualPhase.ActionMenu;
      this.hudRenderer.showActionMenu(this.container, person, this.MENU_ITEMS, this.menuCursorIndex);
      return;
    }

    this.phase = 'animating';
    this.animateMove(person, target, () => {
      this.phase = 'manual';
      this.manualPhase = ManualPhase.ActionMenu;
      this.hudRenderer.showActionMenu(this.container, person, this.MENU_ITEMS, this.menuCursorIndex);
    });
  }

  private showStatusInLog(): void {
    const person = this.currentManualPerson!;
    this.hudRenderer.addLog(`${person.name} HP:${person.hp}/${person.maxHp} MP:${person.mp}/${person.maxMp} ATK:${person.attack} DEF:${person.defense}`);
  }

  // ── 手动子阶段进入 ──

  private enterMoveSelect(): void {
    const person = this.currentManualPerson!;
    this.hudRenderer.hideActionMenu();
    this.moveRangeCells = calcMoveRange(person.pos, person.moveRange, this.persons);
    this.boardRenderer.showMoveRange(this.container, this.moveRangeCells);
    this.cursorGridPos = { ...person.pos };
    this.boardRenderer.showCursor(this.container, person.pos.x, person.pos.y);
    this.hudRenderer.showHintText(this.container, '方向键移动光标，Space确认，ESC取消');
    this.hudRenderer.addLog(`可移动 ${this.moveRangeCells.length} 格 (从${person.pos.x},${person.pos.y})`);
    this.manualPhase = ManualPhase.MoveSelect;
  }

  private enterWugongSelect(): void {
    const person = this.currentManualPerson!;
    this.hudRenderer.hideActionMenu();
    const playerSkills = person.id === 'player'
      ? getUnlockedCombatMartialArts(this.store.playerProgress)
        .map((art) => toTacticalWugongDef(art.id, getMartialLevel(this.store.playerProgress, art.id)))
        .filter((skill): skill is WugongDef => !!skill)
      : [];
    // 专属武功 + 公共武功 + 普通攻击
    this.availableSkills = uniqueSkills([person.wugong, ...playerSkills, NORMAL_ATTACK]);
    this.wugongCursorIndex = 0;
    this.hudRenderer.renderWugongMenu(this.container, person, this.availableSkills, this.wugongCursorIndex);
    this.manualPhase = ManualPhase.WugongSelect;
  }

  private enterTargetSelect(): void {
    const person = this.currentManualPerson!;
    const skill = this.selectedSkill!;
    const visual = this.getSkillVisual(person, skill);
    this.hudRenderer.hideWugongMenu();
    const attackRangeCells = calcAttackRange(person.pos, skill.attackRange);
    this.boardRenderer.showAttackRange(this.container, attackRangeCells);
    // 光标初始定位到敌人位置（方便瞄准）
    const enemy = getEnemy(person, this.persons);
    this.cursorGridPos = enemy && attackRangeCells.some(c => c.x === enemy.pos.x && c.y === enemy.pos.y)
      ? { ...enemy.pos }
      : { ...attackRangeCells[0] ?? person.pos };
    this.boardRenderer.showCursor(this.container, this.cursorGridPos.x, this.cursorGridPos.y);
    this.showTargetRing(this.cursorGridPos.x, this.cursorGridPos.y);
    const aoe = getSkillAreaSize(skill, visual);
    this.hudRenderer.showHintText(this.container, `[${skill.name}] 攻击距离 ${skill.attackRange}，选择红色范围内目标，Space释放${aoe > 1 ? `(${aoe}x${aoe}范围)` : ''}`);
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

    if (!isInAttackRange(person.pos, { x: centerX, y: centerY }, skill.attackRange)) {
      this.hudRenderer.addLog(`${skill.name} 攻击距离不足，无法打到 (${centerX},${centerY})`);
      this.hudRenderer.showHintText(this.container, `[${skill.name}] 只能攻击红色范围内的格子`);
      return;
    }

    this.boardRenderer.clearRangeOverlays();
    this.boardRenderer.hideCursor();
    this.hideTargetRing();
    this.hudRenderer.hideActionMenu();
    this.hudRenderer.hideHintText();
    this.manualPhase = ManualPhase.ActionMenu;
    this.phase = 'animating';

    // 消耗 MP
    person.mp = Math.max(0, person.mp - skill.mpCost);
    this.hudRenderer.updateHPBar(person);

    const aoeSize = getSkillAreaSize(skill, visual);
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
                const centerScreen = this.boardRenderer.arenaToScreen(centerX, centerY);
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
                      const targetScreen = this.boardRenderer.arenaToScreen(target.pos.x, target.pos.y);
                      const targetSprite = this.sprites.get(target.id);

                      if (hit && damage > 0) {
                        hitAny = true;
                        target.hp = Math.max(0, target.hp - damage);
                        this.hudRenderer.updateHPBar(target);
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
                        this.hudRenderer.addLog(`${person.name} [${skillLabel}] → ${target.name} ${damage}伤害！`);
                        if (visual.hitStopMs > 0) this.hitStop(visual.hitStopMs);
                        if (target.hp <= 0) {
                          target.alive = false;
                          this.scene.time.delayedCall(500, () => this.playDeathEffect(target));
                        }
                      } else {
                        this.showDamageNumber(targetScreen.x, targetScreen.y - 45, 0, false);
                        this.hudRenderer.addLog(`${person.name} [${skillLabel}] → ${target.name} 未命中！`);
                      }
                    }
                  } else {
                    // 空挥：只显示技能效果
                    this.hudRenderer.addLog(`${person.name} [${skillLabel}] → 空挥`);
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
        const centerScreen = this.boardRenderer.arenaToScreen(centerX, centerY);
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

    const path = calcMovePath(person, target, this.persons);
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
        this.faceToward(person, getEnemy(person, this.persons)?.pos ?? person.pos);
        this.updatePersonVisualPosition(person);
        done();
        return;
      }

      this.faceToward(person, next, false);
      if (person.facing !== walkFacing) restartWalk();
      person.pos = { ...next };
      const screenPos = this.boardRenderer.arenaToScreen(next.x, next.y);

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
    this.hudRenderer.updateHPBar(attacker);

    const attackerScreen = this.boardRenderer.arenaToScreen(attacker.pos.x, attacker.pos.y);
    const targetScreen = this.boardRenderer.arenaToScreen(target.pos.x, target.pos.y);

    // 面朝目标
    this.faceToward(attacker, target.pos);

    const areaSize = getSkillAreaSize(skill, visual);
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
                    this.hudRenderer.updateHPBar(target);

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
                  this.hudRenderer.addLog(actionText);

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
        const screen = this.boardRenderer.arenaToScreen(tx, ty);
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
    return calcBattleDamage(attacker, defender, skill, this.getEffectiveSkillPower(attacker, skill));
  }

  // ============================================================
  // 胜负检查
  // ============================================================

  private checkEnd(): BattleResult | null {
    return checkBattleEnd(this.persons, this.round);
  }

  private endBattle(result?: BattleResult): void {
    this.phase = 'ended';
    const res = result ?? {
      winnerId: '', winnerName: '', loserId: '', loserName: '', rounds: this.round,
    };

    this.syncPlayerVitalsAfterBattle();
    this.hudRenderer.addLog(`★ 战斗结束！${res.winnerName} 获胜！`);
    this.hudRenderer.renderEndScreen(res);

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
    this.store.setPlayerVitals(hp, mp, Math.ceil(player.maxHp), Math.ceil(player.maxMp));
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private isControlledPerson(person: BattlePerson): boolean {
    return !!this.controlledPersonId && person.id === this.controlledPersonId;
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
    if (getMartialArtDef(skill.id)) return skill.power;
    const martialId = this.getMartialIdForSkill(skill);
    return Math.round(skill.power * this.store.getMartialPowerMultiplier(martialId));
  }

  private recordBattleMartialUse(person: BattlePerson, skill: WugongDef, hit: boolean): void {
    if (person.id !== 'player') return;
    const result = this.store.recordMartialUse(this.getMartialIdForSkill(skill), hit);
    if (result.leveledUp) {
      this.hudRenderer.addLog(`★ ${skill.name} 升至 Lv.${result.level}！`);
    } else if (skill.id === 'normal_attack') {
      const progressText = result.requiredExp > 0
        ? `${result.exp}/${result.requiredExp}`
        : '已满级';
      this.hudRenderer.addLog(`${skill.name} 熟练度 +${result.gainedExp} (${progressText})`);
    }
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

  // ============================================================
  // 渲染 — 角色
  // ============================================================

  private renderPersons(): void {
    for (const person of this.persons) {
      const screen = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);

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
    const screen = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);
    const sprite = this.sprites.get(person.id);
    if (sprite) {
      sprite.setPosition(screen.x, screen.y);
    }
    this.updatePersonDepthAndGround(person);
    this.updateActiveRingPosition();
    this.updateTargetRingPosition();
  }

  private updatePersonDepthAndGround(person: BattlePerson): void {
    const screen = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);
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
    const screen = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);
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
    const screen = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);
    this.activeRing.setPosition(screen.x, screen.y + 9);
    this.activeRing.setDepth(screen.y + 89);
  }

  private showTargetRing(gx: number, gy: number): void {
    this.hideTargetRing();
    const screen = this.boardRenderer.arenaToScreen(gx, gy);
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
    const screen = this.boardRenderer.arenaToScreen(this.cursorGridPos.x, this.cursorGridPos.y);
    this.targetRing.setPosition(screen.x, screen.y + 9);
    this.targetRing.setDepth(screen.y + 90);
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
    const pos = this.boardRenderer.arenaToScreen(person.pos.x, person.pos.y);

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
  // 清理
  // ============================================================

  private cleanup(): void {
    this.exitManualMode();
    this.sprites.clear();
    this.groundMarks.clear();
    this.hideActiveRing();
    this.hideTargetRing();
    this.hudRenderer.cleanup();
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.persons = [];
    this.turnQueue = [];
    this.controlledPersonId = null;
    this.isAutoMode = true;
  }
}
