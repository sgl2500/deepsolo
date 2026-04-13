// ============================================================
// MapRenderer.ts — 双缓冲等距瓦片渲染
// ============================================================

import {
  TILE_HALF_W, TILE_HALF_H,
  SCREEN_WIDTH, SCREEN_HEIGHT,
  BUFFER_WIDTH, BUFFER_HEIGHT,
} from '../config';
import { getTile } from '../utils/IsoProjection';
import { isFrameValid } from '../utils/MathUtils';
import type { MapData, TileMeta } from '../types';

/** 缓冲区锚点 Y 位置（BH/2 居中，上下对称） */
const BCY = BUFFER_HEIGHT / 2;
/** 缓冲区锚点 X 位置 */
const BCX = BUFFER_WIDTH / 2;

export class MapRenderer {
  private scene: Phaser.Scene;
  private mapData!: MapData;
  private tileMeta!: TileMeta;

  // 双缓冲
  private bufCanvas: HTMLCanvasElement;
  private bufCtx: CanvasRenderingContext2D;
  private scrCanvas: HTMLCanvasElement;
  private scrCtx: CanvasRenderingContext2D;
  private scrTexture: Phaser.Textures.CanvasTexture | null = null;
  private atlasImg: any = null;

  // 缓冲中心位置
  private bufCx = 0;
  private bufCy = 0;

  // Phaser 显示用
  scrImage!: Phaser.GameObjects.Image;

  // 室内模式标记
  private isIndoor = false;
  // smap 瓦片偏移信息 (idx -> {xoff, yoff})，用 Map 加速查找
  private smapOffsets: Map<number, { xoff: number; yoff: number }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // 创建离屏大缓冲
    this.bufCanvas = document.createElement('canvas');
    this.bufCanvas.width = BUFFER_WIDTH;
    this.bufCanvas.height = BUFFER_HEIGHT;
    this.bufCtx = this.bufCanvas.getContext('2d')!;

    // 创建屏幕缓冲
    this.scrCanvas = document.createElement('canvas');
    this.scrCanvas.width = SCREEN_WIDTH;
    this.scrCanvas.height = SCREEN_HEIGHT;
    this.scrCtx = this.scrCanvas.getContext('2d')!;
  }

  init(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;
    this.isIndoor = false;

    // 创建 Phaser Canvas Texture
    const tex = this.scene.textures.addCanvas('scrCanvas', this.scrCanvas);
    this.scrTexture = tex as Phaser.Textures.CanvasTexture;
    this.scrImage = this.scene.add.image(0, 0, 'scrCanvas').setOrigin(0, 0).setDepth(0);
  }

  /** 切换到室内地图（JYQXZ smap 瓦片） */
  switchToIndoor(mapData: MapData, playerX: number, playerY: number): void {
    this.mapData = mapData;
    this.isIndoor = true;
    this.atlasImg = null;
    // 加载 smap 偏移信息（转成 Map 加速查找）
    this.smapOffsets.clear();
    const info = this.scene.cache.json.get('smap_info');
    if (Array.isArray(info)) {
      for (const t of info) {
        this.smapOffsets.set(t.idx, { xoff: t.xoff, yoff: t.yoff });
      }
    }
    // 以玩家位置为中心渲染
    this.renderBuffer(playerX, playerY);
    this.blitToScreen(playerX, playerY);
  }

  /** 切换回世界地图 */
  switchToWorld(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;
    this.isIndoor = false;
    this.atlasImg = null;
  }

  /** 是否需要重新渲染大缓冲 */
  shouldRerender(playerX: number, playerY: number): boolean {
    const ddx = playerX - this.bufCx;
    const ddy = playerY - this.bufCy;
    const pxOff = Math.abs(ddx * TILE_HALF_W) + Math.abs(ddy * TILE_HALF_W);
    const pyOff = Math.abs(ddx * TILE_HALF_H) + Math.abs(ddy * TILE_HALF_H);
    // 锚点居中，上下左右余量对称，直接用 BH/2 - SH/2
    return pxOff > (BUFFER_WIDTH / 2 - SCREEN_WIDTH / 2) - 50
      || pyOff > (BUFFER_HEIGHT / 2 - SCREEN_HEIGHT / 2) - 30;
  }

  /** 渲染大缓冲 */
  renderBuffer(playerX: number, playerY: number): void {
    const ctx = this.bufCtx;
    ctx.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
    ctx.fillStyle = this.isIndoor ? '#1a1410' : '#0a0e1a';
    ctx.fillRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

    this.bufCx = playerX;
    this.bufCy = playerY;

    const px = Math.floor(playerX);
    const py = Math.floor(playerY);

    // 菱形迭代范围
    const istart = Math.floor((0 - BCX) / (2 * TILE_HALF_W)) - 2;
    const iend = Math.floor((BUFFER_WIDTH - BCX) / (2 * TILE_HALF_W)) + 2;
    const jstart = Math.floor((0 - BCY) / (2 * TILE_HALF_H)) - 2;
    const jend = Math.floor((BUFFER_HEIGHT - BCY) / (2 * TILE_HALF_H)) + 2;
    const jrange = 2 * jend - 2 * jstart + 6;

    if (this.isIndoor) {
      this.renderIndoorBuffer(ctx, px, py, istart, iend, jstart, jrange);
    } else {
      this.renderWorldBuffer(ctx, px, py, istart, iend, jstart, jrange);
    }
  }

  /** 渲染世界地图瓦片（原有逻辑） */
  private renderWorldBuffer(
    ctx: CanvasRenderingContext2D,
    px: number, py: number,
    istart: number, iend: number, jstart: number, jrange: number,
  ): void {
    if (!this.atlasImg) {
      this.atlasImg = this.scene.textures.get('tiles').getSourceImage();
    }

    for (let j = 0; j <= jrange; j++) {
      for (let i = istart; i <= iend; i++) {
        const i1 = i + Math.floor(j / 2) + jstart;
        const j1 = -i + Math.floor(j / 2) + (j % 2) + jstart;

        const sx = TILE_HALF_W * (i1 - j1) + BCX;
        const sy = TILE_HALF_H * (i1 + j1) + BCY;

        const mx = px + i1;
        const my = py + j1;

        const ev = getTile(this.mapData, 0, mx, my);
        if (ev > 0) this.drawWorldTile(ctx, ev >> 1, sx, sy);

        const sv = getTile(this.mapData, 1, mx, my);
        if (sv > 0) this.drawWorldTile(ctx, sv >> 1, sx, sy);
      }
    }
  }

  /** 渲染室内地图瓦片（JYQXZ smap） */
  private renderIndoorBuffer(
    ctx: CanvasRenderingContext2D,
    px: number, py: number,
    istart: number, iend: number, jstart: number, jrange: number,
  ): void {
    for (let j = 0; j <= jrange; j++) {
      for (let i = istart; i <= iend; i++) {
        const i1 = i + Math.floor(j / 2) + jstart;
        const j1 = -i + Math.floor(j / 2) + (j % 2) + jstart;

        const sx = TILE_HALF_W * (i1 - j1) + BCX;
        const sy = TILE_HALF_H * (i1 + j1) + BCY;

        const mx = px + i1;
        const my = py + j1;

        const ev = getTile(this.mapData, 0, mx, my);
        if (ev > 0) this.drawSmapTile(ctx, ev, sx, sy);

        const sv = getTile(this.mapData, 1, mx, my);
        if (sv > 0) this.drawSmapTile(ctx, sv, sx, sy);
      }
    }
  }

  /** 将缓冲 blit 到屏幕 */
  blitToScreen(playerX: number, playerY: number): void {
    const offX = TILE_HALF_W * ((playerX - playerY) - (this.bufCx - this.bufCy));
    const offY = TILE_HALF_H * ((playerX + playerY) - (this.bufCx + this.bufCy));
    const srcX = BCX - SCREEN_WIDTH / 2 + offX;
    const srcY = BCY - SCREEN_HEIGHT / 2 + offY;
    this.scrCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.scrCtx.drawImage(this.bufCanvas, srcX, srcY, SCREEN_WIDTH, SCREEN_HEIGHT, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.scrTexture!.update();
  }

  /** 绘制世界地图瓦片（从 tile_atlas） */
  private drawWorldTile(ctx: CanvasRenderingContext2D, grpIdx: number, sx: number, sy: number): void {
    const frame = this.scene.textures.getFrame('tiles', 'tile_' + grpIdx);
    if (!isFrameValid(frame)) return;
    const meta = this.tileMeta[String(grpIdx)];
    const ox = meta ? meta.xoff : TILE_HALF_W;
    const oy = meta ? meta.yoff : 17;
    ctx.drawImage(
      this.atlasImg!,
      frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      sx - ox, sy - oy, frame.cutWidth, frame.cutHeight,
    );
  }

  /** 绘制 JYQXZ smap 室内瓦片 */
  private drawSmapTile(ctx: CanvasRenderingContext2D, tileId: number, sx: number, sy: number): void {
    const texKey = `smap_${tileId}`;
    if (!this.scene.textures.exists(texKey)) return;

    const texture = this.scene.textures.get(texKey);
    const rawSource = texture.getSourceImage();

    // 取出可绘制的 image/canvas 元素
    let imgSource: CanvasImageSource;
    if (rawSource instanceof HTMLImageElement || rawSource instanceof HTMLCanvasElement) {
      imgSource = rawSource;
    } else if (rawSource instanceof HTMLVideoElement) {
      imgSource = rawSource;
    } else {
      return;
    }

    if (imgSource.width === 0 || imgSource.height === 0) return;

    // HTMLImageElement 才有 complete 属性；HTMLCanvasElement 直接可用
    if (imgSource instanceof HTMLImageElement && !imgSource.complete) return;

    const off = this.smapOffsets.get(tileId);
    const ox = off ? off.xoff : TILE_HALF_W;
    const oy = off ? off.yoff : 17;

    ctx.drawImage(
      imgSource,
      0, 0, imgSource.width as number, imgSource.height as number,
      sx - ox, sy - oy, imgSource.width as number, imgSource.height as number,
    );
  }
}
