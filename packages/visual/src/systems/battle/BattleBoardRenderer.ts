import { ARENA_SIZE, BATTLE_TILE_SCALE, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W } from '../../config';
import type { BattleGridPos } from './BattleRules';

export class BattleBoardRenderer {
  private cursorSprite: Phaser.GameObjects.Graphics | null = null;
  private moveRangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private attackRangeOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor(private scene: Phaser.Scene) {}

  renderArena(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    container.setDepth(5000);
    container.setScrollFactor(0);

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
    container.add(bg);

    this.renderFloor(container);
    this.renderGrid(container);

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
    container.add(title);

    return container;
  }

  arenaToScreen(x: number, y: number): { x: number; y: number } {
    const centerIndex = (ARENA_SIZE - 1) / 2;
    const dx = x - centerIndex;
    const dy = y - centerIndex;
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;
    const center = this.getBoardCenter();
    return {
      x: hw * (dx - dy) + center.x,
      y: hh * (dx + dy) + center.y,
    };
  }

  getBoardCenter(): { x: number; y: number } {
    return {
      x: Math.round(SCREEN_WIDTH / 2),
      y: Math.round(SCREEN_HEIGHT / 2 + 24),
    };
  }

  showCursor(container: Phaser.GameObjects.Container | null, gx: number, gy: number): void {
    this.hideCursor();
    const screen = this.arenaToScreen(gx, gy);
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;

    this.cursorSprite = this.scene.add.graphics();
    this.cursorSprite.setDepth(9000);
    this.cursorSprite.setScrollFactor(0);
    this.drawCursorDiamond(this.cursorSprite, screen.x, screen.y, hw, hh, 0xfbbf24);
    container?.add(this.cursorSprite);

    this.scene.tweens.add({
      targets: this.cursorSprite,
      alpha: { from: 1, to: 0.3 },
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
  }

  updateCursorPosition(pos: BattleGridPos): void {
    if (!this.cursorSprite) return;
    const screen = this.arenaToScreen(pos.x, pos.y);
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;
    this.cursorSprite.clear();
    this.drawCursorDiamond(this.cursorSprite, screen.x, screen.y, hw, hh, 0xfbbf24);
  }

  hideCursor(): void {
    if (!this.cursorSprite) return;
    this.scene.tweens.killTweensOf(this.cursorSprite);
    this.cursorSprite.destroy();
    this.cursorSprite = null;
  }

  showMoveRange(container: Phaser.GameObjects.Container | null, cells: BattleGridPos[]): void {
    this.clearMoveRange();
    this.moveRangeOverlay = this.createRangeOverlay(cells, 0x3b82f6);
    container?.add(this.moveRangeOverlay);
  }

  showAttackRange(container: Phaser.GameObjects.Container | null, cells: BattleGridPos[]): void {
    this.clearAttackRange();
    this.attackRangeOverlay = this.createRangeOverlay(cells, 0xef4444);
    container?.add(this.attackRangeOverlay);
  }

  clearRangeOverlays(): void {
    this.clearMoveRange();
    this.clearAttackRange();
  }

  private clearMoveRange(): void {
    this.moveRangeOverlay?.destroy();
    this.moveRangeOverlay = null;
  }

  private clearAttackRange(): void {
    this.attackRangeOverlay?.destroy();
    this.attackRangeOverlay = null;
  }

  private renderFloor(container: Phaser.GameObjects.Container): void {
    const floorTexKey = 'smap_588';
    if (!this.scene.textures.exists(floorTexKey)) return;

    const smapInfo = this.scene.cache.json.get('smap_info') as Array<{ idx: number; xoff: number; yoff: number }> | undefined;
    let ox = TILE_HALF_W;
    let oy = 17;
    if (Array.isArray(smapInfo)) {
      const entry = smapInfo.find(t => t.idx === 588);
      if (entry) { ox = entry.xoff; oy = entry.yoff; }
    }

    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const screen = this.arenaToScreen(x, y);
        const img = this.scene.add.image(
          screen.x - ox * BATTLE_TILE_SCALE,
          screen.y - oy * BATTLE_TILE_SCALE,
          floorTexKey,
        );
        img.setOrigin(0, 0);
        img.setScale(BATTLE_TILE_SCALE);
        img.setScrollFactor(0);
        container.add(img);
      }
    }
  }

  private renderGrid(container: Phaser.GameObjects.Container): void {
    const grid = this.scene.add.graphics();
    grid.setScrollFactor(0);
    for (let y = 0; y < ARENA_SIZE; y++) {
      for (let x = 0; x < ARENA_SIZE; x++) {
        const screen = this.arenaToScreen(x, y);
        this.drawDiamond(grid, screen.x, screen.y, TILE_HALF_W * BATTLE_TILE_SCALE, TILE_HALF_H * BATTLE_TILE_SCALE, -1, 0x3a3e4a);
      }
    }
    container.add(grid);
  }

  private createRangeOverlay(cells: BattleGridPos[], color: number): Phaser.GameObjects.Graphics {
    const overlay = this.scene.add.graphics();
    overlay.setDepth(8000);
    overlay.setScrollFactor(0);
    const hw = TILE_HALF_W * BATTLE_TILE_SCALE;
    const hh = TILE_HALF_H * BATTLE_TILE_SCALE;
    for (const cell of cells) {
      const screen = this.arenaToScreen(cell.x, cell.y);
      overlay.fillStyle(color, 0.25);
      overlay.beginPath();
      overlay.moveTo(screen.x, screen.y - hh);
      overlay.lineTo(screen.x + hw, screen.y);
      overlay.lineTo(screen.x, screen.y + hh);
      overlay.lineTo(screen.x - hw, screen.y);
      overlay.closePath();
      overlay.fillPath();
    }
    return overlay;
  }

  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    fillColor: number,
    lineColor: number,
  ): void {
    g.beginPath();
    g.moveTo(cx, cy - hh);
    g.lineTo(cx + hw, cy);
    g.lineTo(cx, cy + hh);
    g.lineTo(cx - hw, cy);
    g.closePath();
    if (fillColor >= 0) {
      g.fillStyle(fillColor, 0.6);
      g.fillPath();
    }
    g.lineStyle(1, lineColor, 0.4);
    g.strokePath();
  }

  private drawCursorDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, hw: number, hh: number, color: number): void {
    const e = 3;
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
}
