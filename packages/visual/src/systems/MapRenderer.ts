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

const BCY = BUFFER_HEIGHT / 2;
const BCX = BUFFER_WIDTH / 2;

export class MapRenderer {
  private scene: Phaser.Scene;
  private mapData!: MapData;
  private tileMeta!: TileMeta;

  // 世界地图双缓冲
  private bufCanvas: HTMLCanvasElement;
  private bufCtx: CanvasRenderingContext2D;
  private scrCanvas: HTMLCanvasElement;
  private scrCtx: CanvasRenderingContext2D;
  private scrTexture: Phaser.Textures.CanvasTexture | null = null;
  private atlasImg: any = null;

  private bufCx = 0;
  private bufCy = 0;

  scrImage!: Phaser.GameObjects.Image;

  // 室内模式
  private isIndoor = false;
  private smapOffsets: Map<number, { xoff: number; yoff: number }> = new Map();
  // 室内墙壁精灵
  private wallSprites: Phaser.GameObjects.Image[] = [];
  // 室内房间中心
  private indoorCx = 0;
  private indoorCy = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bufCanvas = document.createElement('canvas');
    this.bufCanvas.width = BUFFER_WIDTH;
    this.bufCanvas.height = BUFFER_HEIGHT;
    this.bufCtx = this.bufCanvas.getContext('2d')!;

    this.scrCanvas = document.createElement('canvas');
    this.scrCanvas.width = SCREEN_WIDTH;
    this.scrCanvas.height = SCREEN_HEIGHT;
    this.scrCtx = this.scrCanvas.getContext('2d')!;
  }

  init(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;

    const tex = this.scene.textures.addCanvas('scrCanvas', this.scrCanvas);
    this.scrTexture = tex as Phaser.Textures.CanvasTexture;
    this.scrImage = this.scene.add.image(0, 0, 'scrCanvas').setOrigin(0, 0).setDepth(0);
  }

  /** 切换到室内地图 */
  switchToIndoor(mapData: MapData): void {
    this.mapData = mapData;
    this.isIndoor = true;
    this.atlasImg = null;
    this.indoorCx = mapData.cx;
    this.indoorCy = mapData.cy;

    // 加载 smap 偏移
    this.smapOffsets.clear();
    const info = this.scene.cache.json.get('smap_info');
    if (Array.isArray(info)) {
      for (const t of info) {
        this.smapOffsets.set(t.idx, { xoff: t.xoff, yoff: t.yoff });
      }
    }

    // 渲染地板到屏幕画布（静态背景，只画一次）
    this.renderIndoorFloor();

    // 创建墙壁精灵
    this.createWallSprites();
  }

  /** 切换回世界地图 */
  switchToWorld(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;
    this.isIndoor = false;
    this.atlasImg = null;
    this.destroyWallSprites();
  }

  get isIndoorMode(): boolean { return this.isIndoor; }
  get roomCx(): number { return this.indoorCx; }
  get roomCy(): number { return this.indoorCy; }

  shouldRerender(playerX: number, playerY: number): boolean {
    if (this.isIndoor) return false;
    const ddx = playerX - this.bufCx;
    const ddy = playerY - this.bufCy;
    const pxOff = Math.abs(ddx * TILE_HALF_W) + Math.abs(ddy * TILE_HALF_W);
    const pyOff = Math.abs(ddx * TILE_HALF_H) + Math.abs(ddy * TILE_HALF_H);
    return pxOff > (BUFFER_WIDTH / 2 - SCREEN_WIDTH / 2) - 50
      || pyOff > (BUFFER_HEIGHT / 2 - SCREEN_HEIGHT / 2) - 30;
  }

  renderBuffer(playerX: number, playerY: number): void {
    if (this.isIndoor) return;

    const ctx = this.bufCtx;
    ctx.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

    this.bufCx = playerX;
    this.bufCy = playerY;

    const px = Math.floor(playerX);
    const py = Math.floor(playerY);
    const istart = Math.floor((0 - BCX) / (2 * TILE_HALF_W)) - 2;
    const iend = Math.floor((BUFFER_WIDTH - BCX) / (2 * TILE_HALF_W)) + 2;
    const jstart = Math.floor((0 - BCY) / (2 * TILE_HALF_H)) - 2;
    const jend = Math.floor((BUFFER_HEIGHT - BCY) / (2 * TILE_HALF_H)) + 2;
    const jrange = 2 * jend - 2 * jstart + 6;

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

  blitToScreen(playerX: number, playerY: number): void {
    if (this.isIndoor) return;

    const offX = TILE_HALF_W * ((playerX - playerY) - (this.bufCx - this.bufCy));
    const offY = TILE_HALF_H * ((playerX + playerY) - (this.bufCx + this.bufCy));
    const srcX = BCX - SCREEN_WIDTH / 2 + offX;
    const srcY = BCY - SCREEN_HEIGHT / 2 + offY;
    this.scrCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.scrCtx.drawImage(this.bufCanvas, srcX, srcY, SCREEN_WIDTH, SCREEN_HEIGHT, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.scrTexture!.update();
  }

  // ============================================================
  // 室内渲染
  // ============================================================

  /** 渲染地板到屏幕画布（静态背景） */
  private renderIndoorFloor(): void {
    const ctx = this.scrCtx;
    const map = this.mapData;
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;

    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const ev = map.earth[row][col];
        if (ev === 0) continue;
        const sx = TILE_HALF_W * ((col - cx) - (row - cy)) + scrCx;
        const sy = TILE_HALF_H * ((col - cx) + (row - cy)) + scrCy;
        this.drawSmapTileOnCtx(ctx, ev, sx, sy);
      }
    }

    this.scrTexture!.update();
  }

  /** 创建墙壁精灵（位置固定，只创建一次） */
  private createWallSprites(): void {
    this.destroyWallSprites();
    const map = this.mapData;
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const tileId = map.surface[row][col];
        if (tileId === 0) continue;

        const texKey = `smap_${tileId}`;
        if (!this.scene.textures.exists(texKey)) continue;

        const sx = TILE_HALF_W * ((col - cx) - (row - cy)) + scrCx;
        const sy = TILE_HALF_H * ((col - cx) + (row - cy)) + scrCy;

        const off = this.smapOffsets.get(tileId);
        const ox = off ? off.xoff : TILE_HALF_W;
        const oy = off ? off.yoff : 17;

        const sprite = this.scene.add.image(sx - ox, sy - oy, texKey)
          .setOrigin(0, 0)
          .setDepth(col + row);

        this.wallSprites.push(sprite);
      }
    }
  }

  private destroyWallSprites(): void {
    for (const s of this.wallSprites) s.destroy();
    this.wallSprites = [];
  }

  // ============================================================
  // 瓦片绘制
  // ============================================================

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

  private drawSmapTileOnCtx(ctx: CanvasRenderingContext2D, tileId: number, sx: number, sy: number): void {
    const texKey = `smap_${tileId}`;
    if (!this.scene.textures.exists(texKey)) return;

    const texture = this.scene.textures.get(texKey);
    const rawSource = texture.getSourceImage();

    let imgSource: CanvasImageSource;
    if (rawSource instanceof HTMLImageElement || rawSource instanceof HTMLCanvasElement) {
      imgSource = rawSource;
    } else if (rawSource instanceof HTMLVideoElement) {
      imgSource = rawSource;
    } else {
      return;
    }

    if (imgSource.width === 0 || imgSource.height === 0) return;
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
