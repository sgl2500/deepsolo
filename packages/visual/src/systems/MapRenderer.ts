// ============================================================
// MapRenderer.ts — 双缓冲等距瓦片渲染
// ============================================================

import {
  TILE_HALF_W, TILE_HALF_H,
  SCREEN_WIDTH, SCREEN_HEIGHT,
  INDOOR_SCALE,
  INDOOR_ACTOR_DEPTH_BASE,
  INDOOR_WALL_DECOR_DEPTH,
} from '../config';
import type { IndoorInteractableDef, MapData, TileMeta } from '../types';
import {
  getIndoorFurnitureDefs,
  toActualIndoorBounds,
  toActualIndoorMapPosition,
  toLocalIndoorMapPosition,
  type IndoorFurnitureDef,
} from '../content/IndoorFurnitureLayout';
import { getIndoorInteractables } from '../content/IndoorInteractables';
import { DebugLogger } from '../utils/DebugLogger';
import {
  IndoorCoordinateMapper,
  normalizeFurnitureCollider,
  normalizeInteractableZone,
  roundEditorValue,
  strokeIndoorDiamond,
  strokeIndoorRectBounds,
} from './map/IndoorCoordinateMapper';
import { FurnitureOccluderRenderer } from './map/FurnitureOccluderRenderer';
import { IndoorLayerRenderer, type IndoorFixedRoomDef } from './map/IndoorLayerRenderer';
import { WorldMapCanvasRenderer } from './map/WorldMapCanvasRenderer';
import {
  applyFurnitureEditorSnapshot,
  applyInteractableEditorSnapshot,
  createFurnitureEditorSnapshot,
  createInteractableEditorSnapshot,
  getFurnitureEditorStorageKey,
  getInteractableEditorStorageKey,
  loadFurnitureEditorSnapshot,
  loadInteractableEditorSnapshot,
  saveFurnitureEditorSnapshot,
  saveInteractableEditorSnapshot,
  type FurnitureEditorSnapshotItem,
  type InteractableEditorSnapshotItem,
} from './map/IndoorEditorPersistence';

type FurnitureEditorHandleKind = 'anchor' | 'depth' | 'nw' | 'ne' | 'se' | 'sw' | 'mask';

type FurnitureEditorDrag = {
  furniture: IndoorFurnitureDef;
  kind: FurnitureEditorHandleKind;
  maskIndex?: number;
};

type InteractableEditorHandleKind = 'interaction-center' | 'interaction-nw' | 'interaction-ne' | 'interaction-se' | 'interaction-sw';

type InteractableEditorDrag = {
  interactable: IndoorInteractableDef;
  kind: InteractableEditorHandleKind;
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

  private worldMapRenderer: WorldMapCanvasRenderer;
  private indoorLayerRenderer: IndoorLayerRenderer;
  private furnitureOccluderRenderer: FurnitureOccluderRenderer;

  // 室内模式
  private isIndoor = false;
  // 室内容器 — 包含所有室内精灵和 Canvas，整体跟随玩家滚动
  private indoorContainer: Phaser.GameObjects.Container | null = null;
  // 自定义室内装饰层（用于出生小屋样板）
  private indoorDecorSprites: Phaser.GameObjects.Image[] = [];
  private indoorFurnitureSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private indoorDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private indoorDebugTexts: Phaser.GameObjects.Text[] = [];
  private furnitureEditorActive = false;
  private furnitureEditorSelectedId: string | null = null;
  private interactableEditorSelectedId: string | null = null;
  private furnitureEditorDrag: FurnitureEditorDrag | null = null;
  private interactableEditorDrag: InteractableEditorDrag | null = null;
  private furnitureEditorHelpText: Phaser.GameObjects.Text | null = null;
  private furnitureEditorGuideText: Phaser.GameObjects.Text | null = null;
  private furnitureEditorGuideCollapsed = false;
  private furnitureMaskEditorActive = false;
  private furnitureEditorSelectedMaskIndex: number | null = null;
  private furnitureEditorDefaultSnapshots: Map<string, FurnitureEditorSnapshotItem[]> = new Map();
  private interactableEditorDefaultSnapshots: Map<string, InteractableEditorSnapshotItem[]> = new Map();
  // 室内房间中心
  private indoorCx = 0;
  private indoorCy = 0;
  private indoorAssetLoadPromise: Promise<void> | null = null;
  private currentIndoorBuildingId: string | null = null;
  private indoorCoordinateMapper: IndoorCoordinateMapper;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.indoorCoordinateMapper = new IndoorCoordinateMapper(
      () => ({ cx: this.indoorCx, cy: this.indoorCy }),
      () => this.indoorContainerOffset,
    );
    this.worldMapRenderer = new WorldMapCanvasRenderer(scene);
    this.indoorLayerRenderer = new IndoorLayerRenderer(scene);
    this.furnitureOccluderRenderer = new FurnitureOccluderRenderer(scene);

    this.scene.input.on('pointerdown', this.onFurnitureEditorPointerDown, this);
    this.scene.input.on('pointermove', this.onFurnitureEditorPointerMove, this);
    this.scene.input.on('pointerup', this.onFurnitureEditorPointerUp, this);
    this.scene.game.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  init(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;

    this.worldMapRenderer.init(mapData, tileMeta);
  }

  /** 切换到室内地图 */
  switchToIndoor(mapData: MapData, buildingId?: string): void {
    this.mapData = mapData;
    this.isIndoor = true;
    this.worldMapRenderer.resetAtlas();
    this.indoorCx = mapData.cx;
    this.indoorCy = mapData.cy;
    this.currentIndoorBuildingId = buildingId ?? null;
    if (this.currentIndoorBuildingId) {
      this.captureFurnitureEditorDefaults(this.currentIndoorBuildingId);
      this.restoreFurnitureEditorLayoutFromStorage(this.currentIndoorBuildingId);
      this.captureInteractableEditorDefaults(this.currentIndoorBuildingId);
      this.restoreInteractableEditorLayoutFromStorage(this.currentIndoorBuildingId);
    }

    // 创建室内容器，用于整体跟随玩家滚动
    this.indoorContainer = this.scene.add.container(0, 0);

    // 隐藏世界地图 Canvas（室内用独立地板 Canvas）
    this.scrImage.setVisible(false);

    this.indoorLayerRenderer.create(mapData, this.indoorContainer, this.currentFixedRoomLayout);
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
        loader.image(`smap_${tileId}`, `assets/jy-runtime/10_smap/${padded}.png`);
      }

      loader.start();
    });

    return this.indoorAssetLoadPromise;
  }

  /** 切换回世界地图 */
  switchToWorld(mapData: MapData, tileMeta: TileMeta): void {
    this.mapData = mapData;
    this.tileMeta = tileMeta;
    this.worldMapRenderer.setMapData(mapData, tileMeta);
    this.isIndoor = false;
    this.indoorLayerRenderer.destroy();
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

  get scrImage(): Phaser.GameObjects.Image {
    return this.worldMapRenderer.scrImage;
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

  isFurnitureEditorActive(): boolean {
    return this.furnitureEditorActive;
  }

  toggleFurnitureMaskEditor(): void {
    if (!this.furnitureEditorActive) return;
    this.furnitureMaskEditorActive = !this.furnitureMaskEditorActive;
    this.furnitureEditorDrag = null;
    this.furnitureEditorSelectedMaskIndex = null;
    this.updateFurnitureEditorHelpText();
  }

  toggleFurnitureEditorGuide(): void {
    if (!this.furnitureEditorActive) return;
    this.furnitureEditorGuideCollapsed = !this.furnitureEditorGuideCollapsed;
    this.updateFurnitureEditorHelpText();
  }

  rotateSelectedFurniture(delta: number): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;
    const selected = this.getSelectedFurniture();
    if (!selected) return;
    selected.rotation = Math.round(((selected.rotation ?? 0) + delta) * 10) / 10;
    const sprite = this.indoorFurnitureSprites.get(selected.id);
    if (sprite) sprite.setAngle(selected.rotation);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  nudgeSelectedFurnitureOrigin(dx: number, dy: number): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;
    const selected = this.getSelectedFurniture();
    if (!selected) return;
    selected.originX = Math.round(((selected.originX ?? 0.5) + dx) * 100) / 100;
    selected.originY = Math.round(((selected.originY ?? 1) + dy) * 100) / 100;
    const sprite = this.indoorFurnitureSprites.get(selected.id);
    if (sprite) {
      sprite.setOrigin(selected.originX, selected.originY);
      sprite.setAngle(selected.rotation ?? 0);
    }
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  removeLastFurnitureMaskPoint(): void {
    const selected = this.getSelectedFurniture();
    if (!this.furnitureEditorActive || !this.furnitureMaskEditorActive || !selected?.occluderMask?.length) return;
    const selectedIndex = this.furnitureEditorSelectedMaskIndex;
    const deleteIndex = selectedIndex !== null && selected.occluderMask[selectedIndex]
      ? selectedIndex
      : selected.occluderMask.length - 1;
    selected.occluderMask.splice(deleteIndex, 1);
    this.furnitureEditorSelectedMaskIndex = selected.occluderMask.length
      ? Math.min(deleteIndex, selected.occluderMask.length - 1)
      : null;
    this.updateFurnitureOccluderSprite(selected, true);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  clearFurnitureMask(): void {
    const selected = this.getSelectedFurniture();
    if (!this.furnitureEditorActive || !this.furnitureMaskEditorActive || !selected) return;
    selected.occluderMask = [];
    this.furnitureEditorSelectedMaskIndex = null;
    this.updateFurnitureOccluderSprite(selected, true);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  resetFurnitureEditorSavedLayout(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;

    localStorage.removeItem(getFurnitureEditorStorageKey(this.currentIndoorBuildingId));
    localStorage.removeItem(getInteractableEditorStorageKey(this.currentIndoorBuildingId));
    const defaults = this.furnitureEditorDefaultSnapshots.get(this.currentIndoorBuildingId);
    if (defaults) {
      applyFurnitureEditorSnapshot(this.currentIndoorBuildingId, defaults);
      this.refreshFurnitureEditorVisuals();
    }
    const interactableDefaults = this.interactableEditorDefaultSnapshots.get(this.currentIndoorBuildingId);
    if (interactableDefaults) {
      applyInteractableEditorSnapshot(this.currentIndoorBuildingId, interactableDefaults);
    }
    this.showFurnitureEditorMessage('已清空本地保存，并恢复代码默认家具参数');
  }

  setFurnitureEditorActive(active: boolean): void {
    this.furnitureEditorActive = active && this.isIndoor && !!this.currentIndoorBuildingId;
    if (this.furnitureEditorActive && !this.furnitureEditorSelectedId) {
      this.furnitureEditorSelectedId = getIndoorFurnitureDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
    }
    if (!this.furnitureEditorActive) {
      this.furnitureEditorDrag = null;
      this.interactableEditorDrag = null;
      this.furnitureMaskEditorActive = false;
      this.furnitureEditorSelectedMaskIndex = null;
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
      occluderMask: item.occluderMask?.map((point) => ({ ...point })),
    }));
    const json = JSON.stringify(layout, null, 2);
    navigator.clipboard?.writeText(json).catch(() => undefined);
    DebugLogger.userInfo('FurnitureEditor', 'Exported layout', json);
    this.showFurnitureEditorMessage('家具配置已复制到剪贴板，详情见 console.info');
    return json;
  }

  shouldRerender(playerX: number, playerY: number): boolean {
    return !this.isIndoor && this.worldMapRenderer.shouldRerender(playerX, playerY);
  }

  renderBuffer(playerX: number, playerY: number): void {
    if (this.isIndoor) return;
    this.worldMapRenderer.renderBuffer(playerX, playerY);
  }

  blitToScreen(playerX: number, playerY: number): void {
    if (this.isIndoor) return;
    this.worldMapRenderer.blitToScreen(playerX, playerY);
  }

  /** 更新室内容器位置，让房间跟随玩家滚动 */
  updateIndoorCamera(playerCol: number, playerRow: number): void {
    if (!this.indoorContainer) return;
    const s = INDOOR_SCALE;
    const cx = this.indoorCx;
    const cy = this.indoorCy;

    const dx = TILE_HALF_W * s * ((playerCol - cx) - (playerRow - cy));
    const dy = TILE_HALF_H * s * ((playerCol - cx) + (playerRow - cy));

    this.indoorContainer.setPosition(-dx, -dy);
    this.indoorContainer.sort('depth');

    if (this.furnitureEditorActive) {
      this.updateIndoorDebugOverlay(playerCol, playerRow);
    }
  }

  /** 根据玩家位置动态更新屋顶透明度 */
  updateRoofVisibility(playerCol: number, playerRow: number): void {
    this.indoorLayerRenderer.updateRoofVisibility(playerCol, playerRow);
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
          .setAngle((visual as IndoorFurnitureDef).rotation ?? 0)
          .setDepth(this.getIndoorVisualDepth(visual, depthPosition.mapX, depthPosition.mapY));

        this.indoorContainer.add(img);
        this.indoorDecorSprites.push(img);
        const maybeFurniture = visual as IndoorFurnitureDef;
        if (typeof maybeFurniture.id === 'string') {
          this.indoorFurnitureSprites.set(maybeFurniture.id, img);
          this.updateFurnitureOccluderSprite(maybeFurniture, true);
        }
      }
      return;
    }

    const layout = INDOOR_DECOR_LAYOUTS[this.currentIndoorBuildingId];
    const furnitureDefs = getIndoorFurnitureDefs(this.currentIndoorBuildingId);
    if (!layout && furnitureDefs.length === 0) return;

    const cx = this.indoorCx;
    const cy = this.indoorCy;
    const scrCx = SCREEN_WIDTH / 2;
    const scrCy = SCREEN_HEIGHT / 2;
    const s = INDOOR_SCALE;

    if (layout) {
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

    for (const furniture of furnitureDefs) {
      if (!this.scene.textures.exists(furniture.textureKey)) continue;

      const { mapX, mapY } = toActualIndoorMapPosition(this.currentIndoorBuildingId, furniture.localX, furniture.localY);
      const depthPosition = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        furniture.depthLocalX ?? furniture.localX,
        furniture.depthLocalY ?? furniture.localY,
      );
      const x = TILE_HALF_W * s * ((mapX - cx) - (mapY - cy)) + scrCx + (furniture.pixelOffsetX ?? 0);
      const y = TILE_HALF_H * s * ((mapX - cx) + (mapY - cy)) + scrCy + (furniture.pixelOffsetY ?? 0);

      const img = this.scene.add.image(x, y, furniture.textureKey)
        .setOrigin(furniture.originX ?? 0.5, furniture.originY ?? 1)
        .setScale(furniture.scale ?? 1)
        .setAlpha(furniture.alpha ?? 1)
        .setAngle(furniture.rotation ?? 0)
        .setDepth(this.getIndoorVisualDepth(furniture, depthPosition.mapX, depthPosition.mapY));

      this.indoorContainer.add(img);
      this.indoorDecorSprites.push(img);
      this.indoorFurnitureSprites.set(furniture.id, img);
      this.updateFurnitureOccluderSprite(furniture, true);
    }
  }

  private destroyIndoorDecorSprites(): void {
    this.destroyIndoorFurnitureOccluders();
    for (const sprite of this.indoorDecorSprites) sprite.destroy();
    this.indoorDecorSprites = [];
    this.indoorFurnitureSprites.clear();
  }

  private destroyIndoorFurnitureOccluders(): void {
    this.furnitureOccluderRenderer.destroyAll();
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
        const { x, y } = this.indoorCoordinateMapper.mapToScreen(col, row);
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
          strokeIndoorDiamond(g, this.indoorCoordinateMapper, col, row, 0x60a5fa, 0.22);
        }
      }
    }

    for (const furniture of getIndoorFurnitureDefs(this.currentIndoorBuildingId)) {
      this.strokeFurnitureMask(g, furniture);

      if (furniture.collider) {
        const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, furniture.collider);
        strokeIndoorRectBounds(g, this.indoorCoordinateMapper, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0xff5555, 0.85);
      }

      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, furniture.localX, furniture.localY);
      const anchorScreen = this.indoorCoordinateMapper.mapToScreen(anchor.mapX, anchor.mapY);
      const depthPoint = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        furniture.depthLocalX ?? furniture.localX,
        furniture.depthLocalY ?? furniture.localY,
      );
      const depthScreen = this.indoorCoordinateMapper.mapToScreen(depthPoint.mapX, depthPoint.mapY);

      const selected = furniture.id === this.furnitureEditorSelectedId;
      g.lineStyle(selected ? 3 : 2, 0xffdd55, 1);
      g.fillStyle(0x111827, 0.55);
      g.fillCircle(anchorScreen.x, anchorScreen.y, selected ? 6 : 5);
      g.strokeCircle(anchorScreen.x, anchorScreen.y, selected ? 7 : 6);

      g.fillStyle(0xff55ff, 1);
      g.fillCircle(depthScreen.x, depthScreen.y, selected ? 4 : 3);
      g.lineStyle(1, 0xffffff, selected ? 0.95 : 0.65);
      g.strokeCircle(depthScreen.x, depthScreen.y, selected ? 5 : 4);
    }

    for (const interactable of getIndoorInteractables(this.currentIndoorBuildingId)) {
      this.strokeInteractableEditor(g, interactable);
    }

    const playerScreen = this.indoorCoordinateMapper.mapToScreen(playerCol, playerRow);
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

    if (this.furnitureMaskEditorActive) {
      const maskHandle = this.findFurnitureMaskHandle(pointer.x, pointer.y);
      if (maskHandle) {
        this.furnitureEditorSelectedId = maskHandle.furniture.id;
        this.furnitureEditorSelectedMaskIndex = maskHandle.maskIndex ?? null;
        if (this.isMaskDeletePointer(pointer)) {
          (pointer.event as MouseEvent | undefined)?.preventDefault();
          this.deleteFurnitureMaskPoint(maskHandle.furniture, maskHandle.maskIndex);
          return;
        }
        this.furnitureEditorDrag = maskHandle;
        this.updateFurnitureEditorHelpText();
        return;
      }

      const selected = this.getSelectedFurniture();
      const point = selected ? this.screenToFurniturePixel(selected, pointer.x, pointer.y) : null;
      if (selected && point) {
        selected.occluderMask ??= [];
        selected.occluderMask.push(point);
        this.updateFurnitureOccluderSprite(selected, true);
        this.saveFurnitureEditorLayoutToStorage();
        this.furnitureEditorDrag = {
          furniture: selected,
          kind: 'mask',
          maskIndex: selected.occluderMask.length - 1,
        };
        this.furnitureEditorSelectedMaskIndex = selected.occluderMask.length - 1;
        this.updateFurnitureEditorHelpText();
        return;
      }
    }

    const interactableHandle = this.findInteractableEditorHandle(pointer.x, pointer.y);
    if (interactableHandle) {
      this.interactableEditorSelectedId = interactableHandle.interactable.id;
      this.interactableEditorDrag = interactableHandle;
      this.furnitureEditorDrag = null;
      this.updateFurnitureEditorHelpText();
      return;
    }

    const handle = this.findFurnitureEditorHandle(pointer.x, pointer.y, this.isShiftPointer(pointer));
    if (!handle) return;

    if (this.furnitureEditorSelectedId !== handle.furniture.id) {
      this.furnitureEditorSelectedMaskIndex = null;
    }
    this.furnitureEditorSelectedId = handle.furniture.id;
    this.furnitureEditorDrag = handle;
    this.updateFurnitureEditorHelpText();
  }

  private onFurnitureEditorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.furnitureEditorActive || (!this.furnitureEditorDrag && !this.interactableEditorDrag) || !this.currentIndoorBuildingId) return;

    const localPos = this.indoorCoordinateMapper.screenToLocal(this.currentIndoorBuildingId, pointer.x, pointer.y);

    if (this.interactableEditorDrag) {
      const nextX = roundEditorValue(localPos.localX);
      const nextY = roundEditorValue(localPos.localY);
      this.updateInteractableEditorDrag(this.interactableEditorDrag, nextX, nextY);
      this.updateFurnitureEditorHelpText();
      return;
    }

    if (!this.furnitureEditorDrag) return;
    const { furniture, kind } = this.furnitureEditorDrag;

    if (kind === 'mask') {
      const index = this.furnitureEditorDrag.maskIndex;
      const point = this.screenToFurniturePixel(furniture, pointer.x, pointer.y);
      if (index === undefined || !point || !furniture.occluderMask?.[index]) return;
      furniture.occluderMask[index] = point;
      this.furnitureEditorSelectedMaskIndex = index;
      this.updateFurnitureOccluderSprite(furniture, true);
      this.updateFurnitureEditorHelpText();
      return;
    }

    const nextX = roundEditorValue(localPos.localX);
    const nextY = roundEditorValue(localPos.localY);

    if (kind === 'anchor') {
      const dx = nextX - furniture.localX;
      const dy = nextY - furniture.localY;
      furniture.localX = nextX;
      furniture.localY = nextY;

      if (furniture.collider) {
        furniture.collider.minLocalX = roundEditorValue(furniture.collider.minLocalX + dx);
        furniture.collider.maxLocalX = roundEditorValue(furniture.collider.maxLocalX + dx);
        furniture.collider.minLocalY = roundEditorValue(furniture.collider.minLocalY + dy);
        furniture.collider.maxLocalY = roundEditorValue(furniture.collider.maxLocalY + dy);
      }
      if (furniture.depthLocalX !== undefined) furniture.depthLocalX = roundEditorValue(furniture.depthLocalX + dx);
      if (furniture.depthLocalY !== undefined) furniture.depthLocalY = roundEditorValue(furniture.depthLocalY + dy);
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
      normalizeFurnitureCollider(furniture);
    }

    this.updateFurnitureSprite(furniture);
    this.updateFurnitureEditorHelpText();
  }

  private onFurnitureEditorPointerUp(): void {
    if (this.furnitureEditorDrag) {
      this.saveFurnitureEditorLayoutToStorage();
    }
    if (this.interactableEditorDrag) {
      this.saveInteractableEditorLayoutToStorage();
    }
    this.furnitureEditorDrag = null;
    this.interactableEditorDrag = null;
  }

  private updateInteractableEditorDrag(drag: InteractableEditorDrag, nextX: number, nextY: number): void {
    const { interactable, kind } = drag;
    if (kind === 'interaction-center') {
      const current = this.getInteractableLocalCenter(interactable);
      const dx = nextX - current.localX;
      const dy = nextY - current.localY;
      const actual = toActualIndoorMapPosition(interactable.buildingId, nextX, nextY);
      interactable.mapX = roundEditorValue(actual.mapX);
      interactable.mapY = roundEditorValue(actual.mapY);
      if (interactable.interactionZone?.type === 'rect') {
        interactable.interactionZone.minLocalX = roundEditorValue(interactable.interactionZone.minLocalX + dx);
        interactable.interactionZone.maxLocalX = roundEditorValue(interactable.interactionZone.maxLocalX + dx);
        interactable.interactionZone.minLocalY = roundEditorValue(interactable.interactionZone.minLocalY + dy);
        interactable.interactionZone.maxLocalY = roundEditorValue(interactable.interactionZone.maxLocalY + dy);
      }
      return;
    }

    if (!interactable.interactionZone) {
      const center = this.getInteractableLocalCenter(interactable);
      interactable.interactionZone = {
        type: 'rect',
        minLocalX: center.localX - 0.5,
        maxLocalX: center.localX + 0.5,
        minLocalY: center.localY - 0.5,
        maxLocalY: center.localY + 0.5,
      };
    }

    if (kind === 'interaction-nw' || kind === 'interaction-sw') interactable.interactionZone.minLocalX = nextX;
    if (kind === 'interaction-ne' || kind === 'interaction-se') interactable.interactionZone.maxLocalX = nextX;
    if (kind === 'interaction-nw' || kind === 'interaction-ne') interactable.interactionZone.minLocalY = nextY;
    if (kind === 'interaction-sw' || kind === 'interaction-se') interactable.interactionZone.maxLocalY = nextY;
    normalizeInteractableZone(interactable);
    const center = this.getInteractableLocalCenter(interactable);
    const actual = toActualIndoorMapPosition(interactable.buildingId, center.localX, center.localY);
    interactable.mapX = roundEditorValue(actual.mapX);
    interactable.mapY = roundEditorValue(actual.mapY);
  }

  private findFurnitureEditorHandle(screenX: number, screenY: number, preferDepth = false): FurnitureEditorDrag | null {
    if (!this.currentIndoorBuildingId) return null;

    const handles: Array<FurnitureEditorDrag & { x: number; y: number }> = [];
    for (const furniture of getIndoorFurnitureDefs(this.currentIndoorBuildingId)) {
      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, furniture.localX, furniture.localY);
      const anchorScreen = this.indoorCoordinateMapper.mapToScreenWithContainer(anchor.mapX, anchor.mapY);
      handles.push({ furniture, kind: 'anchor', x: anchorScreen.x, y: anchorScreen.y });

      const depth = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        furniture.depthLocalX ?? furniture.localX,
        furniture.depthLocalY ?? furniture.localY,
      );
      const depthScreen = this.indoorCoordinateMapper.mapToScreenWithContainer(depth.mapX, depth.mapY);
      handles.push({ furniture, kind: 'depth', x: depthScreen.x, y: depthScreen.y });

      if (furniture.collider) {
        const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, furniture.collider);
        const corners: Array<{ kind: FurnitureEditorHandleKind; x: number; y: number }> = [
          { kind: 'nw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.minY) },
          { kind: 'ne', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.minY) },
          { kind: 'se', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.maxY) },
          { kind: 'sw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.maxY) },
        ];
        for (const corner of corners) handles.push({ furniture, ...corner });
      }
    }

    let best: (FurnitureEditorDrag & { x: number; y: number }) | null = null;
    let bestScore = Infinity;
    let bestDistance = Infinity;
    for (const handle of handles) {
      const distance = Math.hypot(handle.x - screenX, handle.y - screenY);
      const score = distance - (preferDepth && handle.kind === 'depth' ? 0.5 : 0);
      if (score < bestScore) {
        best = handle;
        bestScore = score;
        bestDistance = distance;
      }
    }

    if (!best || bestDistance > 16) return null;
    return { furniture: best.furniture, kind: best.kind };
  }

  private findInteractableEditorHandle(screenX: number, screenY: number): InteractableEditorDrag | null {
    if (!this.currentIndoorBuildingId) return null;

    const handles: Array<InteractableEditorDrag & { x: number; y: number }> = [];
    for (const interactable of getIndoorInteractables(this.currentIndoorBuildingId)) {
      if (interactable.interactionZone?.type === 'rect') {
        const bounds = toActualIndoorBounds(interactable.buildingId, interactable.interactionZone);
        const center = this.indoorCoordinateMapper.mapToScreenWithContainer((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
        handles.push({ interactable, kind: 'interaction-center', x: center.x, y: center.y });
        const corners: Array<{ kind: InteractableEditorHandleKind; x: number; y: number }> = [
          { kind: 'interaction-nw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.minY) },
          { kind: 'interaction-ne', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.minY) },
          { kind: 'interaction-se', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.maxY) },
          { kind: 'interaction-sw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.maxY) },
        ];
        for (const corner of corners) handles.push({ interactable, ...corner });
      } else {
        const center = this.indoorCoordinateMapper.mapToScreenWithContainer(interactable.mapX, interactable.mapY);
        handles.push({ interactable, kind: 'interaction-center', x: center.x, y: center.y });
      }
    }

    let best: (InteractableEditorDrag & { x: number; y: number }) | null = null;
    let bestDistance = Infinity;
    for (const handle of handles) {
      const distance = Math.hypot(handle.x - screenX, handle.y - screenY);
      if (distance < bestDistance) {
        best = handle;
        bestDistance = distance;
      }
    }

    if (!best || bestDistance > 16) return null;
    return { interactable: best.interactable, kind: best.kind };
  }

  private captureFurnitureEditorDefaults(buildingId: string): void {
    if (this.furnitureEditorDefaultSnapshots.has(buildingId)) return;
    this.furnitureEditorDefaultSnapshots.set(buildingId, createFurnitureEditorSnapshot(buildingId));
  }

  private restoreFurnitureEditorLayoutFromStorage(buildingId: string): void {
    try {
      const items = loadFurnitureEditorSnapshot(buildingId);
      if (items) applyFurnitureEditorSnapshot(buildingId, items);
    } catch (error) {
      console.warn('[FurnitureEditor] Failed to restore saved layout:', error);
    }
  }

  private saveFurnitureEditorLayoutToStorage(): void {
    if (!this.currentIndoorBuildingId) return;

    try {
      saveFurnitureEditorSnapshot(
        this.currentIndoorBuildingId,
        createFurnitureEditorSnapshot(this.currentIndoorBuildingId),
      );
      this.updateFurnitureEditorHelpText();
    } catch (error) {
      console.warn('[FurnitureEditor] Failed to save layout:', error);
      this.showFurnitureEditorMessage('本地自动保存失败，请检查浏览器存储权限');
    }
  }

  private refreshFurnitureEditorVisuals(): void {
    if (!this.currentIndoorBuildingId) return;
    for (const furniture of getIndoorFurnitureDefs(this.currentIndoorBuildingId)) {
      this.updateFurnitureSprite(furniture);
      this.updateFurnitureOccluderSprite(furniture, true);
    }
    this.updateFurnitureEditorHelpText();
    this.updateIndoorDebugOverlay(0, 0);
  }

  private captureInteractableEditorDefaults(buildingId: string): void {
    if (this.interactableEditorDefaultSnapshots.has(buildingId)) return;
    this.interactableEditorDefaultSnapshots.set(buildingId, createInteractableEditorSnapshot(buildingId));
  }

  private restoreInteractableEditorLayoutFromStorage(buildingId: string): void {
    try {
      const items = loadInteractableEditorSnapshot(buildingId);
      if (items) applyInteractableEditorSnapshot(buildingId, items);
    } catch (error) {
      console.warn('[InteractableEditor] Failed to restore saved layout:', error);
    }
  }

  private saveInteractableEditorLayoutToStorage(): void {
    if (!this.currentIndoorBuildingId) return;

    try {
      saveInteractableEditorSnapshot(
        this.currentIndoorBuildingId,
        createInteractableEditorSnapshot(this.currentIndoorBuildingId),
      );
      this.updateFurnitureEditorHelpText();
    } catch (error) {
      console.warn('[InteractableEditor] Failed to save layout:', error);
      this.showFurnitureEditorMessage('交互区域自动保存失败，请检查浏览器存储权限');
    }
  }

  private isShiftPointer(pointer: Phaser.Input.Pointer): boolean {
    return !!(pointer.event as MouseEvent | undefined)?.shiftKey;
  }

  private isMaskDeletePointer(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as MouseEvent | undefined;
    return !!event?.altKey || pointer.rightButtonDown();
  }

  private getSelectedFurniture(): IndoorFurnitureDef | null {
    if (!this.currentIndoorBuildingId) return null;
    const furniture = getIndoorFurnitureDefs(this.currentIndoorBuildingId);
    return furniture.find((item) => item.id === this.furnitureEditorSelectedId) ?? furniture[0] ?? null;
  }

  private findFurnitureMaskHandle(screenX: number, screenY: number): FurnitureEditorDrag | null {
    if (!this.currentIndoorBuildingId) return null;

    const candidates = getIndoorFurnitureDefs(this.currentIndoorBuildingId)
      .filter((furniture) => furniture.id === this.furnitureEditorSelectedId || !!furniture.occluderMask?.length);

    let best: (FurnitureEditorDrag & { x: number; y: number }) | null = null;
    let bestDistance = Infinity;
    for (const furniture of candidates) {
      for (let i = 0; i < (furniture.occluderMask?.length ?? 0); i++) {
        const point = furniture.occluderMask![i];
        const screen = this.furniturePixelToScreen(furniture, point.px, point.py);
        if (!screen) continue;

        const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
        if (distance < bestDistance) {
          best = { furniture, kind: 'mask', maskIndex: i, x: screen.x, y: screen.y };
          bestDistance = distance;
        }
      }
    }

    if (!best || bestDistance > 14) return null;
    return { furniture: best.furniture, kind: 'mask', maskIndex: best.maskIndex };
  }

  private deleteFurnitureMaskPoint(furniture: IndoorFurnitureDef, index: number | undefined): void {
    if (index === undefined || !furniture.occluderMask?.[index]) return;
    furniture.occluderMask.splice(index, 1);
    this.furnitureEditorSelectedMaskIndex = furniture.occluderMask.length
      ? Math.min(index, furniture.occluderMask.length - 1)
      : null;
    this.furnitureEditorDrag = null;
    this.updateFurnitureOccluderSprite(furniture, true);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  private furniturePixelToScreen(furniture: IndoorFurnitureDef, px: number, py: number): { x: number; y: number } | null {
    const local = this.furniturePixelToContainerLocal(furniture, px, py);
    if (!local) return null;
    return {
      x: local.x + (this.indoorContainer?.x ?? 0),
      y: local.y + (this.indoorContainer?.y ?? 0),
    };
  }

  private furniturePixelToContainerLocal(furniture: IndoorFurnitureDef, px: number, py: number): { x: number; y: number } | null {
    const sprite = this.indoorFurnitureSprites.get(furniture.id);
    if (!sprite) return null;

    return {
      x: sprite.x - sprite.width * sprite.originX * sprite.scaleX + px * sprite.scaleX,
      y: sprite.y - sprite.height * sprite.originY * sprite.scaleY + py * sprite.scaleY,
    };
  }

  private screenToFurniturePixel(furniture: IndoorFurnitureDef, screenX: number, screenY: number): { px: number; py: number } | null {
    const sprite = this.indoorFurnitureSprites.get(furniture.id);
    if (!sprite || !this.indoorContainer || sprite.width <= 0 || sprite.height <= 0) return null;

    const containerX = screenX - this.indoorContainer.x;
    const containerY = screenY - this.indoorContainer.y;
    const left = sprite.x - sprite.width * sprite.originX * sprite.scaleX;
    const top = sprite.y - sprite.height * sprite.originY * sprite.scaleY;
    const px = (containerX - left) / sprite.scaleX;
    const py = (containerY - top) / sprite.scaleY;
    if (px < 0 || py < 0 || px > sprite.width || py > sprite.height) return null;

    return {
      px: Math.round(Phaser.Math.Clamp(px, 0, sprite.width)),
      py: Math.round(Phaser.Math.Clamp(py, 0, sprite.height)),
    };
  }

  private strokeFurnitureMask(g: Phaser.GameObjects.Graphics, furniture: IndoorFurnitureDef): void {
    const sprite = this.indoorFurnitureSprites.get(furniture.id);
    if (!sprite) return;

    const isSelected = furniture.id === this.furnitureEditorSelectedId;
    const points = furniture.occluderMask ?? [];
    const color = isSelected ? 0xffa726 : 0xf97316;
    const alpha = isSelected ? 0.95 : 0.35;

    if (isSelected && this.furnitureMaskEditorActive) {
      const left = sprite.x - sprite.width * sprite.originX * sprite.scaleX;
      const top = sprite.y - sprite.height * sprite.originY * sprite.scaleY;
      g.lineStyle(1, 0xffa726, 0.3);
      g.strokeRect(left, top, sprite.displayWidth, sprite.displayHeight);
    }

    if (points.length >= 2) {
      const screenPoints = points
        .map((point) => this.furniturePixelToContainerLocal(furniture, point.px, point.py))
        .filter((point): point is { x: number; y: number } => !!point);

      if (screenPoints.length >= 2) {
        if (screenPoints.length >= 3) {
          g.fillStyle(color, isSelected ? 0.16 : 0.08);
          g.beginPath();
          g.moveTo(screenPoints[0].x, screenPoints[0].y);
          for (let i = 1; i < screenPoints.length; i++) {
            g.lineTo(screenPoints[i].x, screenPoints[i].y);
          }
          g.closePath();
          g.fillPath();
        }

        g.lineStyle(2, color, alpha);
        g.beginPath();
        g.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          g.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        if (screenPoints.length >= 3) g.closePath();
        g.strokePath();
      }
    }

    if (!isSelected && !points.length) return;

    for (let i = 0; i < points.length; i++) {
      const point = this.furniturePixelToContainerLocal(furniture, points[i].px, points[i].py);
      if (!point) continue;
      const isMaskPointSelected = isSelected && this.furnitureEditorSelectedMaskIndex === i;
      g.fillStyle(color, isSelected ? 1 : 0.45);
      g.fillCircle(point.x, point.y, isMaskPointSelected ? 6 : isSelected ? 4 : 3);
      g.lineStyle(isMaskPointSelected ? 2 : 1, isMaskPointSelected ? 0xffffff : 0x111827, isSelected ? 0.95 : 0.4);
      g.strokeCircle(point.x, point.y, isMaskPointSelected ? 8 : isSelected ? 5 : 4);
    }
  }

  private strokeInteractableEditor(g: Phaser.GameObjects.Graphics, interactable: IndoorInteractableDef): void {
    const selected = interactable.id === this.interactableEditorSelectedId;
    const color = 0x22d3ee;

    if (interactable.interactionZone?.type === 'rect') {
      const bounds = toActualIndoorBounds(interactable.buildingId, interactable.interactionZone);
      const p1 = this.indoorCoordinateMapper.mapToScreen(bounds.minX, bounds.minY);
      const p2 = this.indoorCoordinateMapper.mapToScreen(bounds.maxX, bounds.minY);
      const p3 = this.indoorCoordinateMapper.mapToScreen(bounds.maxX, bounds.maxY);
      const p4 = this.indoorCoordinateMapper.mapToScreen(bounds.minX, bounds.maxY);
      g.fillStyle(color, selected ? 0.16 : 0.08);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.fillPath();

      g.lineStyle(selected ? 3 : 2, color, selected ? 1 : 0.65);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.strokePath();

      for (const point of [p1, p2, p3, p4]) {
        g.fillStyle(color, 1);
        g.fillCircle(point.x, point.y, selected ? 4 : 3);
        g.lineStyle(1, 0x082f49, 1);
        g.strokeCircle(point.x, point.y, selected ? 5 : 4);
      }
    } else {
      const center = this.indoorCoordinateMapper.mapToScreen(interactable.mapX, interactable.mapY);
      g.lineStyle(2, color, selected ? 1 : 0.65);
      g.strokeCircle(center.x, center.y, (interactable.interactRadius ?? 1) * TILE_HALF_W * INDOOR_SCALE);
    }

    const center = this.getInteractableLocalCenter(interactable);
    const actual = toActualIndoorMapPosition(interactable.buildingId, center.localX, center.localY);
    const centerScreen = this.indoorCoordinateMapper.mapToScreen(actual.mapX, actual.mapY);
    g.fillStyle(0x67e8f9, 1);
    g.fillCircle(centerScreen.x, centerScreen.y, selected ? 5 : 4);
  }

  private updateFurnitureOccluderSprite(furniture: IndoorFurnitureDef, rebuildTexture = false): void {
    this.furnitureOccluderRenderer.update(
      furniture,
      this.indoorFurnitureSprites.get(furniture.id) ?? null,
      this.indoorContainer,
      this.currentIndoorBuildingId,
      rebuildTexture,
    );
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
    const position = this.indoorCoordinateMapper.mapToScreen(mapX, mapY);
    sprite
      .setPosition(
        position.x + (furniture.pixelOffsetX ?? 0),
        position.y + (furniture.pixelOffsetY ?? 0),
      )
      .setOrigin(furniture.originX ?? 0.5, furniture.originY ?? 1)
      .setAngle(furniture.rotation ?? 0)
      .setDepth(this.getIndoorVisualDepth(furniture, depthPosition.mapX, depthPosition.mapY));
    this.furnitureOccluderRenderer.sync(furniture, sprite, this.currentIndoorBuildingId);
    this.indoorContainer?.sort('depth');
  }

  private getIndoorVisualDepth(
    visual: { renderLayer?: IndoorFurnitureDef['renderLayer']; depthBias?: number },
    mapX: number,
    mapY: number,
  ): number {
    if (visual.renderLayer === 'wall') {
      return INDOOR_WALL_DECOR_DEPTH + (visual.depthBias ?? 0);
    }
    return INDOOR_ACTOR_DEPTH_BASE + mapX + mapY + (visual.depthBias ?? 0);
  }

  private updateFurnitureEditorHelpText(): void {
    if (!this.furnitureEditorActive) {
      this.furnitureEditorHelpText?.destroy();
      this.furnitureEditorHelpText = null;
      this.furnitureEditorGuideText?.destroy();
      this.furnitureEditorGuideText = null;
      return;
    }

    if (!this.furnitureEditorHelpText) {
      this.furnitureEditorHelpText = this.scene.add.text(12, 42, '', {
        fontSize: '12px',
        color: '#e5e7eb',
        backgroundColor: 'rgba(17,24,39,0.88)',
        padding: { x: 8, y: 6 },
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      }).setDepth(20000).setScrollFactor(0);
    }

    if (!this.furnitureEditorGuideText) {
      this.furnitureEditorGuideText = this.scene.add.text(12, SCREEN_HEIGHT - 40, '', {
        fontSize: '13px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15,23,42,0.9)',
        padding: { x: 10, y: 8 },
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
        lineSpacing: 3,
        wordWrap: { width: 340, useAdvancedWrap: true },
      }).setDepth(20000).setScrollFactor(0).setInteractive({ useHandCursor: true });
      this.furnitureEditorGuideText.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
        this.toggleFurnitureEditorGuide();
      });
    }

    const selected = getIndoorFurnitureDefs(this.currentIndoorBuildingId)
      .find((item) => item.id === this.furnitureEditorSelectedId);
    const selectedText = selected
      ? [
          `当前家具：${selected.id}`,
          `锚点 local：${selected.localX.toFixed(1)}, ${selected.localY.toFixed(1)}`,
          `遮挡 depth：${(selected.depthLocalX ?? selected.localX).toFixed(1)}, ${(selected.depthLocalY ?? selected.localY).toFixed(1)}`,
          selected.collider
            ? `碰撞框：${selected.collider.minLocalX.toFixed(1)},${selected.collider.minLocalY.toFixed(1)} -> ${selected.collider.maxLocalX.toFixed(1)},${selected.collider.maxLocalY.toFixed(1)}`
            : '碰撞框：无',
          `mask：${this.furnitureMaskEditorActive ? '开启' : '关闭'}（${selected.occluderMask?.length ?? 0} 点，选中 ${this.furnitureEditorSelectedMaskIndex ?? '-'}）`,
          `旋转：${selected.rotation ?? 0}°`,
          `旋转中心 origin：${selected.originX ?? 0.5}, ${selected.originY ?? 1}`,
        ].join('\n')
      : '当前家具：无';
    const selectedInteractable = getIndoorInteractables(this.currentIndoorBuildingId)
      .find((item) => item.id === this.interactableEditorSelectedId);
    const interactableText = selectedInteractable
      ? [
          `当前交互：${selectedInteractable.name}`,
          selectedInteractable.interactionZone
            ? `交互框：${selectedInteractable.interactionZone.minLocalX.toFixed(1)},${selectedInteractable.interactionZone.minLocalY.toFixed(1)} -> ${selectedInteractable.interactionZone.maxLocalX.toFixed(1)},${selectedInteractable.interactionZone.maxLocalY.toFixed(1)}`
            : `交互点：${selectedInteractable.mapX.toFixed(1)}, ${selectedInteractable.mapY.toFixed(1)}`,
        ].join('\n')
      : '当前交互：无';

    this.furnitureEditorHelpText.setText([
      '家具编辑模式',
      '参数会自动保存到浏览器',
      selectedText,
      interactableText,
    ].join('\n'));

    const guideLines = this.furnitureEditorGuideCollapsed
      ? [
          '操作说明（已收起）',
          '点击展开 / 按 H 展开',
        ]
      : [
          '操作说明（点击收起 / H）',
          '',
          '1. 选择对象',
          '黄色圆环/紫色点/红框：家具。',
          '青色框/青色点：可交互区域。',
          '',
          '2. 移动与碰撞',
          '拖黄色圆环：移动家具锚点。',
          '拖红框角点：调整玩家不能进入的区域。',
          '',
          '3. 遮挡排序',
          '拖紫色点：调整整件家具和玩家谁在前。',
          '黄紫重合时：普通拖动选黄色；按住 Shift 拖动选紫色。',
          '',
          '4. 旋转与旋转中心',
          'Q/E：逆时针/顺时针旋转 15°。',
          'Shift+Q/E：微调旋转 1°。',
          'Shift+方向键：调整旋转中心 origin ±0.05。',
          '旋转中心决定绕哪个点转，默认底部中央(0.5,1)。',
          '',
          '5. 局部 mask 遮挡',
          '按 M 开关 mask 模式。',
          'mask 开启后，点击家具图片新增橙色点。',
          '拖橙色点：调整局部遮挡范围。',
          'Alt+点击或右键橙色点：删除指定点。',
          'Backspace/Delete：删选中点；没有选中点就删最后一个。',
          'C：清空当前家具 mask。',
          '',
          '6. 交互区域',
          '拖青色中心点：移动交互区域。',
          '拖青色四角：调整触发范围。',
          '床休息点、书架翻书都用这个范围。',
          '',
          '7. 保存与重置',
          '松开鼠标或改 mask 后自动保存。',
          '刷新页面会恢复上次编辑。',
          'R：清空本地保存，恢复代码默认值。',
          'F2：退出编辑模式。',
        ];
    this.furnitureEditorGuideText.setText(guideLines.join('\n'));
    this.furnitureEditorGuideText.setPosition(
      12,
      Math.max(42, SCREEN_HEIGHT - this.furnitureEditorGuideText.height - 12),
    );
  }

  private showFurnitureEditorMessage(message: string): void {
    if (!this.furnitureEditorHelpText) return;
    const previous = this.furnitureEditorHelpText.text;
    this.furnitureEditorHelpText.setText(`${previous}\n${message}`);
    this.scene.time.delayedCall(1400, () => this.updateFurnitureEditorHelpText());
  }

  private getInteractableLocalCenter(interactable: IndoorInteractableDef): { localX: number; localY: number } {
    if (interactable.interactionZone?.type === 'rect') {
      return {
        localX: (interactable.interactionZone.minLocalX + interactable.interactionZone.maxLocalX) / 2,
        localY: (interactable.interactionZone.minLocalY + interactable.interactionZone.maxLocalY) / 2,
      };
    }
    return toLocalIndoorMapPosition(interactable.buildingId, interactable.mapX, interactable.mapY);
  }

}
