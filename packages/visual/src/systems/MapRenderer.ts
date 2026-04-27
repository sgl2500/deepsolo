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
import {
  getIndoorFurnitureDefs,
  toActualIndoorBounds,
  toActualIndoorMapPosition,
  toLocalIndoorMapPosition,
  type IndoorFurnitureDef,
} from '../content/IndoorFurnitureLayout';

const BCY = BUFFER_HEIGHT / 2;
const BCX = BUFFER_WIDTH / 2;
const CUSTOM_SMAP_OFFSETS: Record<number, { xoff: number; yoff: number }> = {
  9501: { xoff: 20, yoff: 64 },
  9502: { xoff: 24, yoff: 33 },
  9503: { xoff: 12, yoff: 46 },
  9510: { xoff: 18, yoff: 17 },
  9511: { xoff: 18, yoff: 17 },
  9512: { xoff: 18, yoff: 17 },
  9513: { xoff: 18, yoff: 17 },
  9514: { xoff: 18, yoff: 17 },
  9515: { xoff: 18, yoff: 17 },
  9520: { xoff: 18, yoff: 46 },
  9521: { xoff: 18, yoff: 46 },
  9522: { xoff: 18, yoff: 46 },
  9523: { xoff: 18, yoff: 64 },
  9524: { xoff: 18, yoff: 64 },
  9525: { xoff: 18, yoff: 64 },
  9526: { xoff: 18, yoff: 34 },
  9527: { xoff: 18, yoff: 34 },
  9528: { xoff: 18, yoff: 28 },
  9529: { xoff: 18, yoff: 54 },
  9530: { xoff: 18, yoff: 54 },
  9531: { xoff: 18, yoff: 46 },
  9532: { xoff: 18, yoff: 46 },
  9533: { xoff: 18, yoff: 23 },
  9534: { xoff: 18, yoff: 24 },
};

type FurnitureEditorHandleKind = 'anchor' | 'depth' | 'nw' | 'ne' | 'se' | 'sw';

type FurnitureEditorDrag = {
  furniture: IndoorFurnitureDef;
  kind: FurnitureEditorHandleKind;
};

type IndoorDecorDef = {
  textureKey: string;
  mapX: number;
  mapY: number;
  offsetX?: number;
  offsetY?: number;
  depthBias?: number;
  scale?: number;
  alpha?: number;
};

type IndoorFixedVisualDef = {
  textureKey: string;
  localX: number;
  localY: number;
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
  depthLocalX?: number;
  depthLocalY?: number;
  depthBias?: number;
};

type IndoorFixedFloorTilesDef = {
  textureKeys: string[];
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

type IndoorFixedWallTilesDef = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  doorColStart?: number;
  doorColEnd?: number;
};

type IndoorFixedRoomDef = {
  skipTilemap: boolean;
  floorTiles?: IndoorFixedFloorTilesDef;
  wallTiles?: IndoorFixedWallTilesDef;
  visuals: IndoorFixedVisualDef[];
};

const INDOOR_DECOR_LAYOUTS: Record<string, IndoorDecorDef[]> = {
};

const INDOOR_FIXED_ROOM_LAYOUTS: Record<string, IndoorFixedRoomDef> = {
  birth_house: {
    skipTilemap: true,
    floorTiles: {
      textureKeys: ['smap_66'],
      rowStart: 3,
      rowEnd: 22,
      colStart: 3,
      colEnd: 22,
    },
    wallTiles: {
      rowStart: 3,
      rowEnd: 22,
      colStart: 3,
      colEnd: 22,
      doorColStart: 12,
      doorColEnd: 13,
    },
    visuals: [],
  },
};

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
  // 自定义室内装饰层（用于出生小屋样板）
  private indoorDecorSprites: Phaser.GameObjects.Image[] = [];
  private indoorFurnitureSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private indoorDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private indoorDebugTexts: Phaser.GameObjects.Text[] = [];
  private furnitureEditorActive = false;
  private furnitureEditorSelectedId: string | null = null;
  private furnitureEditorDrag: FurnitureEditorDrag | null = null;
  private furnitureEditorHelpText: Phaser.GameObjects.Text | null = null;
  // 室内房间中心
  private indoorCx = 0;
  private indoorCy = 0;
  // 室内独立地板 Canvas（容纳完整菱形，不影响世界地图 scrCanvas）
  private indoorFloorCanvas: HTMLCanvasElement | null = null;
  private indoorFloorCtx: CanvasRenderingContext2D | null = null;
  private indoorFloorImage: Phaser.GameObjects.Image | null = null;
  private indoorAssetLoadPromise: Promise<void> | null = null;
  private currentIndoorBuildingId: string | null = null;

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

    this.scene.input.on('pointerdown', this.onFurnitureEditorPointerDown, this);
    this.scene.input.on('pointermove', this.onFurnitureEditorPointerMove, this);
    this.scene.input.on('pointerup', this.onFurnitureEditorPointerUp, this);
  }

  init(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;

    const tex = this.scene.textures.addCanvas('scrCanvas', this.scrCanvas);
    this.scrTexture = tex as Phaser.Textures.CanvasTexture;
    this.scrImage = this.scene.add.image(0, 0, 'scrCanvas').setOrigin(0, 0).setDepth(0).setScrollFactor(0);
  }

  /** 切换到室内地图 */
  switchToIndoor(mapData: MapData, buildingId?: string): void {
    this.mapData = mapData;
    this.isIndoor = true;
    this.atlasImg = null;
    this.indoorCx = mapData.cx;
    this.indoorCy = mapData.cy;
    this.currentIndoorBuildingId = buildingId ?? null;

    // 创建室内容器，用于整体跟随玩家滚动
    this.indoorContainer = this.scene.add.container(0, 0);

    // 隐藏世界地图 Canvas（室内用独立地板 Canvas）
    this.scrImage.setVisible(false);

    // 计算能容纳完整菱形的独立 Canvas 尺寸
    const s = INDOOR_SCALE;
    const extent = Math.max(mapData.width, mapData.height) - 1;
    const canvasW = extent * TILE_HALF_W * s * 2 + 36 * s;
    const canvasH = extent * TILE_HALF_H * s * 2 + 18 * s;
    this.indoorFloorCanvas = document.createElement('canvas');
    this.indoorFloorCanvas.width = canvasW;
    this.indoorFloorCanvas.height = canvasH;
    this.indoorFloorCtx = this.indoorFloorCanvas.getContext('2d')!;

    // 加载 smap 偏移
    this.smapOffsets.clear();
    const info = this.scene.cache.json.get('smap_info');
    if (Array.isArray(info)) {
      for (const t of info) {
        this.smapOffsets.set(t.idx, { xoff: t.xoff, yoff: t.yoff });
      }
    }
    for (const [tileId, offset] of Object.entries(CUSTOM_SMAP_OFFSETS)) {
      this.smapOffsets.set(Number(tileId), offset);
    }

    // 渲染地板到独立 Canvas
    this.renderIndoorFloor();

    // 创建室内地板纹理和 Image，定位使菱形中心与墙壁精灵对齐
    const texKey = '__indoorFloor';
    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey);
    }
    this.scene.textures.addCanvas(texKey, this.indoorFloorCanvas);
    const imgX = SCREEN_WIDTH / 2 - canvasW / 2;
    const imgY = SCREEN_HEIGHT / 2 - canvasH / 2;
    this.indoorFloorImage = this.scene.add.image(imgX, imgY, texKey)
      .setOrigin(0, 0)
      .setDepth(0);
    this.indoorContainer.add(this.indoorFloorImage);

    // 创建墙壁精灵
    this.createWallSprites();
    this.createIndoorDecorSprites();
  }

  /** 确保当前室内地图依赖的 smap 贴图已加载 */
  ensureIndoorAssets(mapData: MapData): Promise<void> {
    const requiredIds = new Set<number>();
    const layers: Array<number[][] | undefined> = [mapData.earth, mapData.surface, mapData.building];

    for (const layer of layers) {
      if (!layer) continue;
      for (const row of layer) {
        for (const tileId of row) {
          if (tileId > 0) requiredIds.add(tileId);
        }
      }
    }

    const missing = Array.from(requiredIds).filter((tileId) => !this.scene.textures.exists(`smap_${tileId}`));
    if (missing.length === 0) {
      return Promise.resolve();
    }

    if (this.indoorAssetLoadPromise) {
      return this.indoorAssetLoadPromise;
    }

    this.indoorAssetLoadPromise = new Promise((resolve) => {
      const loader = this.scene.load;
      const queuedKeys = new Set(loader.list.getArray().map((file) => file.key));
      const uniqueMissing = missing.filter((tileId) => !queuedKeys.has(`smap_${tileId}`));

      if (uniqueMissing.length === 0) {
        this.indoorAssetLoadPromise = null;
        resolve();
        return;
      }

      loader.once(Phaser.Loader.Events.COMPLETE, () => {
        this.indoorAssetLoadPromise = null;
        resolve();
      });

      for (const tileId of uniqueMissing) {
        const padded = String(tileId).padStart(4, '0');
        loader.image(`smap_${tileId}`, `assets/jy-assets/10_smap/${padded}.png`);
      }

      loader.start();
    });

    return this.indoorAssetLoadPromise;
  }

  /** 切换回世界地图 */
  switchToWorld(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;
    this.isIndoor = false;
    this.atlasImg = null;
    this.destroyWallSprites();

    // 清理室内地板 Canvas/纹理
    if (this.indoorFloorImage) {
      this.indoorFloorImage.destroy();
      this.indoorFloorImage = null;
    }
    if (this.scene.textures.exists('__indoorFloor')) {
      this.scene.textures.remove('__indoorFloor');
    }
    this.indoorFloorCanvas = null;
    this.indoorFloorCtx = null;
    this.currentIndoorBuildingId = null;
    this.destroyIndoorDecorSprites();
    this.destroyIndoorDebugOverlay();
    this.setFurnitureEditorActive(false);

    // 把容器中的子对象（玩家、NPC）移回场景，然后销毁容器
    if (this.indoorContainer) {
      const children = this.indoorContainer.getAll();
      for (const child of children) {
        this.indoorContainer!.remove(child);
        this.scene.add.existing(child as Phaser.GameObjects.GameObject);
      }

      this.indoorContainer.destroy();
      this.indoorContainer = null;
    }

    // 恢复世界地图 Canvas
    this.scrImage.setVisible(true);
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

  private get currentFixedRoomLayout(): IndoorFixedRoomDef | null {
    if (!this.currentIndoorBuildingId) return null;
    return INDOOR_FIXED_ROOM_LAYOUTS[this.currentIndoorBuildingId] ?? null;
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

  toggleFurnitureEditor(): void {
    this.setFurnitureEditorActive(!this.furnitureEditorActive);
  }

  setFurnitureEditorActive(active: boolean): void {
    this.furnitureEditorActive = active && this.isIndoor && !!this.currentIndoorBuildingId;
    if (this.furnitureEditorActive && !this.furnitureEditorSelectedId) {
      this.furnitureEditorSelectedId = getIndoorFurnitureDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
    }
    if (!this.furnitureEditorActive) {
      this.furnitureEditorDrag = null;
      this.destroyIndoorDebugOverlay();
    } else {
      this.createIndoorDebugOverlay();
      this.updateIndoorDebugOverlay(0, 0);
    }
    this.updateFurnitureEditorHelpText();
  }

  exportFurnitureEditorLayout(): string {
    const layout = getIndoorFurnitureDefs(this.currentIndoorBuildingId).map((item) => ({
      ...item,
      collider: item.collider ? { ...item.collider } : undefined,
    }));
    const json = JSON.stringify(layout, null, 2);
    navigator.clipboard?.writeText(json).catch(() => undefined);
    console.log('[FurnitureEditor] Exported layout:', json);
    this.showFurnitureEditorMessage('家具配置已导出到剪贴板和 console');
    return json;
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

  /** 渲染地板到室内独立 Canvas（静态背景） */
  private renderIndoorFloor(): void {
    const canvas = this.indoorFloorCanvas!;
    const ctx = this.indoorFloorCtx!;
    const fixedRoom = this.currentFixedRoomLayout;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (fixedRoom?.floorTiles) {
      this.renderFixedRoomFloorTiles(ctx, canvas, fixedRoom.floorTiles);
      return;
    }

    if (fixedRoom?.skipTilemap) {
      return;
    }

    const map = this.mapData;
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = canvas.width / 2;
    const scrCy = canvas.height / 2;
    const s = INDOOR_SCALE;

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
  }

  private renderFixedRoomFloorTiles(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    floorTiles: IndoorFixedFloorTilesDef,
  ): void {
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = canvas.width / 2;
    const scrCy = canvas.height / 2;
    const s = INDOOR_SCALE;

    for (let row = floorTiles.rowStart; row <= floorTiles.rowEnd; row++) {
      for (let col = floorTiles.colStart; col <= floorTiles.colEnd; col++) {
        const variantIndex = this.pickFixedFloorTileVariant(row, col, floorTiles.textureKeys.length);
        const textureKey = floorTiles.textureKeys[variantIndex];
        if (!this.scene.textures.exists(textureKey)) continue;

        const sx = TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx;
        const sy = TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy;
        if (textureKey.startsWith('smap_')) {
          this.drawSmapTileOnCtx(ctx, Number(textureKey.slice(5)), sx, sy, s);
        } else {
          this.drawFixedTextureOnCtx(ctx, textureKey, sx, sy);
        }
      }
    }
  }

  private pickFixedFloorTileVariant(row: number, col: number, variantCount: number): number {
    if (variantCount <= 1) return 0;

    const seed = (row * 17 + col * 31) % 16;
    if (seed === 13 && variantCount > 2) return 2;
    if ((seed === 1 || seed === 9) && variantCount > 1) return 1;
    if (seed === 0 || seed === 5) return 0;
    return Math.min(variantCount - 1, 3);
  }

  /** 创建墙壁精灵（Layer 1 + Layer 2，位置固定，只创建一次） */
  private createWallSprites(): void {
    this.destroyWallSprites();
    const fixedRoom = this.currentFixedRoomLayout;
    if (fixedRoom) {
      if (fixedRoom.wallTiles) {
        this.createFixedRoomWallSprites(fixedRoom.wallTiles);
      }
      return;
    }

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

  private createFixedRoomWallSprites(wallTiles: IndoorFixedWallTilesDef): void {
    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;
    const s = INDOOR_SCALE;

    const addWallTile = (tileId: number, col: number, row: number, depthBias = 0): void => {
      const texKey = `smap_${tileId}`;
      if (!this.scene.textures.exists(texKey)) return;

      const sx = TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx;
      const sy = TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy;
      const off = this.smapOffsets.get(tileId);
      const ox = off ? off.xoff * s : TILE_HALF_W * s;
      const oy = off ? off.yoff * s : 17 * s;

      const img = this.scene.add.image(sx - ox, sy - oy, texKey)
        .setOrigin(0, 0)
        .setScale(s)
        .setDepth(col + row + depthBias);

      this.indoorContainer!.add(img);
      this.wallSprites.push(img);
    };

    // 0836-0848 是一组有方向的墙瓦片：0845/0847 是后墙角，0838 是后墙横段，0837 是侧墙，0846/0848 是前景角，0839 是前景横段。
    // 0836/0840/0841/0843/0844 看起来是特殊朝向/破损端头，不适合混在连续边里。
    for (let col = wallTiles.colStart; col <= wallTiles.colEnd; col++) {
      const topTile = col === wallTiles.colStart
        ? 845
        : col === wallTiles.colEnd
          ? 847
          : 838;
      addWallTile(topTile, col, wallTiles.rowStart);
    }

    for (let row = wallTiles.rowStart + 1; row < wallTiles.rowEnd; row++) {
      addWallTile(837, wallTiles.colStart, row);
      addWallTile(837, wallTiles.colEnd, row);
    }

    for (let col = wallTiles.colStart; col <= wallTiles.colEnd; col++) {
      if (col >= (wallTiles.doorColStart ?? Infinity) && col <= (wallTiles.doorColEnd ?? -Infinity)) {
        continue;
      }

      const bottomTile = col === wallTiles.colStart
        ? 846
        : col === wallTiles.colEnd
          ? 848
          : 839;
      addWallTile(bottomTile, col, wallTiles.rowEnd, 0.5);
    }
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

    if (this.furnitureEditorActive) {
      this.updateIndoorDebugOverlay(playerCol, playerRow);
    }
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

  private createIndoorDecorSprites(): void {
    this.destroyIndoorDecorSprites();
    if (!this.indoorContainer || !this.currentIndoorBuildingId) return;

    const fixedRoom = this.currentFixedRoomLayout;
    if (fixedRoom) {
      for (const visual of [
        ...fixedRoom.visuals,
        ...getIndoorFurnitureDefs(this.currentIndoorBuildingId),
      ]) {
        if (!this.scene.textures.exists(visual.textureKey)) continue;
        if (!this.currentIndoorBuildingId) continue;

        const { mapX, mapY } = toActualIndoorMapPosition(
          this.currentIndoorBuildingId,
          visual.localX,
          visual.localY,
        );
        const depthPosition = toActualIndoorMapPosition(
          this.currentIndoorBuildingId,
          visual.depthLocalX ?? visual.localX,
          visual.depthLocalY ?? visual.localY,
        );
        const x = TILE_HALF_W * INDOOR_SCALE * ((mapX - this.indoorCx) - (mapY - this.indoorCy)) + SCREEN_WIDTH / 2 + (visual.pixelOffsetX ?? 0);
        const y = TILE_HALF_H * INDOOR_SCALE * ((mapX - this.indoorCx) + (mapY - this.indoorCy)) + SCREEN_HEIGHT / 2 + (visual.pixelOffsetY ?? 0);

        const img = this.scene.add.image(x, y, visual.textureKey)
          .setOrigin(visual.originX ?? 0.5, visual.originY ?? 1)
          .setScale(visual.scale ?? 1)
          .setAlpha(visual.alpha ?? 1)
          .setDepth(depthPosition.mapX + depthPosition.mapY + (visual.depthBias ?? 0));

        this.indoorContainer.add(img);
        this.indoorDecorSprites.push(img);
        const maybeFurniture = visual as IndoorFurnitureDef;
        if (typeof maybeFurniture.id === 'string') {
          this.indoorFurnitureSprites.set(maybeFurniture.id, img);
        }
      }
      return;
    }

    const layout = INDOOR_DECOR_LAYOUTS[this.currentIndoorBuildingId];
    if (!layout) return;

    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;
    const s = INDOOR_SCALE;

    for (const decor of layout) {
      if (!this.scene.textures.exists(decor.textureKey)) continue;

      const sx = TILE_HALF_W * s * ((decor.mapX - cx) - (decor.mapY - cy)) + scrCx + (decor.offsetX ?? 0);
      const sy = TILE_HALF_H * s * ((decor.mapX - cx) + (decor.mapY - cy)) + scrCy + (decor.offsetY ?? 0);
      const img = this.scene.add.image(sx, sy, decor.textureKey)
        .setOrigin(0.5, 1)
        .setScale(decor.scale ?? 1)
        .setAlpha(decor.alpha ?? 1)
        .setDepth(decor.mapX + decor.mapY + (decor.depthBias ?? 0));

      this.indoorContainer.add(img);
      this.indoorDecorSprites.push(img);
    }
  }

  private destroyIndoorDecorSprites(): void {
    for (const sprite of this.indoorDecorSprites) sprite.destroy();
    this.indoorDecorSprites = [];
    this.indoorFurnitureSprites.clear();
  }

  private createIndoorDebugOverlay(): void {
    this.destroyIndoorDebugOverlay();
    if (!this.indoorContainer || !this.currentIndoorBuildingId) return;

    this.indoorDebugGraphics = this.scene.add.graphics().setDepth(10000);
    this.indoorContainer.add(this.indoorDebugGraphics);

    const fixedRoom = this.currentFixedRoomLayout;
    const floorTiles = fixedRoom?.floorTiles;
    if (!floorTiles) return;

    for (let row = floorTiles.rowStart; row <= floorTiles.rowEnd; row++) {
      for (let col = floorTiles.colStart; col <= floorTiles.colEnd; col++) {
        if ((row + col) % 2 !== 0) continue;
        const { x, y } = this.indoorMapToScreen(col, row);
        const text = this.scene.add.text(x, y - 6, `${col},${row}`, {
          fontSize: '8px',
          color: '#fbbf24',
          stroke: '#000000',
          strokeThickness: 2,
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(10001);
        this.indoorContainer.add(text);
        this.indoorDebugTexts.push(text);
      }
    }
  }

  private updateIndoorDebugOverlay(playerCol: number, playerRow: number): void {
    if (!this.indoorDebugGraphics || !this.currentIndoorBuildingId) return;

    const g = this.indoorDebugGraphics;
    g.clear();

    const fixedRoom = this.currentFixedRoomLayout;
    const floorTiles = fixedRoom?.floorTiles;
    if (floorTiles) {
      g.lineStyle(1, 0x60a5fa, 0.22);
      for (let row = floorTiles.rowStart; row <= floorTiles.rowEnd; row++) {
        for (let col = floorTiles.colStart; col <= floorTiles.colEnd; col++) {
          this.strokeIndoorDiamond(g, col, row, 0x60a5fa, 0.22);
        }
      }
    }

    for (const furniture of getIndoorFurnitureDefs(this.currentIndoorBuildingId)) {
      if (!furniture.collider) continue;

      const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, furniture.collider);
      this.strokeIndoorRectBounds(g, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0xff5555, 0.85);

      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, furniture.localX, furniture.localY);
      const anchorScreen = this.indoorMapToScreen(anchor.mapX, anchor.mapY);
      g.fillStyle(0xffdd55, 1);
      g.fillCircle(anchorScreen.x, anchorScreen.y, 3);

      const depthPoint = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        furniture.depthLocalX ?? furniture.localX,
        furniture.depthLocalY ?? furniture.localY,
      );
      const depthScreen = this.indoorMapToScreen(depthPoint.mapX, depthPoint.mapY);
      g.fillStyle(0xff55ff, 1);
      g.fillCircle(depthScreen.x, depthScreen.y, 3);
    }

    const playerScreen = this.indoorMapToScreen(playerCol, playerRow);
    g.fillStyle(0x00ff66, 1);
    g.fillCircle(playerScreen.x, playerScreen.y, 4);
    g.lineStyle(1, 0x00ff66, 1);
    g.strokeCircle(playerScreen.x, playerScreen.y, 8);
  }

  private destroyIndoorDebugOverlay(): void {
    this.indoorDebugGraphics?.destroy();
    this.indoorDebugGraphics = null;
    for (const text of this.indoorDebugTexts) text.destroy();
    this.indoorDebugTexts = [];
  }

  private onFurnitureEditorPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId || !this.indoorContainer) return;

    const handle = this.findFurnitureEditorHandle(pointer.x, pointer.y);
    if (!handle) return;

    this.furnitureEditorSelectedId = handle.furniture.id;
    this.furnitureEditorDrag = handle;
    this.updateFurnitureEditorHelpText();
  }

  private onFurnitureEditorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.furnitureEditorActive || !this.furnitureEditorDrag || !this.currentIndoorBuildingId) return;

    const localPos = this.screenToIndoorLocal(pointer.x, pointer.y);
    if (!localPos) return;

    const { furniture, kind } = this.furnitureEditorDrag;
    const nextX = this.roundEditorValue(localPos.localX);
    const nextY = this.roundEditorValue(localPos.localY);

    if (kind === 'anchor') {
      const dx = nextX - furniture.localX;
      const dy = nextY - furniture.localY;
      furniture.localX = nextX;
      furniture.localY = nextY;

      if (furniture.collider) {
        furniture.collider.minLocalX = this.roundEditorValue(furniture.collider.minLocalX + dx);
        furniture.collider.maxLocalX = this.roundEditorValue(furniture.collider.maxLocalX + dx);
        furniture.collider.minLocalY = this.roundEditorValue(furniture.collider.minLocalY + dy);
        furniture.collider.maxLocalY = this.roundEditorValue(furniture.collider.maxLocalY + dy);
      }
      if (furniture.depthLocalX !== undefined) furniture.depthLocalX = this.roundEditorValue(furniture.depthLocalX + dx);
      if (furniture.depthLocalY !== undefined) furniture.depthLocalY = this.roundEditorValue(furniture.depthLocalY + dy);
    } else if (kind === 'depth') {
      furniture.depthLocalX = nextX;
      furniture.depthLocalY = nextY;
    } else {
      if (!furniture.collider) {
        furniture.collider = {
          minLocalX: furniture.localX - 0.5,
          maxLocalX: furniture.localX + 0.5,
          minLocalY: furniture.localY - 0.5,
          maxLocalY: furniture.localY + 0.5,
        };
      }

      if (kind === 'nw' || kind === 'sw') furniture.collider.minLocalX = nextX;
      if (kind === 'ne' || kind === 'se') furniture.collider.maxLocalX = nextX;
      if (kind === 'nw' || kind === 'ne') furniture.collider.minLocalY = nextY;
      if (kind === 'sw' || kind === 'se') furniture.collider.maxLocalY = nextY;
      this.normalizeFurnitureCollider(furniture);
    }

    this.updateFurnitureSprite(furniture);
    this.updateFurnitureEditorHelpText();
  }

  private onFurnitureEditorPointerUp(): void {
    this.furnitureEditorDrag = null;
  }

  private findFurnitureEditorHandle(screenX: number, screenY: number): FurnitureEditorDrag | null {
    if (!this.currentIndoorBuildingId) return null;

    const handles: Array<FurnitureEditorDrag & { x: number; y: number }> = [];
    for (const furniture of getIndoorFurnitureDefs(this.currentIndoorBuildingId)) {
      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, furniture.localX, furniture.localY);
      const anchorScreen = this.indoorMapToScreenWithContainer(anchor.mapX, anchor.mapY);
      handles.push({ furniture, kind: 'anchor', x: anchorScreen.x, y: anchorScreen.y });

      const depth = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        furniture.depthLocalX ?? furniture.localX,
        furniture.depthLocalY ?? furniture.localY,
      );
      const depthScreen = this.indoorMapToScreenWithContainer(depth.mapX, depth.mapY);
      handles.push({ furniture, kind: 'depth', x: depthScreen.x, y: depthScreen.y });

      if (furniture.collider) {
        const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, furniture.collider);
        const corners: Array<{ kind: FurnitureEditorHandleKind; x: number; y: number }> = [
          { kind: 'nw', ...this.indoorMapToScreenWithContainer(bounds.minX, bounds.minY) },
          { kind: 'ne', ...this.indoorMapToScreenWithContainer(bounds.maxX, bounds.minY) },
          { kind: 'se', ...this.indoorMapToScreenWithContainer(bounds.maxX, bounds.maxY) },
          { kind: 'sw', ...this.indoorMapToScreenWithContainer(bounds.minX, bounds.maxY) },
        ];
        for (const corner of corners) handles.push({ furniture, ...corner });
      }
    }

    let best: (FurnitureEditorDrag & { x: number; y: number }) | null = null;
    let bestDistance = Infinity;
    for (const handle of handles) {
      const distance = Math.hypot(handle.x - screenX, handle.y - screenY);
      if (distance < bestDistance) {
        best = handle;
        bestDistance = distance;
      }
    }

    if (!best || bestDistance > 16) return null;
    return { furniture: best.furniture, kind: best.kind };
  }

  private updateFurnitureSprite(furniture: IndoorFurnitureDef): void {
    if (!this.currentIndoorBuildingId) return;
    const sprite = this.indoorFurnitureSprites.get(furniture.id);
    if (!sprite) return;

    const { mapX, mapY } = toActualIndoorMapPosition(
      this.currentIndoorBuildingId,
      furniture.localX,
      furniture.localY,
    );
    const depthPosition = toActualIndoorMapPosition(
      this.currentIndoorBuildingId,
      furniture.depthLocalX ?? furniture.localX,
      furniture.depthLocalY ?? furniture.localY,
    );
    const position = this.indoorMapToScreen(mapX, mapY);
    sprite
      .setPosition(
        position.x + (furniture.pixelOffsetX ?? 0),
        position.y + (furniture.pixelOffsetY ?? 0),
      )
      .setDepth(depthPosition.mapX + depthPosition.mapY + (furniture.depthBias ?? 0));
  }

  private updateFurnitureEditorHelpText(): void {
    if (!this.furnitureEditorActive) {
      this.furnitureEditorHelpText?.destroy();
      this.furnitureEditorHelpText = null;
      return;
    }

    if (!this.furnitureEditorHelpText) {
      this.furnitureEditorHelpText = this.scene.add.text(12, 42, '', {
        fontSize: '12px',
        color: '#e5e7eb',
        backgroundColor: 'rgba(17,24,39,0.88)',
        padding: { x: 8, y: 6 },
        fontFamily: 'monospace',
      }).setDepth(20000).setScrollFactor(0);
    }

    const selected = getIndoorFurnitureDefs(this.currentIndoorBuildingId)
      .find((item) => item.id === this.furnitureEditorSelectedId);
    const selectedText = selected
      ? [
          `selected: ${selected.id}`,
          `local: ${selected.localX.toFixed(1)}, ${selected.localY.toFixed(1)}`,
          `depth: ${(selected.depthLocalX ?? selected.localX).toFixed(1)}, ${(selected.depthLocalY ?? selected.localY).toFixed(1)}`,
          selected.collider
            ? `collider: ${selected.collider.minLocalX.toFixed(1)},${selected.collider.minLocalY.toFixed(1)} -> ${selected.collider.maxLocalX.toFixed(1)},${selected.collider.maxLocalY.toFixed(1)}`
            : 'collider: none',
        ].join('\n')
      : 'selected: none';

    this.furnitureEditorHelpText.setText([
      'Furniture Editor ON',
      'drag yellow=anchor, purple=depth, red corners=collider',
      'F2 toggle, F4 export JSON',
      selectedText,
    ].join('\n'));
  }

  private showFurnitureEditorMessage(message: string): void {
    if (!this.furnitureEditorHelpText) return;
    const previous = this.furnitureEditorHelpText.text;
    this.furnitureEditorHelpText.setText(`${previous}\n${message}`);
    this.scene.time.delayedCall(1400, () => this.updateFurnitureEditorHelpText());
  }

  private screenToIndoorLocal(screenX: number, screenY: number): { localX: number; localY: number } | null {
    if (!this.indoorContainer || !this.currentIndoorBuildingId) return null;
    const map = this.screenToIndoorMap(screenX - this.indoorContainer.x, screenY - this.indoorContainer.y);
    return toLocalIndoorMapPosition(this.currentIndoorBuildingId, map.mapX, map.mapY);
  }

  private screenToIndoorMap(screenX: number, screenY: number): { mapX: number; mapY: number } {
    const dx = (screenX - SCREEN_WIDTH / 2) / (TILE_HALF_W * INDOOR_SCALE);
    const dy = (screenY - SCREEN_HEIGHT / 2) / (TILE_HALF_H * INDOOR_SCALE);
    return {
      mapX: this.indoorCx + (dx + dy) / 2,
      mapY: this.indoorCy + (dy - dx) / 2,
    };
  }

  private indoorMapToScreenWithContainer(col: number, row: number): { x: number; y: number } {
    const point = this.indoorMapToScreen(col, row);
    return {
      x: point.x + (this.indoorContainer?.x ?? 0),
      y: point.y + (this.indoorContainer?.y ?? 0),
    };
  }

  private normalizeFurnitureCollider(furniture: IndoorFurnitureDef): void {
    if (!furniture.collider) return;
    const minX = Math.min(furniture.collider.minLocalX, furniture.collider.maxLocalX);
    const maxX = Math.max(furniture.collider.minLocalX, furniture.collider.maxLocalX);
    const minY = Math.min(furniture.collider.minLocalY, furniture.collider.maxLocalY);
    const maxY = Math.max(furniture.collider.minLocalY, furniture.collider.maxLocalY);
    furniture.collider.minLocalX = this.roundEditorValue(minX);
    furniture.collider.maxLocalX = this.roundEditorValue(maxX);
    furniture.collider.minLocalY = this.roundEditorValue(minY);
    furniture.collider.maxLocalY = this.roundEditorValue(maxY);
  }

  private roundEditorValue(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private indoorMapToScreen(col: number, row: number): { x: number; y: number } {
    const s = INDOOR_SCALE;
    return {
      x: TILE_HALF_W * s * ((col - this.indoorCx) - (row - this.indoorCy)) + SCREEN_WIDTH / 2,
      y: TILE_HALF_H * s * ((col - this.indoorCx) + (row - this.indoorCy)) + SCREEN_HEIGHT / 2,
    };
  }

  private strokeIndoorDiamond(
    g: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    color: number,
    alpha: number,
  ): void {
    const center = this.indoorMapToScreen(col, row);
    const hw = TILE_HALF_W * INDOOR_SCALE;
    const hh = TILE_HALF_H * INDOOR_SCALE;
    g.lineStyle(1, color, alpha);
    g.beginPath();
    g.moveTo(center.x, center.y - hh);
    g.lineTo(center.x + hw, center.y);
    g.lineTo(center.x, center.y + hh);
    g.lineTo(center.x - hw, center.y);
    g.closePath();
    g.strokePath();
  }

  private strokeIndoorRectBounds(
    g: Phaser.GameObjects.Graphics,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    color: number,
    alpha: number,
  ): void {
    const p1 = this.indoorMapToScreen(minX, minY);
    const p2 = this.indoorMapToScreen(maxX, minY);
    const p3 = this.indoorMapToScreen(maxX, maxY);
    const p4 = this.indoorMapToScreen(minX, maxY);
    g.lineStyle(2, color, alpha);
    g.beginPath();
    g.moveTo(p1.x, p1.y);
    g.lineTo(p2.x, p2.y);
    g.lineTo(p3.x, p3.y);
    g.lineTo(p4.x, p4.y);
    g.closePath();
    g.strokePath();
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

  private drawFixedTextureOnCtx(ctx: CanvasRenderingContext2D, textureKey: string, sx: number, sy: number): void {
    if (!this.scene.textures.exists(textureKey)) return;

    const texture = this.scene.textures.get(textureKey);
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

    const sw = imgSource.width as number;
    const sh = imgSource.height as number;
    ctx.drawImage(
      imgSource,
      0, 0, sw, sh,
      sx - sw / 2, sy - sh / 2, sw, sh,
    );
  }
}
