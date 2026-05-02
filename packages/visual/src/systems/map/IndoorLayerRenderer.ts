import {
  INDOOR_SCALE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TILE_HALF_H,
  TILE_HALF_W,
} from '../../config';
import type { MapData } from '../../types';

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
  // 地砖 (dizhuan)
  9514: { xoff: 18, yoff: 17 },
  // 地毯瓦片 (ditan)
  9306: { xoff: 18, yoff: 17 },
  9307: { xoff: 18, yoff: 17 },
  9308: { xoff: 18, yoff: 17 },
  9309: { xoff: 18, yoff: 17 },
  9310: { xoff: 18, yoff: 17 },
  9311: { xoff: 18, yoff: 17 },
  9312: { xoff: 18, yoff: 17 },
  9313: { xoff: 18, yoff: 17 },
  9330: { xoff: 18, yoff: 17 },
};

export type IndoorFixedFloorTilesDef = {
  textureKeys: string[];
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

export type IndoorFixedWallTilesDef = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  doorColStart?: number;
  doorColEnd?: number;
};

export type IndoorFixedVisualDef = {
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

export type IndoorFixedRoomDef = {
  skipTilemap: boolean;
  floorTiles?: IndoorFixedFloorTilesDef;
  wallTiles?: IndoorFixedWallTilesDef;
  visuals: IndoorFixedVisualDef[];
};

export class IndoorLayerRenderer {
  private smapOffsets: Map<number, { xoff: number; yoff: number }> = new Map();
  private wallSprites: Phaser.GameObjects.GameObject[] = [];
  private roofSprites: Phaser.GameObjects.Image[] = [];
  private roofGridPos: { col: number; row: number }[] = [];
  private floorCanvas: HTMLCanvasElement | null = null;
  private floorCtx: CanvasRenderingContext2D | null = null;
  private floorImage: Phaser.GameObjects.Image | null = null;

  constructor(private scene: Phaser.Scene) {}

  create(mapData: MapData, container: Phaser.GameObjects.Container, fixedRoom: IndoorFixedRoomDef | null): void {
    this.destroy();
    this.loadSmapOffsets();

    const s = INDOOR_SCALE;
    const extent = Math.max(mapData.width, mapData.height) - 1;
    const canvasW = extent * TILE_HALF_W * s * 2 + 36 * s;
    const canvasH = extent * TILE_HALF_H * s * 2 + 18 * s;
    this.floorCanvas = document.createElement('canvas');
    this.floorCanvas.width = canvasW;
    this.floorCanvas.height = canvasH;
    this.floorCtx = this.floorCanvas.getContext('2d')!;

    this.renderFloor(mapData, fixedRoom);

    const texKey = '__indoorFloor';
    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey);
    }
    this.scene.textures.addCanvas(texKey, this.floorCanvas);
    const imgX = SCREEN_WIDTH / 2 - canvasW / 2;
    const imgY = SCREEN_HEIGHT / 2 - canvasH / 2;
    this.floorImage = this.scene.add.image(imgX, imgY, texKey)
      .setOrigin(0, 0)
      .setDepth(0);
    container.add(this.floorImage);

    this.createWallSprites(mapData, container, fixedRoom);
  }

  updateRoofVisibility(playerCol: number, playerRow: number): void {
    const revealRadius = 4;
    const minAlpha = 0.15;

    for (let i = 0; i < this.roofSprites.length; i++) {
      const { col, row } = this.roofGridPos[i];
      const dist = Math.max(Math.abs(col - playerCol), Math.abs(row - playerRow));
      let alpha = 1.0;
      if (dist <= revealRadius) {
        alpha = minAlpha + (1 - minAlpha) * (dist / revealRadius);
      }
      this.roofSprites[i].setAlpha(alpha);
    }
  }

  destroy(): void {
    for (const sprite of this.wallSprites) sprite.destroy();
    this.wallSprites = [];
    this.roofSprites = [];
    this.roofGridPos = [];

    if (this.floorImage) {
      this.floorImage.destroy();
      this.floorImage = null;
    }
    if (this.scene.textures.exists('__indoorFloor')) {
      this.scene.textures.remove('__indoorFloor');
    }
    this.floorCanvas = null;
    this.floorCtx = null;
  }

  private loadSmapOffsets(): void {
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
  }

  private renderFloor(mapData: MapData, fixedRoom: IndoorFixedRoomDef | null): void {
    const canvas = this.floorCanvas!;
    const ctx = this.floorCtx!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (fixedRoom?.floorTiles) {
      this.renderFixedRoomFloorTiles(ctx, canvas, mapData, fixedRoom.floorTiles);
      return;
    }

    if (fixedRoom?.skipTilemap) return;

    const cx = mapData.cx;
    const cy = mapData.cy;
    const scrCx = canvas.width / 2;
    const scrCy = canvas.height / 2;
    const s = INDOOR_SCALE;

    const pos = (col: number, row: number) => ({
      sx: TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx,
      sy: TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy,
    });

    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const ev = mapData.earth[row][col];
        if (ev === 0) continue;
        const { sx, sy } = pos(col, row);
        this.drawSmapTileOnCtx(ctx, ev, sx, sy, s);
      }
    }

    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const sv = mapData.surface[row][col];
        if (sv === 0 || sv === 307) continue;
        const { sx, sy } = pos(col, row);
        this.drawSmapTileOnCtx(ctx, sv, sx, sy, s);
      }
    }
  }

  private renderFixedRoomFloorTiles(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    mapData: MapData,
    floorTiles: IndoorFixedFloorTilesDef,
  ): void {
    const cx = mapData.cx;
    const cy = mapData.cy;
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

  private createWallSprites(
    mapData: MapData,
    container: Phaser.GameObjects.Container,
    fixedRoom: IndoorFixedRoomDef | null,
  ): void {
    if (fixedRoom) {
      if (fixedRoom.wallTiles) {
        this.createFixedRoomWallSprites(mapData, container, fixedRoom.wallTiles);
      }
      return;
    }

    const cx = mapData.cx;
    const cy = mapData.cy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;
    const s = INDOOR_SCALE;
    const building = mapData.building;
    const heightMap = mapData.surfaceHeight;

    let roofYoff = 0;
    for (let r = 0; r < mapData.height; r++) {
      for (let c = 0; c < mapData.width; c++) {
        const sId = mapData.surface[r][c];
        if (sId !== 0) {
          const sOff = this.smapOffsets.get(sId);
          if (sOff && sOff.yoff > roofYoff) roofYoff = sOff.yoff;
        }
      }
    }
    const roofOverlap = 20 * s;
    const roofOffset = roofYoff * s - roofOverlap;

    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const sx = TILE_HALF_W * s * ((col - cx) - (row - cy)) + scrCx;
        const sy = TILE_HALF_H * s * ((col - cx) + (row - cy)) + scrCy;
        const d4 = heightMap ? (heightMap[row]?.[col] ?? 0) : 0;
        const bId = building ? (building[row]?.[col] ?? 0) : 0;

        const tileId = mapData.surface[row][col];
        if (tileId !== 0 && tileId !== 307 && !(bId !== 0 && tileId === bId)) {
          const texKey = `smap_${tileId}`;
          if (this.scene.textures.exists(texKey)) {
            const off = this.smapOffsets.get(tileId);
            const ox = off ? off.xoff * s : TILE_HALF_W * s;
            const oy = off ? off.yoff * s : 17 * s;
            const img = this.scene.add.image(sx - ox, sy - oy - d4 * s, texKey)
              .setOrigin(0, 0)
              .setScale(s)
              .setDepth(col + row);
            container.add(img);
            this.wallSprites.push(img);
          }
        }

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

            container.add(img);
            this.wallSprites.push(img);
            if (!isWallOverlay) {
              this.roofSprites.push(img);
              this.roofGridPos.push({ col, row });
            }
          }
        }
      }
    }
  }

  private createFixedRoomWallSprites(
    mapData: MapData,
    container: Phaser.GameObjects.Container,
    wallTiles: IndoorFixedWallTilesDef,
  ): void {
    const cx = mapData.cx;
    const cy = mapData.cy;
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

      container.add(img);
      this.wallSprites.push(img);
    };

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

  private drawSmapTileOnCtx(ctx: CanvasRenderingContext2D, tileId: number, sx: number, sy: number, scale = 1): void {
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
