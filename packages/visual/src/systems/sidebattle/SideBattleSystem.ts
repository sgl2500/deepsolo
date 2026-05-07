// ============================================================
// SideBattleSystem.ts — 2D 横版回合战斗 V1
// ============================================================

import type { BattlePerson, BattleResult, WugongDef } from '../../types';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../config';
import { createBattlePerson, createPlayerBattlePerson, NORMAL_ATTACK } from '../../data/BattleData';
import type { EventBus } from '../../core/EventBus';
import type { GameStore } from '../../core/GameStore';
import { getBattleCharacterTextureKey, type BattleCharacterStance } from '../../content/BattleAssetCatalog';
import { getBattleSkillEffect, type BattleSkillEffectDef } from '../../content/BattleSkillEffectCatalog';
import { BattleAnimator } from '../BattleAnimator';
import {
  applyDefense,
  checkSideBattleEnd,
  clearTurnDefense,
  getOpponent,
  resolveSideBattleDamage,
  sortTurnOrder,
} from './SideBattleRules';
import type { SideBattleActor, SideBattleSkill } from './SideBattleTypes';

type Phase = 'idle' | 'intro' | 'player_select' | 'animating' | 'enemy_turn' | 'ended';

const LEFT_ANCHOR = { x: 320, y: 480 };
const RIGHT_ANCHOR = { x: 960, y: 480 };

export class SideBattleSystem {
  private scene: Phaser.Scene;
  private eventBus: EventBus;
  private store: GameStore;
  private animator: BattleAnimator;

  private phase: Phase = 'idle';
  private actors: SideBattleActor[] = [];
  private sourcePersons = new Map<string, BattlePerson>();
  private turnQueue: SideBattleActor[] = [];
  private currentActor: SideBattleActor | null = null;
  private round = 0;
  private menuIndex = 0;

  private container: Phaser.GameObjects.Container | null = null;
  private sprites = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Container>();
  private hpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private mpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private shieldBars = new Map<string, Phaser.GameObjects.Graphics>();
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuObjects: Phaser.GameObjects.GameObject[] = [];
  private skillDetailText: Phaser.GameObjects.Text | null = null;
  private logText: Phaser.GameObjects.Text | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;

  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private oneKey!: Phaser.Input.Keyboard.Key;
  private twoKey!: Phaser.Input.Keyboard.Key;
  private threeKey!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, eventBus: EventBus, store: GameStore) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.store = store;
    this.animator = new BattleAnimator(scene, 'fight000');
    this.initKeys();
  }

  isActive(): boolean {
    return this.phase !== 'idle';
  }

  startPlayerVsAgent(agentId: string, agentName: string): void {
    if (this.phase !== 'idle') return;

    const playerPerson = createPlayerBattlePerson(this.store.playerProgress, 'red', { x: 0, y: 0 });
    const enemyStrategy = this.store.getStrategy(agentId);
    const enemyPerson = createBattlePerson(agentId, 'blue', { x: 0, y: 0 }, agentName, enemyStrategy);
    this.startWithPersons(playerPerson, enemyPerson);
  }

  update(_time: number, _delta: number): void {
    if (this.phase !== 'player_select' || !this.currentActor) return;

    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.menuIndex = (this.menuIndex - 1 + this.getMenuItems(this.currentActor).length) % this.getMenuItems(this.currentActor).length;
      this.renderMenu(this.currentActor);
    } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.menuIndex = (this.menuIndex + 1) % this.getMenuItems(this.currentActor).length;
      this.renderMenu(this.currentActor);
    } else if (Phaser.Input.Keyboard.JustDown(this.oneKey)) {
      this.chooseMenuIndex(0);
    } else if (Phaser.Input.Keyboard.JustDown(this.twoKey)) {
      this.chooseMenuIndex(1);
    } else if (Phaser.Input.Keyboard.JustDown(this.threeKey)) {
      this.chooseMenuIndex(2);
    } else if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.chooseMenuIndex(this.menuIndex);
    }
  }

  destroy(): void {
    this.cleanup();
  }

  private startWithPersons(playerPerson: BattlePerson, enemyPerson: BattlePerson): void {
    this.cleanup();
    this.phase = 'intro';
    this.round = 0;
    this.sourcePersons.set(playerPerson.id, playerPerson);
    this.sourcePersons.set(enemyPerson.id, enemyPerson);
    this.actors = [
      this.toSideActor(playerPerson, 'left'),
      this.toSideActor(enemyPerson, 'right'),
    ];
    this.turnQueue = [];
    this.currentActor = null;

    this.renderScene();
    this.addLog(`${playerPerson.name} 与 ${enemyPerson.name} 展开横版切磋。`);
    this.eventBus.emit('battle:start', { redId: playerPerson.id, blueId: enemyPerson.id });
    this.scene.time.delayedCall(600, () => this.nextTurn());
  }

  private nextTurn(): void {
    if (this.phase === 'ended' || this.phase === 'idle') return;
    const result = checkSideBattleEnd(this.actors, this.round);
    if (result) {
      this.endBattle(result);
      return;
    }

    if (this.turnQueue.length === 0) {
      this.round += 1;
      this.turnQueue = sortTurnOrder(this.actors);
      this.addLog(`第 ${this.round} 回合`);
    }

    const actor = this.turnQueue.shift();
    if (!actor || !actor.alive) {
      this.nextTurn();
      return;
    }

    if (actor.defending) {
      clearTurnDefense(actor);
      this.setActorStance(actor, 'idle');
    } else {
      clearTurnDefense(actor);
    }
    this.currentActor = actor;
    this.highlightActor(actor);

    if (actor.id === 'player') {
      this.phase = 'player_select';
      this.menuIndex = 0;
      this.renderMenu(actor);
      this.setHint('↑↓ 选择 · Enter/Space 确认 · 1/2/3 快捷出招');
    } else {
      this.phase = 'enemy_turn';
      this.clearMenu();
      this.setHint(`${actor.name} 正在运转策略...`);
      this.scene.time.delayedCall(450, () => this.performEnemyAction(actor));
    }
  }

  private performEnemyAction(actor: SideBattleActor): void {
    if (this.phase === 'ended' || !actor.alive) return;
    if (actor.id === 'digital_master' && this.round > 1 && this.round % 3 === 0) {
      this.applyStrategyEvolution(actor);
      this.performDefense(actor, '数字掌门启动回撤护体，临时收缩风险敞口。');
      return;
    }
    const usable = actor.skills.filter(skill => skill.target === 'enemy' && actor.mp >= skill.mpCost);
    const skill = usable.find(item => item.id !== 'normal_attack') ?? actor.skills[0];
    this.performSkill(actor, skill);
  }

  private chooseMenuIndex(index: number): void {
    if (!this.currentActor) return;
    const menu = this.getMenuItems(this.currentActor);
    const item = menu[index];
    if (!item) return;

    if (item.kind === 'defense') {
      this.performDefense(this.currentActor, `${this.currentActor.name} 收势防御，内力恢复。`);
      return;
    }

    this.performSkill(this.currentActor, item.skill);
  }

  private performSkill(actor: SideBattleActor, skill: SideBattleSkill): void {
    const target = getOpponent(actor, this.actors);
    if (!target) return;
    if (actor.mp < skill.mpCost) {
      this.addLog('内力不足。');
      return;
    }

    this.phase = 'animating';
    this.clearMenu();
    this.setHint('');
    this.addLog(`${actor.name} 使出 ${skill.name}`);
    this.showSkillBanner(actor, skill);

    const effect = getBattleSkillEffect(skill);
    if (effect.presentation === 'ranged_strategy') {
      this.performRangedStrategyAttack(actor, target, skill, effect);
      return;
    }
    this.performMeleeAttack(actor, target, skill, effect);
  }

  private performMeleeAttack(
    actor: SideBattleActor,
    target: SideBattleActor,
    skill: SideBattleSkill,
    effect: BattleSkillEffectDef,
  ): void {
    const actorSprite = this.sprites.get(actor.id);
    const actorAnchor = this.getAnchor(actor);
    const strikeX = this.getMeleeStrikeX(actor, target);

    this.setActorStance(actor, 'attack');
    actorSprite?.setDepth(9280);
    this.scene.tweens.add({
      targets: actorSprite,
      x: strikeX,
      duration: effect.presentation === 'melee_normal' ? 220 : 280,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.flashAttack(actor, skill);
        const resolve = () => {
          this.resolveAnimatedHit(actor, target, skill, effect);
          this.finishAttack(actor, actorAnchor);
        };
        if (effect.presentation === 'melee_wugong') {
          this.playMeleeWugongEffect(actor, target, effect, resolve);
        } else {
          resolve();
        }
      },
    });
  }

  private performRangedStrategyAttack(
    actor: SideBattleActor,
    target: SideBattleActor,
    skill: SideBattleSkill,
    effect: BattleSkillEffectDef,
  ): void {
    const actorSprite = this.sprites.get(actor.id);
    const actorAnchor = this.getAnchor(actor);
    const readyX = actorAnchor.x + (actor.side === 'left' ? 58 : -58);

    this.setActorStance(actor, 'attack');
    actorSprite?.setDepth(9280);
    this.scene.tweens.add({
      targets: actorSprite,
      x: readyX,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.flashAttack(actor, skill);
        this.playRangedStrategyEffect(actor, target, effect, () => {
          this.resolveAnimatedHit(actor, target, skill, effect);
          this.finishAttack(actor, actorAnchor);
        });
      },
    });
  }

  private performDefense(actor: SideBattleActor, logLine: string): void {
    this.phase = 'animating';
    this.clearMenu();
    applyDefense(actor);
    this.addLog(logLine);
    this.refreshBars();
    this.showDefenseEffect(actor);
    const shieldText = actor.maxShield > 0 ? ' + 护盾' : '';
    this.showFloatingText(this.getAnchor(actor).x, this.getAnchor(actor).y - 122, `防御 + 内力恢复${shieldText}`, '#bfdbfe');
    this.scene.time.delayedCall(820, () => this.nextTurn());
  }

  private endBattle(result: BattleResult): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.clearMenu();
    this.syncPlayerVitalsAfterBattle();
    this.addLog(`战斗结束：${result.winnerName} 获胜。`);
    this.setHint('战斗将在片刻后结束');
    this.renderEndPanel(result);

    this.scene.time.delayedCall(2600, () => {
      this.cleanup();
      this.phase = 'idle';
      this.eventBus.emit('battle:end', result);
    });
  }

  private toSideActor(person: BattlePerson, side: 'left' | 'right'): SideBattleActor {
    const shield = this.createInitialShield(person);
    return {
      id: person.id,
      name: person.name,
      side,
      hp: person.hp,
      maxHp: person.maxHp,
      shield,
      maxShield: shield,
      mp: person.mp,
      maxMp: person.maxMp,
      attack: person.attack,
      defense: person.defense,
      speed: person.speed,
      hitRate: person.hitRate,
      dodgeRate: person.dodgeRate,
      evolutionStacks: 0,
      visualState: 'idle',
      skills: this.createSkills(person),
      defending: false,
      alive: person.alive,
    };
  }

  private createInitialShield(person: BattlePerson): number {
    const strategy = this.store.getStrategy(person.id);
    if (!strategy?.sourceWorkspace) return 0;
    const drawdownScore = Math.max(0, 30 - strategy.maxDrawdownPct);
    return Math.max(80, Math.round(person.maxHp * 0.08 + drawdownScore * 3));
  }

  private createSkills(person: BattlePerson): SideBattleSkill[] {
    if (person.id === 'digital_master') {
      return [
        this.fromWugong(NORMAL_ATTACK, 'normal'),
        {
          id: 'live_strategy_deduction',
          name: '实盘推演',
          type: 'strategy',
          mpCost: 18,
          power: 118,
          hitRate: 96,
          description: '调用实盘日志推演对手破绽，高命中策略攻击。',
          flavor: '以历史事件日志锁定你的风险暴露。',
          target: 'enemy',
        },
        {
          id: 'btc_heartbeat',
          name: 'BTC 心跳',
          type: 'strategy',
          mpCost: 28,
          power: 138,
          hitRate: 88,
          description: '以 BTC 策略心跳凝成内劲，伤害更高但消耗更大。',
          flavor: '行情心跳化为一道蓝色内劲。',
          target: 'enemy',
        },
      ];
    }
    const normal = this.fromWugong(NORMAL_ATTACK, 'normal');
    const main = person.wugong.id === NORMAL_ATTACK.id
      ? null
      : this.fromWugong(person.wugong, person.id === 'player' ? 'martial' : 'strategy');
    const learned = person.id === 'player' ? this.createPlayerLearnedSkills() : [];
    return [normal, ...(main ? [main] : []), ...learned].filter((skill, index, arr) =>
      arr.findIndex(item => item.id === skill.id) === index,
    );
  }

  private createPlayerLearnedSkills(): SideBattleSkill[] {
    const manuals = this.store.playerProgress.manuals.filter(item => item.learned).map(item => item.manualId);
    const skills: SideBattleSkill[] = [];
    if (manuals.includes('manual_tuna_intro')) {
      skills.push({
        id: 'tuna_qigong',
        name: '吐纳功',
        type: 'inner',
        mpCost: 10,
        power: 85,
        hitRate: 95,
        description: '稳住气息，以内力压制对手。',
        flavor: '气息下沉，内力连绵。',
        target: 'enemy',
      });
    }
    if (manuals.includes('manual_digital_fumo_intro')) {
      skills.push({
        id: 'digital_fumo_intro',
        name: '金刚伏魔入门',
        type: 'inner',
        mpCost: 22,
        power: 125,
        hitRate: 90,
        description: '数字掌门所传护体心法，攻守兼备。',
        flavor: '金色护体劲从掌心推出。',
        target: 'enemy',
      });
    }
    return skills;
  }

  private fromWugong(wugong: WugongDef, type: SideBattleSkill['type']): SideBattleSkill {
    return {
      id: wugong.id,
      name: wugong.name,
      type,
      mpCost: wugong.mpCost,
      power: Math.max(60, wugong.power),
      hitRate: wugong.hitRate,
      description: `${wugong.name} · 威力 ${wugong.power}`,
      flavor: type === 'normal' ? '贴身试探，寻找对手空门。' : '武功运转，气机前压。',
      target: 'enemy',
    };
  }

  private getMenuItems(actor: SideBattleActor): Array<{ kind: 'skill'; skill: SideBattleSkill } | { kind: 'defense'; label: string }> {
    const skills = actor.skills.filter(skill => skill.target === 'enemy').slice(0, 3);
    return [
      ...skills.map(skill => ({ kind: 'skill' as const, skill })),
      { kind: 'defense' as const, label: '防御' },
    ];
  }

  private renderScene(): void {
    this.container = this.scene.add.container(0, 0).setDepth(9000);
    this.container.setScrollFactor(0);

    const bg = this.scene.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x101827, 0.98);
    const horizon = this.scene.add.rectangle(SCREEN_WIDTH / 2, 396, SCREEN_WIDTH, 250, 0x172033, 0.86);
    const floor = this.scene.add.rectangle(SCREEN_WIDTH / 2, 542, SCREEN_WIDTH, 190, 0x2a1d10, 1);
    this.container.add([bg, horizon, floor]);

    if (this.hasDigitalSectBattle() && this.scene.textures.exists('battle_background_digital_sect_duel')) {
      const battleBg = this.scene.add.image(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 'battle_background_digital_sect_duel')
        .setDepth(9001);
      battleBg.setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT);
      battleBg.setScrollFactor(0);
      this.container.add(battleBg);
    }

    const sun = this.scene.add.circle(1010, 132, 82, 0xfbbf24, 0.1);
    const line1 = this.scene.add.rectangle(SCREEN_WIDTH / 2, 456, SCREEN_WIDTH, 2, 0xfbbf24, 0.16);
    const line2 = this.scene.add.rectangle(SCREEN_WIDTH / 2, 512, SCREEN_WIDTH, 2, 0xffffff, 0.08);
    const bottomPanel = this.scene.add.rectangle(SCREEN_WIDTH / 2, 625, SCREEN_WIDTH - 44, 172, 0x020617, 0.84)
      .setStrokeStyle(1, 0xfbbf24, 0.22);
    this.container.add([sun, line1, line2, bottomPanel]);

    this.titleText = this.scene.add.text(SCREEN_WIDTH / 2, 38, '横版切磋', {
      fontSize: '22px',
      color: '#fef3c7',
      fontFamily: 'Songti SC, STSong, serif',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.titleText.setScrollFactor(0);
    this.container.add(this.titleText);

    for (const actor of this.actors) {
      this.renderActor(actor);
      this.renderActorHud(actor);
    }

    const logTitle = this.scene.add.text(808, 548, '战斗日志', {
      fontSize: '13px',
      color: '#fbbf24',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }).setDepth(9300);
    logTitle.setScrollFactor(0);
    this.container.add(logTitle);

    this.logText = this.scene.add.text(808, 572, '', {
      fontSize: '13px',
      color: '#d1d5db',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      wordWrap: { width: 420 },
      lineSpacing: 5,
    }).setDepth(9300);
    this.logText.setScrollFactor(0);
    this.container.add(this.logText);

    this.hintText = this.scene.add.text(SCREEN_WIDTH / 2, 704, '', {
      fontSize: '13px',
      color: '#fbbf24',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }).setOrigin(0.5).setDepth(9400);
    this.hintText.setScrollFactor(0);
    this.container.add(this.hintText);
  }

  private renderActor(actor: SideBattleActor): void {
    const anchor = this.getAnchor(actor);
    const source = this.sourcePersons.get(actor.id);
    const shadow = this.scene.add.ellipse(anchor.x, anchor.y + 8, 118, 28, 0x000000, 0.32);
    shadow.setScrollFactor(0);
    this.container!.add(shadow);

    let display: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
    const battleTextureKey = this.getActorBattleTexture(actor, 'idle');
    if (battleTextureKey) {
      const image = this.scene.add.image(anchor.x, anchor.y + 42, battleTextureKey)
        .setOrigin(0.5, 1);
      image.setDisplaySize(this.getActorBattleWidth(actor, 'idle'), this.getActorBattleHeight(actor));
      display = image;
    } else if (source && this.animator.hasIdleTexture(source)) {
      const key = this.animator.getIdleTextureKey(source);
      const image = this.scene.add.image(anchor.x, anchor.y, key)
        .setOrigin(this.animator.originX, this.animator.originY)
        .setScale(this.animator.scale * 1.5);
      if (actor.side === 'right') image.setFlipX(true);
      display = image;
    } else {
      const c = this.scene.add.container(anchor.x, anchor.y);
      const color = actor.side === 'left' ? 0xf59e0b : 0x60a5fa;
      const body = this.scene.add.rectangle(0, -64, 48, 96, color, 0.92).setOrigin(0.5, 1);
      const head = this.scene.add.circle(0, -174, 24, 0xfef3c7, 0.95);
      const sash = this.scene.add.rectangle(0, -110, 64, 10, 0x111827, 0.8);
      c.add([body, head, sash]);
      display = c;
    }
    display.setDepth(9200);
    display.setScrollFactor(0);
    this.container!.add(display);
    this.sprites.set(actor.id, display);

    const name = this.scene.add.text(anchor.x, anchor.y + 42, actor.name, {
      fontSize: '14px',
      color: actor.side === 'left' ? '#fbbf24' : '#93c5fd',
      stroke: '#000',
      strokeThickness: 4,
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }).setOrigin(0.5);
    name.setScrollFactor(0);
    this.container!.add(name);
  }

  private renderActorHud(actor: SideBattleActor): void {
    const frame = this.getHudFrame(actor);
    const panel = this.scene.add.rectangle(frame.x, frame.y, frame.w, frame.h, 0x020617, 0.72).setOrigin(0, 0);
    panel.setStrokeStyle(1, actor.side === 'left' ? 0xfbbf24 : 0x60a5fa, 0.42);
    panel.setScrollFactor(0);
    panel.setDepth(9320);
    this.container!.add(panel);

    const name = this.scene.add.text(frame.x + 12, frame.y + 7, actor.name, {
      fontSize: '13px',
      color: '#fef3c7',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    });
    name.setScrollFactor(0);
    name.setDepth(9321);
    this.container!.add(name);

    const hp = this.scene.add.graphics();
    const mp = this.scene.add.graphics();
    const shield = this.scene.add.graphics();
    hp.setScrollFactor(0);
    mp.setScrollFactor(0);
    shield.setScrollFactor(0);
    hp.setDepth(9321);
    mp.setDepth(9321);
    shield.setDepth(9321);
    this.container!.add([hp, mp, shield]);
    this.hpBars.set(actor.id, hp);
    this.mpBars.set(actor.id, mp);
    this.shieldBars.set(actor.id, shield);
    this.drawBars(actor);
  }

  private drawBars(actor: SideBattleActor): void {
    const hp = this.hpBars.get(actor.id);
    const mp = this.mpBars.get(actor.id);
    const shield = this.shieldBars.get(actor.id);
    if (!hp || !mp) return;
    const frame = this.getHudFrame(actor);
    const x = frame.x + 12;
    const y = frame.y + 30;
    const w = frame.w - 24;
    this.drawBar(hp, x, y, w, 11, actor.hp, actor.maxHp, 0xef4444, `生命 ${actor.hp}/${actor.maxHp}`);
    this.drawBar(mp, x, y + 17, w, 8, actor.mp, actor.maxMp, 0x3b82f6, `内力 ${actor.mp}/${actor.maxMp}`);
    if (shield && actor.maxShield > 0) {
      this.drawBar(shield, x, y + 31, w, 8, actor.shield, actor.maxShield, 0xfbbf24, `策略护盾 ${actor.shield}/${actor.maxShield}`);
    } else if (shield) {
      shield.clear();
    }
  }

  private getHudFrame(actor: SideBattleActor): { x: number; y: number; w: number; h: number } {
    const w = 330;
    return {
      x: actor.side === 'left' ? 30 : SCREEN_WIDTH - w - 30,
      y: 14,
      w,
      h: actor.maxShield > 0 ? 78 : 62,
    };
  }

  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    current: number,
    max: number,
    color: number,
    label: string,
  ): void {
    const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    g.clear();
    g.fillStyle(0x0f172a, 0.96);
    g.fillRoundedRect(x, y, w, h, 4);
    g.fillStyle(color, 0.92);
    g.fillRoundedRect(x, y, w * pct, h, 4);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(x, y, w, h, 4);
    g.fillStyle(0xffffff, 0.82);
    g.fillRect(x + 1, y + 1, Math.max(0, w * pct - 2), 1);

    const oldLabel = g.getData('label') as Phaser.GameObjects.Text | undefined;
    if (oldLabel) oldLabel.setText(label);
    else {
      const text = this.scene.add.text(x + w - 4, y + h / 2, label, {
        fontSize: '10px',
        color: '#e5e7eb',
        stroke: '#000',
        strokeThickness: 2,
        fontFamily: 'monospace',
      }).setOrigin(1, 0.5);
      text.setScrollFactor(0);
      text.setDepth(g.depth + 1);
      this.container!.add(text);
      g.setData('label', text);
    }
  }

  private renderMenu(actor: SideBattleActor): void {
    this.clearMenu();
    const items = this.getMenuItems(actor);
    const startX = 58;
    const startY = 572;
    this.addMenuObject(this.scene.add.text(startX, 548, '行动', {
      fontSize: '13px',
      color: '#fbbf24',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }));

    items.forEach((item, index) => {
      const label = item.kind === 'defense'
        ? '防御'
        : `${item.skill.name}${item.skill.mpCost > 0 ? `  ${item.skill.mpCost}内力` : ''}`;
      const text = this.scene.add.text(startX, startY + index * 28, `${this.menuIndex === index ? '▶ ' : '   '}${index + 1}. ${label}`, {
        fontSize: '15px',
        color: this.menuIndex === index ? '#fef3c7' : '#cbd5e1',
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      });
      text.setScrollFactor(0);
      this.addMenuObject(text);
      this.menuTexts.push(text);
    });

    this.renderSkillDetail(actor, items[this.menuIndex]);
  }

  private clearMenu(): void {
    for (const text of this.menuTexts) text.destroy();
    this.menuTexts = [];
    for (const obj of this.menuObjects) obj.destroy();
    this.menuObjects = [];
    this.skillDetailText = null;
  }

  private addMenuObject<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if ('setScrollFactor' in obj) {
      (obj as T & { setScrollFactor: (value: number) => T }).setScrollFactor(0);
    }
    this.container!.add(obj);
    this.menuObjects.push(obj);
    return obj;
  }

  private renderSkillDetail(
    actor: SideBattleActor,
    item: ReturnType<SideBattleSystem['getMenuItems']>[number] | undefined,
  ): void {
    const panel = this.scene.add.rectangle(390, 626, 420, 136, 0x0f172a, 0.72)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x60a5fa, 0.24);
    this.addMenuObject(panel);

    const text = item?.kind === 'skill'
      ? this.formatSkillDetail(actor, item.skill)
      : '防御\n类型：守势\n消耗：0 内力\n效果：本回合减伤，并恢复 8 点内力。\n说明：先活下来，才有下一轮策略。';
    this.skillDetailText = this.scene.add.text(410, 566, text, {
      fontSize: '13px',
      color: '#dbeafe',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      lineSpacing: 5,
      wordWrap: { width: 380 },
    });
    this.addMenuObject(this.skillDetailText);
  }

  private formatSkillDetail(actor: SideBattleActor, skill: SideBattleSkill): string {
    const target = getOpponent(actor, this.actors);
    const estimate = target ? this.estimateDamage(actor, target, skill) : '未知';
    return `${skill.name}
类型：${this.getSkillTypeLabel(skill.type)}
消耗：${skill.mpCost} 内力  威力：${skill.power}  命中：${skill.hitRate}%
预计伤害：${estimate}
${skill.description}
${skill.flavor ?? ''}`.trim();
  }

  private estimateDamage(actor: SideBattleActor, target: SideBattleActor, skill: SideBattleSkill): string {
    const base = actor.attack * (skill.power / 100);
    const mitigation = target.defense * 0.45;
    const avg = Math.max(1, Math.round(base - mitigation));
    return `${Math.max(1, Math.round(avg * 0.9))} - ${Math.max(1, Math.round(avg * 1.1))}`;
  }

  private getSkillTypeLabel(type: SideBattleSkill['type']): string {
    switch (type) {
      case 'normal': return '普通';
      case 'martial': return '武功';
      case 'inner': return '内功';
      case 'strategy': return '策略';
      case 'defense': return '防御';
      default: return '技能';
    }
  }

  private addLog(line: string): void {
    if (!this.logText) return;
    const current = this.logText.text ? this.logText.text.split('\n') : [];
    current.push(line);
    this.logText.setText(current.slice(-5).join('\n'));
  }

  private setHint(text: string): void {
    this.hintText?.setText(text);
  }

  private refreshBars(): void {
    for (const actor of this.actors) this.drawBars(actor);
  }

  private getAnchor(actor: SideBattleActor): { x: number; y: number } {
    return actor.side === 'left' ? LEFT_ANCHOR : RIGHT_ANCHOR;
  }

  private hasDigitalSectBattle(): boolean {
    return this.actors.some(actor => actor.id === 'digital_master');
  }

  private getActorBattleTexture(actor: SideBattleActor, stance: BattleCharacterStance): string | null {
    const key = getBattleCharacterTextureKey(actor.id, stance);
    return key && this.scene.textures.exists(key) ? key : null;
  }

  private getActorBattleHeight(actor: SideBattleActor): number {
    return actor.id === 'digital_master' ? 405 : 350;
  }

  private getActorBattleWidth(actor: SideBattleActor, stance: BattleCharacterStance): number {
    const key = this.getActorBattleTexture(actor, stance);
    if (!key) return actor.id === 'digital_master' ? 300 : 245;
    const source = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const ratio = source.width > 0 && source.height > 0 ? source.width / source.height : 0.72;
    return Math.round(this.getActorBattleHeight(actor) * ratio);
  }

  private getMeleeStrikeX(actor: SideBattleActor, target: SideBattleActor): number {
    const targetAnchor = this.getAnchor(target);
    const actorHalfWidth = this.getActorBattleWidth(actor, 'attack') / 2;
    const targetHalfWidth = this.getActorBattleWidth(target, 'idle') / 2;
    const gap = 34;
    return actor.side === 'left'
      ? targetAnchor.x - targetHalfWidth - actorHalfWidth - gap
      : targetAnchor.x + targetHalfWidth + actorHalfWidth + gap;
  }

  private getImpactX(target: SideBattleActor): number {
    const anchor = this.getAnchor(target);
    const targetHalfWidth = this.getActorBattleWidth(target, 'idle') / 2;
    return target.side === 'left'
      ? anchor.x + targetHalfWidth * 0.58
      : anchor.x - targetHalfWidth * 0.58;
  }

  private setActorStance(actor: SideBattleActor, stance: BattleCharacterStance, restoreDelay = 0): void {
    const sprite = this.sprites.get(actor.id);
    actor.visualState = stance;
    const key = this.getActorBattleTexture(actor, stance);
    if (!key || !(sprite instanceof Phaser.GameObjects.Image)) return;

    sprite.setTexture(key);
    sprite.setDisplaySize(this.getActorBattleWidth(actor, stance), this.getActorBattleHeight(actor));
    if (restoreDelay > 0) {
      this.scene.time.delayedCall(restoreDelay, () => {
        if (this.phase === 'idle' || !actor.alive || actor.defending || actor.visualState !== stance) return;
        const idleKey = this.getActorBattleTexture(actor, 'idle');
        if (!idleKey) return;
        actor.visualState = 'idle';
        sprite.setTexture(idleKey);
        sprite.setDisplaySize(this.getActorBattleWidth(actor, 'idle'), this.getActorBattleHeight(actor));
      });
    }
  }

  private highlightActor(actor: SideBattleActor): void {
    for (const [id, sprite] of this.sprites.entries()) {
      if (id !== actor.id) continue;
      const baseY = sprite.y;
      this.scene.tweens.add({
        targets: sprite,
        y: baseY - 10,
        duration: 140,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  private flashAttack(actor: SideBattleActor, skill: SideBattleSkill): void {
    const anchor = this.getAnchor(actor);
    const color = skill.type === 'strategy' || skill.type === 'inner' ? 0x60a5fa : 0xfbbf24;
    const ring = this.scene.add.circle(anchor.x, anchor.y - 92, 14, color, 0.34).setDepth(9400);
    ring.setScrollFactor(0);
    this.container!.add(ring);
    this.scene.tweens.add({
      targets: ring,
      radius: 82,
      alpha: 0,
      duration: 420,
      onComplete: () => ring.destroy(),
    });
  }

  private resolveAnimatedHit(
    actor: SideBattleActor,
    target: SideBattleActor,
    skill: SideBattleSkill,
    effect: BattleSkillEffectDef,
  ): void {
    const targetSprite = this.sprites.get(target.id);
    const targetAnchor = this.getAnchor(target);
    const impactX = this.getImpactX(target);
    const wasDefending = target.defending;
    const damage = resolveSideBattleDamage(actor, target, skill);

    this.refreshBars();
    if (damage.hit) {
      this.shakeTarget(targetSprite, !wasDefending);
      this.showImpactBurst(impactX, targetAnchor.y - 104, 0xf97316, effect.hitBurstScale);
      this.showDamageNumber(impactX, targetAnchor.y - 126, damage.damage, damage.crit, damage.shieldDamage);
      const shieldText = damage.shieldDamage > 0 ? `，护盾抵消 ${damage.shieldDamage}` : '';
      this.addLog(`${target.name} 受到 ${damage.damage} 点伤害${shieldText}${damage.crit ? '（会心）' : ''}`);
    } else {
      this.showDamageNumber(impactX, targetAnchor.y - 126, 0, false, 0);
      this.addLog(`${target.name} 闪开了攻击。`);
    }

    if (!target.alive) this.playDeath(target);
    if (wasDefending) this.releaseDefenseAfterHit(target);
  }

  private finishAttack(actor: SideBattleActor, actorAnchor: { x: number; y: number }): void {
    const actorSprite = this.sprites.get(actor.id);
    this.scene.time.delayedCall(420, () => {
      this.scene.tweens.add({
        targets: actorSprite,
        x: actorAnchor.x,
        duration: 240,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          actorSprite?.setDepth(9200);
          if (actor.alive) this.setActorStance(actor, 'idle');
          this.refreshBars();
          const result = checkSideBattleEnd(this.actors, this.round);
          if (result) this.endBattle(result);
          else this.nextTurn();
        },
      });
    });
  }

  private playMeleeWugongEffect(
    actor: SideBattleActor,
    target: SideBattleActor,
    effect: BattleSkillEffectDef,
    onComplete: () => void,
  ): void {
    const targetAnchor = this.getAnchor(target);
    const x = this.getImpactX(target) + (actor.side === 'left' ? -38 : 38);
    const y = targetAnchor.y - 104;

    if (!effect.textureKey || !this.scene.textures.exists(effect.textureKey)) {
      this.scene.time.delayedCall(effect.durationMs, onComplete);
      return;
    }

    const wugong = this.scene.add.image(x, y, effect.textureKey)
      .setDepth(9580)
      .setAlpha(0)
      .setScale(0.72);
    wugong.setDisplaySize(effect.width, effect.height);
    wugong.setFlipX(actor.side === 'right');
    wugong.setScrollFactor(0);
    this.container!.add(wugong);
    this.scene.tweens.add({
      targets: wugong,
      x: x + (actor.side === 'left' ? 46 : -46),
      alpha: 1,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: Math.round(effect.durationMs * 0.58),
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: wugong,
          alpha: 0,
          scaleX: 1.18,
          scaleY: 1.18,
          duration: Math.round(effect.durationMs * 0.42),
          ease: 'Sine.easeOut',
          onComplete: () => {
            wugong.destroy();
            onComplete();
          },
        });
      },
    });
  }

  private playRangedStrategyEffect(
    actor: SideBattleActor,
    target: SideBattleActor,
    effect: BattleSkillEffectDef,
    onComplete: () => void,
  ): void {
    if (!effect.textureKey || !this.scene.textures.exists(effect.textureKey)) {
      onComplete();
      return;
    }

    const from = this.getAnchor(actor);
    const to = this.getAnchor(target);
    const color = 0x60a5fa;
    const projectile = this.scene.add.image(
      from.x + (actor.side === 'left' ? 112 : -112),
      from.y - 98,
      effect.textureKey,
    ).setDepth(9580).setAlpha(0.98);
    projectile.setDisplaySize(effect.width, effect.height);
    projectile.setFlipX(actor.side === 'right');
    const tail = this.scene.add.rectangle(projectile.x, projectile.y, 72, 5, color, 0.32)
      .setOrigin(actor.side === 'left' ? 1 : 0, 0.5)
      .setDepth(9570);
    projectile.setScrollFactor(0);
    tail.setScrollFactor(0);
    this.container!.add([tail, projectile]);

    this.scene.tweens.add({
      targets: projectile,
      x: this.getImpactX(target),
      y: to.y - 102,
      duration: effect.durationMs,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        tail.setPosition(projectile.x, projectile.y);
      },
      onComplete: () => {
        projectile.destroy();
        tail.destroy();
        onComplete();
      },
    });
  }

  private showImpactBurst(x: number, y: number, color: number, scale = 0.34): void {
    if (this.scene.textures.exists('battle_effect_hit_burst')) {
      const burstImage = this.scene.add.image(x, y, 'battle_effect_hit_burst')
        .setDepth(9590)
        .setAlpha(0.9)
        .setScale(Math.max(0.12, scale * 0.52));
      burstImage.setScrollFactor(0);
      this.container!.add(burstImage);
      this.scene.tweens.add({
        targets: burstImage,
        scale,
        alpha: 0,
        angle: 18,
        duration: 360,
        ease: 'Cubic.easeOut',
        onComplete: () => burstImage.destroy(),
      });
      return;
    }

    const burst = this.scene.add.circle(x, y, 18, color, 0.32)
      .setStrokeStyle(2, 0xffffff, 0.65)
      .setDepth(9590);
    burst.setScrollFactor(0);
    this.container!.add(burst);
    this.scene.tweens.add({
      targets: burst,
      radius: 78,
      alpha: 0,
      duration: 340,
      ease: 'Sine.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

  private applyStrategyEvolution(actor: SideBattleActor): void {
    actor.evolutionStacks += 1;
    actor.attack += 16;
    actor.defense += 10;
    if (actor.maxShield > 0) {
      actor.maxShield += 24;
      actor.shield = Math.min(actor.maxShield, actor.shield + 42);
    }
    this.addLog(`${actor.name} 策略进化 +${actor.evolutionStacks}：攻击、防御与护盾提升。`);
    this.showFloatingText(this.getAnchor(actor).x, this.getAnchor(actor).y - 164, `策略进化 +${actor.evolutionStacks}`, '#fde68a');
    this.refreshBars();
  }

  private showSkillBanner(actor: SideBattleActor, skill: SideBattleSkill): void {
    const anchor = this.getAnchor(actor);
    const banner = this.scene.add.text(anchor.x, anchor.y - 230, `「${skill.name}」`, {
      fontSize: '26px',
      color: skill.type === 'strategy' ? '#93c5fd' : '#fef3c7',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9650).setAlpha(0);
    banner.setScrollFactor(0);
    this.container!.add(banner);
    this.scene.tweens.add({
      targets: banner,
      y: banner.y - 16,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
      yoyo: true,
      hold: 430,
      onComplete: () => banner.destroy(),
    });
  }

  private showDefenseEffect(actor: SideBattleActor): void {
    const anchor = this.getAnchor(actor);
    this.setActorStance(actor, 'defense');
    if (actor.maxShield > 0 && this.scene.textures.exists('battle_effect_strategy_shield')) {
      const shield = this.scene.add.image(anchor.x, anchor.y - 96, 'battle_effect_strategy_shield')
        .setDepth(9350)
        .setAlpha(0.62);
      shield.setDisplaySize(230, 320);
      shield.setScrollFactor(0);
      this.container!.add(shield);
      this.scene.tweens.add({
        targets: shield,
        scaleX: 1.16,
        scaleY: 1.08,
        alpha: 0,
        duration: 760,
        ease: 'Sine.easeOut',
        onComplete: () => shield.destroy(),
      });
      return;
    }

    const ring = this.scene.add.ellipse(anchor.x, anchor.y - 92, 78, 128, 0x60a5fa, 0.13)
      .setStrokeStyle(2, 0xbfdbfe, 0.72)
      .setDepth(9350);
    ring.setScrollFactor(0);
    this.container!.add(ring);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.35,
      scaleY: 1.18,
      alpha: 0,
      duration: 760,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private releaseDefenseAfterHit(actor: SideBattleActor): void {
    this.scene.time.delayedCall(520, () => {
      if (!actor.alive) return;
      clearTurnDefense(actor);
      this.setActorStance(actor, 'idle');
    });
  }

  private shakeTarget(target: Phaser.GameObjects.Image | Phaser.GameObjects.Container | undefined, showHitStance = true): void {
    if (!target) return;
    this.scene.tweens.add({
      targets: target,
      x: target.x + 12,
      duration: 45,
      yoyo: true,
      repeat: 3,
    });
    if ('setTintFill' in target) {
      (target as Phaser.GameObjects.Image).setTintFill(0xffffff);
      this.scene.time.delayedCall(120, () => (target as Phaser.GameObjects.Image).clearTint());
    }
    const actor = this.actors.find(item => this.sprites.get(item.id) === target);
    if (actor && showHitStance) this.setActorStance(actor, 'hit', 300);
  }

  private showDamageNumber(x: number, y: number, damage: number, crit: boolean, shieldDamage: number): void {
    const label = damage > 0
      ? `${crit ? '暴击 ' : ''}-${damage}${shieldDamage > 0 ? ` 盾-${shieldDamage}` : ''}`
      : shieldDamage > 0 ? `盾-${shieldDamage}` : '闪避';
    const text = this.scene.add.text(x, y, label, {
      fontSize: crit ? '26px' : '21px',
      color: damage > 0 ? '#fca5a5' : shieldDamage > 0 ? '#fde68a' : '#cbd5e1',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 5,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(9600);
    text.setScrollFactor(0);
    this.container!.add(text);
    this.scene.tweens.add({
      targets: text,
      y: y - 58,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private showFloatingText(x: number, y: number, label: string, color: string): void {
    const text = this.scene.add.text(x, y, label, {
      fontSize: '18px',
      color,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }).setOrigin(0.5).setDepth(9600);
    text.setScrollFactor(0);
    this.container!.add(text);
    this.scene.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private playDeath(actor: SideBattleActor): void {
    const sprite = this.sprites.get(actor.id);
    if (!sprite) return;
    actor.visualState = 'dead';
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0.2,
      y: sprite.y + 28,
      angle: actor.side === 'left' ? -12 : 12,
      duration: 520,
      ease: 'Cubic.easeIn',
    });
  }

  private renderEndPanel(result: BattleResult): void {
    const panel = this.scene.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 440, 160, 0x020617, 0.9)
      .setStrokeStyle(1, 0xfbbf24, 0.5)
      .setDepth(9700);
    const title = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 26, `${result.winnerName} 获胜`, {
      fontSize: '26px',
      color: '#fef3c7',
      fontFamily: 'Songti SC, STSong, serif',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9701);
    const sub = this.scene.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 26, `用时 ${result.rounds} 回合`, {
      fontSize: '14px',
      color: '#cbd5e1',
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    }).setOrigin(0.5).setDepth(9701);
    panel.setScrollFactor(0);
    title.setScrollFactor(0);
    sub.setScrollFactor(0);
    this.container!.add([panel, title, sub]);
  }

  private syncPlayerVitalsAfterBattle(): void {
    const player = this.actors.find(actor => actor.id === 'player');
    if (!player) return;
    this.store.setPlayerVitals(player.hp <= 0 ? 1 : player.hp, player.mp, player.maxHp, player.maxMp);
  }

  private initKeys(): void {
    const keyboard = this.scene.input.keyboard!;
    this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.oneKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.twoKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.threeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
  }

  private cleanup(): void {
    this.clearMenu();
    for (const g of this.hpBars.values()) {
      const label = g.getData('label') as Phaser.GameObjects.Text | undefined;
      label?.destroy();
      g.destroy();
    }
    for (const g of this.mpBars.values()) {
      const label = g.getData('label') as Phaser.GameObjects.Text | undefined;
      label?.destroy();
      g.destroy();
    }
    for (const g of this.shieldBars.values()) {
      const label = g.getData('label') as Phaser.GameObjects.Text | undefined;
      label?.destroy();
      g.destroy();
    }
    this.hpBars.clear();
    this.mpBars.clear();
    this.shieldBars.clear();
    this.sprites.clear();
    this.sourcePersons.clear();
    this.actors = [];
    this.turnQueue = [];
    this.currentActor = null;
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.phase = 'idle';
  }
}
