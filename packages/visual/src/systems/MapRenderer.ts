// ============================================================
// MapRenderer.ts — 双缓冲等距瓦片渲染
// ============================================================

import {
  TILE_HALF_W, TILE_HALF_H,
  SCREEN_WIDTH, SCREEN_HEIGHT,
  BUFFER_WIDTH, BUFFER_HEIGHT,
  INDOOR_SCALE,
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
  // 室内容器 — 包含所有室内精灵和 Canvas，整体跟随玩家滚动
  private indoorContainer: Phaser.GameObjects.Container | null = null;
  // 室内墙壁 + 建筑（L1+L2）精灵
  private wallSprites: Phaser.GameObjects.GameObject[] = [];
  // 屋顶精灵（building 层），单独管理用于动态透明度
  private roofSprites: Phaser.GameObjects.Image[] = [];
  // 每个屋顶精灵对应的网格坐标
  private roofGridPos: { col: number; row: number }[] = [];
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
    this.scrImage = this.scene.add.image(0, 0, 'scrCanvas').setOrigin(0, 0).setDepth(0).setScrollFactor(0);
  }

  /** 切换到室内地图 */
  switchToIndoor(mapData: MapData): void {
    this.mapData = mapData;
    this.isIndoor = true;
    this.atlasImg = null;
    this.indoorCx = mapData.cx;
    this.indoorCy = mapData.cy;

    // 创建室内容器，用于整体跟随玩家滚动
    this.indoorContainer = this.scene.add.container(0, 0);
    // 将 Canvas 背景图放入容器
    this.scrImage.removeFromDisplayList();
    this.indoorContainer.add(this.scrImage);

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

    // 将 Canvas 背景图和外部子对象（玩家、NPC）从容器中取出
    if (this.indoorContainer) {
      this.scrImage.removeFromDisplayList();
      this.scene.add.existing(this.scrImage);

      // 把所有非墙壁子对象移回场景（防止被 destroy）
      const children = this.indoorContainer.getAll();
      for (const child of children) {
        this.indoorContainer!.remove(child);
        this.scene.add.existing(child as Phaser.GameObjects.GameObject);
      }

      this.indoorContainer.destroy();
      this.indoorContainer = null;
    }
  }

  get isIndoorMode(): boolean { return this.isIndoor; }
  get roomCx(): number { return this.indoorCx; }
  get roomCy(): number { return this.indoorCy; }
  /** 获取室内容器的当前偏移量（供 NPC 等实体同步定位） */
  get indoorContainerOffset(): { x: number; y: number } {
    return this.indoorContainer
      ? { x: this.indoorContainer.x, y: this.indoorContainer.y }
      : { x: 0, y: 0 };
  }

  /** 将外部游戏对象加入室内容器（如 NPC），使其跟随房间滚动 */
  addIndoorChild(obj: Phaser.GameObjects.GameObject): void {
    if (this.indoorContainer) {
      this.indoorContainer.add(obj);
    }
  }

  /** 将外部游戏对象从室内容器中移除 */
  removeIndoorChild(obj: Phaser.GameObjects.GameObject): void {
    if (this.indoorContainer) {
      this.indoorContainer.remove(obj);
    }
  }

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
    const s = INDOOR_SCALE;

    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const pos = (col: number, row: number) => ({
      sx: TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx,
      sy: TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy,
    });

    // Layer 0 — earth (floor)
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const ev = map.earth[row][col];
        if (ev === 0) continue;
        const { sx, sy } = pos(col, row);
        this.drawSmapTileOnCtx(ctx, ev, sx, sy, s);
      }
    }

    // Layer 1 — surface (walls) 也画到 Canvas 上，消除墙壁和地板间的缝隙
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const sv = map.surface[row][col];
        if (sv === 0) continue;
        const { sx, sy } = pos(col, row);
        this.drawSmapTileOnCtx(ctx, sv, sx, sy, s);
      }
    }

    this.scrTexture!.update();
  }

  /** 创建墙壁精灵（Layer 1 + Layer 2，位置固定，只创建一次） */
  private createWallSprites(): void {
    this.destroyWallSprites();
    const map = this.mapData;
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;
    const s = INDOOR_SCALE;

    const building = map.building;
    const heightMap = map.surfaceHeight;

    // 从 surface 层计算统一的屋顶高度（取最大 yoff，确保覆盖最高墙体）
    let roofYoff = 0;
    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        const sId = map.surface[r][c];
        if (sId !== 0) {
          const sOff = this.smapOffsets.get(sId);
          if (sOff && sOff.yoff > roofYoff) roofYoff = sOff.yoff;
        }
      }
    }
    // 多下移 20px 让屋顶与墙顶重叠，消除视觉间隙（缩放后也要乘 scale）
    const roofOverlap = 20 * s;
    const roofOffset = roofYoff * s - roofOverlap;
    console.log(`[MapRenderer] roofYoff=${roofYoff}, roofOffset=${roofOffset}, scale=${s}`);

    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        const sx = TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx;
        const sy = TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy;
        const d4 = heightMap ? (heightMap[row]?.[col] ?? 0) : 0;

        // 先查询 building 层该位置是否有瓦片（用于判断 surface 是否需要跳过）
        const bId = building ? (building[row]?.[col] ?? 0) : 0;

        // Layer 1 — surface (walls, furniture)
        const tileId = map.surface[row][col];
        // 如果同一位置 building 层也有相同瓦片（前景墙），跳过 surface 精灵
        // building 层会用 depth +0.5 渲染在玩家上面
        if (tileId !== 0 && !(bId !== 0 && tileId === bId)) {
          const texKey = `smap_${tileId}`;
          if (this.scene.textures.exists(texKey)) {
            const off = this.smapOffsets.get(tileId);
            const ox = off ? off.xoff * s : TILE_HALF_W * s;
            const oy = off ? off.yoff * s : 17 * s;

            const img = this.scene.add.image(sx - ox, sy - oy - d4 * s, texKey)
              .setOrigin(0, 0)
              .setScale(s)
              .setDepth(col + row);
            this.indoorContainer!.add(img);
            this.wallSprites.push(img);
          }
        }

        // Layer 2 — building (屋顶 或 前景墙遮挡)
        // yoff > 30 → 前景墙（如底边墙角），不应用 roofOffset，不参与透明度
        // yoff ≤ 30 → 屋顶，应用 roofOffset，参与动态透明度
        if (bId !== 0) {
          const texKey = `smap_${bId}`;
          if (this.scene.textures.exists(texKey)) {
            const off = this.smapOffsets.get(bId);
            const ox = off ? off.xoff * s : TILE_HALF_W * s;
            const oy = off ? off.yoff * s : 17 * s;
            const isWallOverlay = off ? off.yoff > 30 : false;
            const yOffset = isWallOverlay ? 0 : roofOffset;

            const img = this.scene.add.image(sx - ox, sy - oy - d4 * s - yOffset, texKey)
              .setOrigin(0, 0)
              .setScale(s)
              .setDepth(col + row + 0.5)
              .setAlpha(1.0);

            this.indoorContainer!.add(img);
            this.wallSprites.push(img);
            if (!isWallOverlay) {
              this.roofSprites.push(img);
              this.roofGridPos.push({ col, row });
            }
          }
        }
      }
    }

    console.log(`[MapRenderer] Total sprites: ${this.wallSprites.length}, roof: ${this.roofSprites.length}`);
  }

  /** 更新室内容器位置，让房间跟随玩家滚动 */
  updateIndoorCamera(playerCol: number, playerRow: number): void {
    if (!this.indoorContainer) return;
    const s = INDOOR_SCALE;
    const cx = this.indoorCx;
    const cy = this.indoorCy;

    // 玩家偏离房间中心的像素偏移
    const dx = TILE_HALF_W * s * ((playerCol - cx) - (playerRow - cy));
    const dy = TILE_HALF_H * s * ((playerCol - cx) + (playerRow - cy));

    // 容器反向移动，使玩家始终在屏幕中心
    this.indoorContainer.setPosition(-dx, -dy);

    // 按 depth 排序子对象（Phaser Container 默认按插入顺序渲染，不自动排序）
    this.indoorContainer.sort('depth');
  }

  /** 根据玩家位置动态更新屋顶透明度 */
  updateRoofVisibility(playerCol: number, playerRow: number): void {
    const REVEAL_RADIUS = 4;
    const MIN_ALPHA = 0.15;

    for (let i = 0; i < this.roofSprites.length; i++) {
      const { col, row } = this.roofGridPos[i];
      const dist = Math.max(Math.abs(col - playerCol), Math.abs(row - playerRow));
      let alpha = 1.0;
      if (dist <= REVEAL_RADIUS) {
        alpha = MIN_ALPHA + (1 - MIN_ALPHA) * (dist / REVEAL_RADIUS);
      }
      this.roofSprites[i].setAlpha(alpha);
    }
  }

  private destroyWallSprites(): void {
    for (const s of this.wallSprites) s.destroy();
    this.wallSprites = [];
    this.roofSprites = [];
    this.roofGridPos = [];
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

  private drawSmapTileOnCtx(ctx: CanvasRenderingContext2D, tileId: number, sx: number, sy: number, scale: number = 1): void {
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
    const ox = (off ? off.xoff : TILE_HALF_W) * scale;
    const oy = (off ? off.yoff : 17) * scale;
    const sw = (imgSource.width as number) * scale;
    const sh = (imgSource.height as number) * scale;

    ctx.drawImage(
      imgSource,
      0, 0, imgSource.width as number, imgSource.height as number,
      sx - ox, sy - oy, sw, sh,
    );
  }
}
