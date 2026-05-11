import { BATTLE_LOG_MAX, ENABLE_MARTIAL_DEBUG_LOADOUT, SCREEN_HEIGHT, SCREEN_WIDTH } from '../../config';
import type { BattlePerson, BattleResult, WugongDef } from '../../types';
import { BattleAnimator } from '../BattleAnimator';

const BATTLE_STATUS_PANEL_W = 360;
const BATTLE_STATUS_PANEL_H = 86;
const BATTLE_HUD_MARGIN = 16;
const BATTLE_COMMAND_COLS = 2;
const BATTLE_COMMAND_ITEM_H = 36;

type SkillLabelResolver = (person: BattlePerson, skill: WugongDef) => string;

export class BattleHUDRenderer {
  private hpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private mpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private hpValueLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private mpValueLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private logTexts: Phaser.GameObjects.Text[] = [];
  private roundLabel: Phaser.GameObjects.Text | null = null;
  private endOverlay: Phaser.GameObjects.Container | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private menuContainer: Phaser.GameObjects.Container | null = null;
  private menuHighlight: Phaser.GameObjects.Graphics | null = null;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private wugongContainer: Phaser.GameObjects.Container | null = null;

  constructor(private scene: Phaser.Scene, private animator: BattleAnimator) {}

  renderHUD(
    container: Phaser.GameObjects.Container,
    persons: BattlePerson[],
    round: number,
    getSkillLabel: SkillLabelResolver,
  ): void {
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
    container.add(infoBg);

    const sideTitle = this.scene.add.text(info.x + 18, info.y + 13, '战局', {
      fontSize: '17px',
      color: '#fef3c7',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      stroke: '#2b1608',
      strokeThickness: 1,
    });
    sideTitle.setScrollFactor(0);
    container.add(sideTitle);

    this.roundLabel = this.scene.add.text(info.x + info.w - 18, info.y + 15, `第 ${round} 回合`, {
      fontSize: '13px',
      color: '#fbbf24',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    }).setOrigin(1, 0);
    this.roundLabel.setScrollFactor(0);
    container.add(this.roundLabel);

    const subtitle = this.scene.add.text(info.x + 18, info.y + 39, 'Space 确认 · Esc 返回 · Tab 自动', {
      fontSize: '10px',
      color: '#a7afbf',
    });
    subtitle.setScrollFactor(0);
    container.add(subtitle);

    for (const person of persons) {
      this.renderStatusPanel(container, person, getSkillLabel);
      this.updateHPBar(person);
    }

    this.renderLogPanel(container);
    this.renderTurnOrder(container, persons);
  }

  showHintText(container: Phaser.GameObjects.Container | null, text: string): void {
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
    container?.add(this.hintText);
  }

  hideHintText(): void {
    if (!this.hintText) return;
    this.hintText.destroy();
    this.hintText = null;
  }

  showActionMenu(
    container: Phaser.GameObjects.Container | null,
    person: BattlePerson,
    menuItems: string[],
    selectedIndex: number,
  ): void {
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

    this.menuHighlight = this.scene.add.graphics();
    this.menuContainer.add(this.menuHighlight);
    this.menuTexts = [];

    for (let i = 0; i < menuItems.length; i++) {
      const isSelected = i === selectedIndex;
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

      const t = this.scene.add.text(x + itemW / 2, y + BATTLE_COMMAND_ITEM_H / 2, menuItems[i], {
        fontSize: '14px',
        color: isSelected ? '#f8d57a' : '#d7c9aa',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      }).setOrigin(0.5, 0.5);
      this.menuContainer.add(t);
      this.menuTexts.push(t);
    }

    this.updateActionMenuHighlight(selectedIndex);
    container?.add(this.menuContainer);
  }

  updateActionMenuHighlight(selectedIndex: number): void {
    if (!this.menuHighlight) return;
    const area = this.getCommandAreaRect();
    const gap = 7;
    const itemW = (area.w - gap * (BATTLE_COMMAND_COLS + 1)) / BATTLE_COMMAND_COLS;
    const col = selectedIndex % BATTLE_COMMAND_COLS;
    const row = Math.floor(selectedIndex / BATTLE_COMMAND_COLS);
    const x = gap + col * (itemW + gap);
    const y = 50 + row * (BATTLE_COMMAND_ITEM_H + gap);
    this.menuHighlight.clear();
    this.menuHighlight.fillStyle(0xd6a64d, 0.3);
    this.menuHighlight.fillRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 10);
    this.menuHighlight.lineStyle(1, 0xf8d57a, 0.8);
    this.menuHighlight.strokeRoundedRect(x, y, itemW, BATTLE_COMMAND_ITEM_H, 10);

    for (let i = 0; i < this.menuTexts.length; i++) {
      const isSelected = i === selectedIndex;
      this.menuTexts[i].setColor(isSelected ? '#fff1b8' : '#d7c9aa');
      this.menuTexts[i].setStyle({ fontStyle: isSelected ? 'bold' : 'normal' });
    }
  }

  hideActionMenu(): void {
    if (this.menuContainer) {
      this.menuContainer.destroy(true);
      this.menuContainer = null;
    }
    this.menuHighlight = null;
    this.menuTexts = [];
  }

  renderWugongMenu(
    container: Phaser.GameObjects.Container | null,
    person: BattlePerson,
    skills: WugongDef[],
    selectedIndex: number,
  ): void {
    this.hideWugongMenu();
    const area = this.getCommandAreaRect();
    const menuW = area.w;
    const gap = 8;
    const cols = ENABLE_MARTIAL_DEBUG_LOADOUT && person.id === 'player' ? 2 : 1;
    const cardH = ENABLE_MARTIAL_DEBUG_LOADOUT && person.id === 'player' ? 36 : 52;
    const cardW = (menuW - 28 - gap * (cols - 1)) / cols;

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

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const hasMp = person.mp >= skill.mpCost;
      const isSelected = i === selectedIndex;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 14 + col * (cardW + gap);
      const y = 50 + row * (cardH + gap);
      const card = this.scene.add.graphics();
      card.fillStyle(isSelected ? 0x10453d : 0x0b1720, isSelected ? 0.76 : 0.42);
      card.fillRoundedRect(x, y, cardW, cardH, 10);
      card.lineStyle(1, isSelected ? 0x44ffaa : 0x6b5b3a, isSelected ? 0.8 : 0.24);
      card.strokeRoundedRect(x, y, cardW, cardH, 10);
      this.wugongContainer.add(card);

      const t = this.scene.add.text(x + 14, y + 7, skill.name, {
        fontSize: cols > 1 ? '12px' : '13px',
        color: !hasMp ? '#666666' : isSelected ? '#44ffaa' : '#cccccc',
        fontStyle: isSelected ? 'bold' : 'normal',
        fontFamily: 'Songti SC, STSong, PingFang SC, serif',
      }).setOrigin(0, 0);
      this.wugongContainer.add(t);

      const detail = this.scene.add.text(x + 14, y + (cols > 1 ? 22 : 31), `内力 ${skill.mpCost} · 距离 ${skill.attackRange} · 威力 ${skill.power}`, {
        fontSize: cols > 1 ? '10px' : '11px',
        color: hasMp ? '#b9a77f' : '#555555',
      }).setOrigin(0, 0);
      this.wugongContainer.add(detail);
    }

    container?.add(this.wugongContainer);
  }

  hideWugongMenu(): void {
    if (!this.wugongContainer) return;
    this.wugongContainer.destroy(true);
    this.wugongContainer = null;
  }

  updateHPBar(person: BattlePerson): void {
    const rect = this.getStatusPanelRect(person);
    const ratio = person.hp / person.maxHp;
    const hpColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444;
    const hpBar = this.hpBars.get(person.id);
    if (hpBar) this.drawHPBar(hpBar, rect.x + 92, rect.y + 47, rect.w - 106, 8, person.hp, person.maxHp, hpColor);

    const mpBar = this.mpBars.get(person.id);
    if (mpBar) this.drawHPBar(mpBar, rect.x + 92, rect.y + 62, rect.w - 106, 6, person.mp, person.maxMp, 0x3b82f6);

    this.hpValueLabels.get(person.id)?.setText(`生命 ${person.hp}/${person.maxHp}`);
    this.mpValueLabels.get(person.id)?.setText(`内力 ${person.mp}/${person.maxMp}`);
  }

  updateRoundLabel(round: number): void {
    this.roundLabel?.setText(`第 ${round} 回合`);
  }

  addLog(text: string): void {
    for (let i = 0; i < this.logTexts.length - 1; i++) {
      this.logTexts[i].setText(this.logTexts[i + 1].text);
    }
    const last = this.logTexts[this.logTexts.length - 1];
    if (last) last.setText(text);
  }

  renderEndScreen(result: BattleResult): void {
    this.endOverlay = this.scene.add.container(0, 0);
    this.endOverlay.setDepth(9999);
    this.endOverlay.setScrollFactor(0);

    const mask = this.scene.add.graphics();
    mask.fillStyle(0x000000, 0.6);
    mask.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    mask.setScrollFactor(0);
    this.endOverlay.add(mask);

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

  cleanup(): void {
    this.hideHintText();
    this.hideActionMenu();
    this.hideWugongMenu();
    this.hpBars.clear();
    this.mpBars.clear();
    this.hpValueLabels.clear();
    this.mpValueLabels.clear();
    this.logTexts = [];
    this.roundLabel = null;
    if (this.endOverlay) {
      this.endOverlay.destroy(true);
      this.endOverlay = null;
    }
  }

  private renderStatusPanel(
    container: Phaser.GameObjects.Container,
    person: BattlePerson,
    getSkillLabel: SkillLabelResolver,
  ): void {
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
    container.add(bg);

    const portraitBg = this.scene.add.graphics();
    portraitBg.setScrollFactor(0);
    portraitBg.fillStyle(0x050505, 0.72);
    portraitBg.fillRoundedRect(rect.x + 12, rect.y + 12, 62, 62, 8);
    portraitBg.lineStyle(1, isRed ? 0xd97706 : 0x38bdf8, 0.45);
    portraitBg.strokeRoundedRect(rect.x + 12, rect.y + 12, 62, 62, 8);
    container.add(portraitBg);

    const portraitKey = this.animator.getIdleTextureKey(person);
    if (this.scene.textures.exists(portraitKey)) {
      const portrait = this.scene.add.image(rect.x + 43, rect.y + 68, portraitKey);
      portrait.setOrigin(this.animator.originX, this.animator.originY);
      portrait.setScale(this.animator.scale * 0.58);
      portrait.setScrollFactor(0);
      container.add(portrait);
    }

    const textX = rect.x + 92;
    const camp = this.scene.add.text(textX, rect.y + 8, isRed ? '主角' : '对手', {
      fontSize: '11px',
      color: '#b9a77f',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    camp.setScrollFactor(0);
    container.add(camp);

    const nameText = this.scene.add.text(textX, rect.y + 24, person.name, {
      fontSize: '15px',
      color: isRed ? '#fef3c7' : '#dbeafe',
      fontStyle: 'bold',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    nameText.setScrollFactor(0);
    container.add(nameText);

    const wugongText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 27, getSkillLabel(person, person.wugong), {
      fontSize: '11px',
      color: '#b9a77f',
    }).setOrigin(1, 0);
    wugongText.setScrollFactor(0);
    container.add(wugongText);

    const hpBar = this.scene.add.graphics();
    hpBar.setScrollFactor(0);
    container.add(hpBar);
    this.hpBars.set(person.id, hpBar);

    const mpBar = this.scene.add.graphics();
    mpBar.setScrollFactor(0);
    container.add(mpBar);
    this.mpBars.set(person.id, mpBar);

    const hpText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 49, '', {
      fontSize: '10px',
      color: '#d1fae5',
    }).setOrigin(1, 0.5);
    hpText.setScrollFactor(0);
    container.add(hpText);
    this.hpValueLabels.set(person.id, hpText);

    const mpText = this.scene.add.text(rect.x + rect.w - 14, rect.y + 64, '', {
      fontSize: '10px',
      color: '#dbeafe',
    }).setOrigin(1, 0.5);
    mpText.setScrollFactor(0);
    container.add(mpText);
    this.mpValueLabels.set(person.id, mpText);
  }

  private renderLogPanel(container: Phaser.GameObjects.Container): void {
    const logRect = this.getLogPanelRect();
    const logBg = this.scene.add.graphics();
    logBg.setScrollFactor(0);
    logBg.fillStyle(0x070b12, 0.36);
    logBg.fillRoundedRect(logRect.x, logRect.y, logRect.w, logRect.h, 14);
    logBg.lineStyle(1, 0xd6a64d, 0.24);
    logBg.lineBetween(logRect.x, logRect.y + 30, logRect.x + logRect.w, logRect.y + 30);
    container.add(logBg);

    const logTitle = this.scene.add.text(logRect.x + 16, logRect.y + 12, '战斗记录', {
      fontSize: '12px',
      color: '#fbbf24',
      fontFamily: 'Songti SC, STSong, PingFang SC, serif',
    });
    logTitle.setScrollFactor(0);
    container.add(logTitle);

    for (let i = 0; i < BATTLE_LOG_MAX; i++) {
      const t = this.scene.add.text(logRect.x + 16, logRect.y + 38 + i * 20, '', {
        fontSize: '11px',
        color: '#d1d5db',
        wordWrap: { width: logRect.w - 32 },
      }).setOrigin(0, 0);
      t.setScrollFactor(0);
      container.add(t);
      this.logTexts.push(t);
    }
  }

  private renderTurnOrder(container: Phaser.GameObjects.Container, persons: BattlePerson[]): void {
    const centerX = SCREEN_WIDTH / 2;
    const y = SCREEN_HEIGHT - 54;
    const spacing = 96;
    const startX = centerX - ((persons.length - 1) * spacing) / 2;

    const rail = this.scene.add.graphics();
    rail.setScrollFactor(0);
    rail.lineStyle(4, 0x2b2113, 0.72);
    rail.lineBetween(startX - 64, y + 24, startX + (persons.length - 1) * spacing + 64, y + 24);
    rail.lineStyle(2, 0xd6a64d, 0.62);
    rail.lineBetween(startX - 64, y + 24, startX + (persons.length - 1) * spacing + 64, y + 24);
    container.add(rail);

    persons.forEach((person, i) => {
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
      container.add(frame);

      const key = this.animator.getIdleTextureKey(person);
      if (this.scene.textures.exists(key)) {
        const icon = this.scene.add.image(x, y + 34, key);
        icon.setOrigin(this.animator.originX, this.animator.originY);
        icon.setScale(this.animator.scale * 0.42);
        icon.setScrollFactor(0);
        container.add(icon);
      }
    });
  }

  private drawHPBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    current: number,
    max: number,
    color: number,
  ): void {
    g.clear();
    g.fillStyle(0x333333, 0.8);
    g.fillRoundedRect(x, y, w, h, 2);
    const ratio = Math.max(0, current / max);
    const barW = Math.round(w * ratio);
    if (barW > 0) {
      g.fillStyle(color, 0.9);
      g.fillRoundedRect(x, y, barW, h, 2);
    }
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
}
