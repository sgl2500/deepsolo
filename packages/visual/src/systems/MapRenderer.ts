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
  addIndoorFurnitureDef,
  createIndoorFurnitureCopyId,
  getIndoorFurnitureDefs,
  removeIndoorFurnitureDefs,
  toActualIndoorBounds,
  toActualIndoorMapPosition,
  toLocalIndoorMapPosition,
  type IndoorFurnitureDef,
} from '../content/IndoorFurnitureLayout';
import {
  addIndoorCharacterDef,
  createIndoorCharacterInstanceId,
  getIndoorCharacterDefs,
  removeIndoorCharacterDefs,
  type IndoorCharacterDef,
} from '../content/IndoorCharacterLayout';
import { getIndoorAsset, INDOOR_ASSET_LIBRARY, type IndoorAssetDef } from '../content/IndoorAssetLibrary';
import { getGeneratedIndoorLayout } from '../content/GeneratedIndoorLayouts';
import { getStoryNpcSourceCharacterIds } from '../content/StoryNpcPlacements';
import { getIndoorInteractables } from '../content/IndoorInteractables';
import { getAsset, getAssetByTextureKey } from '../content/AssetCatalog';
import {
  getIndoorEditableTileRegions,
  getIndoorRoomTemplate,
  isIndoorTileEditable,
  type IndoorRoomTemplate,
  type IndoorFixedRoomDef,
} from '../content/IndoorRoomTemplates';
import { LocalSceneRepository, type SceneDraftRecord } from '../editor/core/SceneRepository';
import { createIndoorEditableSceneSnapshot } from '../editor/core/SceneSerializer';
import type { PlacedSceneObject } from '../editor/schema/SceneSchema';
import {
  BuildModeOverlay,
  type BuildEditableField,
  type BuildEditorMode,
  type BuildFieldValue,
  type BuildTileBrush,
} from '../ui/BuildModeOverlay';
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
import { IndoorLayerRenderer } from './map/IndoorLayerRenderer';
import {
  clearIndoorFloorTileOverrides,
  loadIndoorFloorTileOverrides,
  saveIndoorFloorTileOverrides,
  type IndoorFloorTileOverride,
} from './map/IndoorTileEditorPersistence';
import { WorldMapCanvasRenderer } from './map/WorldMapCanvasRenderer';
import {
  applyIndoorCharacterEditorSnapshot,
  applyFurnitureEditorSnapshot,
  applyInteractableEditorSnapshot,
  createIndoorCharacterEditorSnapshot,
  createFurnitureEditorSnapshot,
  createInteractableEditorSnapshot,
  getIndoorCharacterEditorStorageKey,
  getFurnitureEditorStorageKey,
  getInteractableEditorStorageKey,
  loadIndoorCharacterEditorSnapshotPayload,
  loadFurnitureEditorSnapshotPayload,
  loadInteractableEditorSnapshot,
  saveIndoorCharacterEditorSnapshot,
  saveFurnitureEditorSnapshot,
  saveInteractableEditorSnapshot,
  type IndoorCharacterEditorSnapshotItem,
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

type CharacterEditorHandleKind = 'character-anchor' | 'character-depth' | 'character-nw' | 'character-ne' | 'character-se' | 'character-sw';

type CharacterEditorDrag = {
  character: IndoorCharacterDef;
  kind: CharacterEditorHandleKind;
};

type IndoorLocalColliderBounds = {
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
};

type BuildColliderField = Extract<
  BuildEditableField,
  'colliderMinX' | 'colliderMaxX' | 'colliderMinY' | 'colliderMaxY'
>;

type BuildInteractableField = Extract<
  BuildEditableField,
  'interactRadius' | 'interactionMinX' | 'interactionMaxX' | 'interactionMinY' | 'interactionMaxY'
>;

type IndoorAssetPlacementDrag = {
  assetId: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
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

type IndoorEditorUndoSnapshot = {
  label: string;
  furniture: FurnitureEditorSnapshotItem[];
  characters: IndoorCharacterEditorSnapshotItem[];
  interactables: InteractableEditorSnapshotItem[];
  floorTileOverrides: IndoorFloorTileOverride[];
  furnitureSelectedId: string | null;
  characterSelectedId: string | null;
  interactableSelectedId: string | null;
  selectedMaskIndex: number | null;
  maskActive: boolean;
  editorMode: BuildEditorMode;
  selectedFloorBrushTextureKey: string | null;
};

const INDOOR_DECOR_LAYOUTS: Record<string, IndoorDecorDef[]> = {
};

const INDOOR_EDITOR_HISTORY_LIMIT = 80;

function isColliderBoundsField(field: BuildEditableField): field is BuildColliderField {
  return field === 'colliderMinX'
    || field === 'colliderMaxX'
    || field === 'colliderMinY'
    || field === 'colliderMaxY';
}

function isInteractableField(field: BuildEditableField): field is BuildInteractableField {
  return field === 'interactRadius'
    || field === 'interactionMinX'
    || field === 'interactionMaxX'
    || field === 'interactionMinY'
    || field === 'interactionMaxY';
}

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
  private indoorCharacterSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private indoorFurnitureSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private indoorDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private indoorDebugTexts: Phaser.GameObjects.Text[] = [];
  private furnitureEditorActive = false;
  private furnitureEditorSelectedId: string | null = null;
  private characterEditorSelectedId: string | null = null;
  private interactableEditorSelectedId: string | null = null;
  private furnitureEditorDrag: FurnitureEditorDrag | null = null;
  private characterEditorDrag: CharacterEditorDrag | null = null;
  private interactableEditorDrag: InteractableEditorDrag | null = null;
  private furnitureEditorHelpText: Phaser.GameObjects.Text | null = null;
  private furnitureEditorGuideText: Phaser.GameObjects.Text | null = null;
  private indoorAssetPanel: Phaser.GameObjects.Container | null = null;
  private indoorAssetPanelBounds: Phaser.Geom.Rectangle | null = null;
  private indoorSceneObjectPanel: Phaser.GameObjects.Container | null = null;
  private indoorSceneObjectPanelBounds: Phaser.Geom.Rectangle | null = null;
  private indoorAssetPlacementDrag: IndoorAssetPlacementDrag | null = null;
  private indoorAssetDragPreview: Phaser.GameObjects.Image | null = null;
  private pendingIndoorAssetId: string | null = null;
  private furnitureEditorGuideCollapsed = false;
  private furnitureMaskEditorActive = false;
  private furnitureEditorSelectedMaskIndex: number | null = null;
  private furnitureEditorDefaultSnapshots: Map<string, FurnitureEditorSnapshotItem[]> = new Map();
  private characterEditorDefaultSnapshots: Map<string, IndoorCharacterEditorSnapshotItem[]> = new Map();
  private interactableEditorDefaultSnapshots: Map<string, InteractableEditorSnapshotItem[]> = new Map();
  // 室内房间中心
  private indoorCx = 0;
  private indoorCy = 0;
  private indoorAssetLoadPromise: Promise<void> | null = null;
  private currentIndoorBuildingId: string | null = null;
  private indoorCoordinateMapper: IndoorCoordinateMapper;
  private sceneRepository = new LocalSceneRepository();
  private lastIndoorSceneDraft: SceneDraftRecord | null = null;
  private buildModeOverlay: BuildModeOverlay;
  private buildOverlayAdvanced = false;
  private buildPreviewMode = false;
  private buildEditorMode: BuildEditorMode = 'object';
  private selectedFloorBrushTextureKey: string | null = null;
  private indoorFloorTileOverrides: Map<string, IndoorFloorTileOverride> = new Map();
  private indoorEditorUndoStack: IndoorEditorUndoSnapshot[] = [];
  private indoorEditorRedoStack: IndoorEditorUndoSnapshot[] = [];
  private isApplyingIndoorEditorHistory = false;

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
    this.buildModeOverlay = new BuildModeOverlay({
      onSetEditorMode: (mode) => this.setBuildEditorMode(mode),
      onSelectAsset: (assetId) => this.selectIndoorAssetForPlacement(assetId),
      onSelectTileBrush: (textureKey) => this.selectFloorTileBrush(textureKey),
      onSelectObject: (objectId) => this.selectSceneObjectById(objectId),
      onDeleteSelected: () => this.deleteSelectedIndoorEditorItem(),
      onDuplicateSelected: () => this.duplicateSelectedIndoorEditorItem(),
      onResetScene: () => this.resetFurnitureEditorSavedLayout(),
      onExportScene: () => this.exportIndoorSceneSnapshot(),
      onSaveSceneToSource: () => this.saveIndoorSceneToSource(),
      onToggleAdvanced: () => this.toggleBuildOverlayAdvanced(),
      onToggleMask: () => this.toggleFurnitureMaskEditor(),
      onTogglePreview: () => this.toggleBuildPreviewMode(),
      onSelectMode: () => this.enterBuildSelectMode(),
      onUndo: () => this.undoIndoorEditorChange(),
      onRedo: () => this.redoIndoorEditorChange(),
      onResetCollider: () => this.resetSelectedIndoorCollider(),
      onClearCollider: () => this.clearSelectedIndoorCollider(),
      onUpdateSelectedField: (field, value) => this.updateSelectedFieldFromOverlay(field, value),
      onExit: () => this.setFurnitureEditorActive(false),
    });
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
    this.clearIndoorEditorHistory();
    if (this.currentIndoorBuildingId) {
      this.applyGeneratedIndoorLayout(this.currentIndoorBuildingId);
      this.captureFurnitureEditorDefaults(this.currentIndoorBuildingId);
      this.restoreFurnitureEditorLayoutFromStorage(this.currentIndoorBuildingId);
      this.captureIndoorCharacterEditorDefaults(this.currentIndoorBuildingId);
      this.restoreIndoorCharacterEditorLayoutFromStorage(this.currentIndoorBuildingId);
      this.captureInteractableEditorDefaults(this.currentIndoorBuildingId);
      this.restoreInteractableEditorLayoutFromStorage(this.currentIndoorBuildingId);
      this.restoreIndoorFloorTileOverridesFromStorage(this.currentIndoorBuildingId);
      this.lastIndoorSceneDraft = this.sceneRepository.loadSceneDraft('indoor', this.currentIndoorBuildingId);
    }

    // 创建室内容器，用于整体跟随玩家滚动
    this.indoorContainer = this.scene.add.container(0, 0);

    // 隐藏世界地图 Canvas（室内用独立地板 Canvas）
    this.scrImage.setVisible(false);

    this.indoorLayerRenderer.create(
      mapData,
      this.indoorContainer,
      this.currentFixedRoomLayout,
      this.getIndoorFloorTileOverrideList(),
    );
    this.createIndoorDecorSprites();
    this.createIndoorCharacterSprites();
    this.saveIndoorSceneDraftToRepository('enter-indoor');
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
    this.indoorFloorTileOverrides.clear();
    this.clearIndoorEditorHistory();
    this.selectedFloorBrushTextureKey = null;
    this.buildEditorMode = 'object';
    this.destroyIndoorDecorSprites();
    this.destroyIndoorCharacterSprites();
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
    return this.currentIndoorRoomTemplate?.fixedRoom ?? null;
  }

  private get currentIndoorRoomTemplate(): IndoorRoomTemplate | null {
    return getIndoorRoomTemplate(this.currentIndoorBuildingId);
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

  undoIndoorEditorChange(): boolean {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId || this.indoorEditorUndoStack.length === 0) {
      return false;
    }
    const previous = this.indoorEditorUndoStack.pop();
    const current = previous ? this.captureIndoorEditorUndoSnapshot(previous.label) : null;
    if (!previous || !current) return false;

    this.indoorEditorRedoStack.push(current);
    this.applyIndoorEditorUndoSnapshot(previous);
    this.showFurnitureEditorMessage(`已撤销：${previous.label}`);
    return true;
  }

  redoIndoorEditorChange(): boolean {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId || this.indoorEditorRedoStack.length === 0) {
      return false;
    }
    const next = this.indoorEditorRedoStack.pop();
    const current = next ? this.captureIndoorEditorUndoSnapshot(next.label) : null;
    if (!next || !current) return false;

    this.indoorEditorUndoStack.push(current);
    this.applyIndoorEditorUndoSnapshot(next);
    this.showFurnitureEditorMessage(`已重做：${next.label}`);
    return true;
  }

  resetSelectedIndoorCollider(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;

    const character = this.getSelectedCharacter();
    if (character) {
      this.pushIndoorEditorUndoCheckpoint('重置人物碰撞框');
      character.collider = this.createDefaultLocalCollider(character.localX, character.localY);
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      this.showFurnitureEditorMessage('已重置人物碰撞框为 1x1');
      return;
    }

    const furniture = this.getSelectedFurniture(false);
    if (!furniture) return;
    this.pushIndoorEditorUndoCheckpoint('重置家具碰撞框');
    furniture.collider = this.createDefaultLocalCollider(furniture.localX, furniture.localY);
    this.updateFurnitureSprite(furniture);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveFurnitureEditorLayoutToStorage();
    this.showFurnitureEditorMessage('已重置家具碰撞框为 1x1');
  }

  clearSelectedIndoorCollider(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;

    const character = this.getSelectedCharacter();
    if (character?.collider) {
      this.pushIndoorEditorUndoCheckpoint('清除人物碰撞框');
      character.collider = undefined;
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      this.showFurnitureEditorMessage('已清除人物碰撞框');
      return;
    }

    const furniture = this.getSelectedFurniture(false);
    if (!furniture?.collider) return;
    this.pushIndoorEditorUndoCheckpoint('清除家具碰撞框');
    furniture.collider = undefined;
    this.updateFurnitureSprite(furniture);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveFurnitureEditorLayoutToStorage();
    this.showFurnitureEditorMessage('已清除家具碰撞框');
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
    this.pushIndoorEditorUndoCheckpoint('旋转家具');
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
    this.pushIndoorEditorUndoCheckpoint('调整家具锚点');
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

  nudgeSelectedIndoorEditorItem(dx: number, dy: number): boolean {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return false;

    const character = this.getSelectedCharacter();
    if (character) {
      this.pushIndoorEditorUndoCheckpoint('移动人物');
      this.moveCharacterAnchor(
        character,
        roundEditorValue(character.localX + dx),
        roundEditorValue(character.localY + dy),
      );
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      return true;
    }

    const interactable = this.getSelectedInteractable();
    if (interactable) {
      this.pushIndoorEditorUndoCheckpoint('移动交互区');
      const center = this.getInteractableLocalCenter(interactable);
      this.updateInteractableEditorDrag(
        { interactable, kind: 'interaction-center' },
        roundEditorValue(center.localX + dx),
        roundEditorValue(center.localY + dy),
      );
      this.updateIndoorDebugOverlay(0, 0);
      this.saveInteractableEditorLayoutToStorage();
      return true;
    }

    const furniture = this.getSelectedFurniture(false);
    if (!furniture) return false;
    this.pushIndoorEditorUndoCheckpoint('移动家具');
    this.moveFurnitureAnchor(
      furniture,
      roundEditorValue(furniture.localX + dx),
      roundEditorValue(furniture.localY + dy),
    );
    this.updateFurnitureSprite(furniture);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveFurnitureEditorLayoutToStorage();
    return true;
  }

  removeLastFurnitureMaskPoint(): boolean {
    const selected = this.getSelectedFurniture();
    if (!this.furnitureEditorActive || !this.furnitureMaskEditorActive || !selected?.occluderMask?.length) return false;
    const selectedIndex = this.furnitureEditorSelectedMaskIndex;
    const deleteIndex = selectedIndex !== null && selected.occluderMask[selectedIndex]
      ? selectedIndex
      : selected.occluderMask.length - 1;
    this.pushIndoorEditorUndoCheckpoint('删除遮挡 Mask 点');
    selected.occluderMask.splice(deleteIndex, 1);
    this.furnitureEditorSelectedMaskIndex = selected.occluderMask.length
      ? Math.min(deleteIndex, selected.occluderMask.length - 1)
      : null;
    this.updateFurnitureOccluderSprite(selected, true);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
    return true;
  }

  clearFurnitureMask(): void {
    const selected = this.getSelectedFurniture();
    if (!this.furnitureEditorActive || !this.furnitureMaskEditorActive || !selected) return;
    this.pushIndoorEditorUndoCheckpoint('清空遮挡 Mask');
    selected.occluderMask = [];
    this.furnitureEditorSelectedMaskIndex = null;
    this.updateFurnitureOccluderSprite(selected, true);
    this.saveFurnitureEditorLayoutToStorage();
    this.updateFurnitureEditorHelpText();
  }

  duplicateSelectedFurniture(): void {
    this.duplicateSelectedIndoorEditorItem();
  }

  duplicateSelectedIndoorEditorItem(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;

    const selectedCharacter = this.getSelectedCharacter();
    if (selectedCharacter) {
      this.pushIndoorEditorUndoCheckpoint('复制人物');
      const copy = this.createCharacterCopy(selectedCharacter, this.currentIndoorBuildingId);
      addIndoorCharacterDef(copy);
      this.characterEditorSelectedId = copy.id;
      this.furnitureEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
      this.characterEditorDrag = null;
      this.createIndoorCharacterSprites();
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      this.createIndoorSceneObjectPanel();
      this.showFurnitureEditorMessage(`已复制人物：${selectedCharacter.id} -> ${copy.id}`);
      return;
    }

    const selected = this.getSelectedFurniture(false);
    if (!selected) {
      this.showFurnitureEditorMessage(
        this.getSelectedInteractable() ? '交互区暂不支持复制' : '没有可复制的对象',
      );
      return;
    }
    this.pushIndoorEditorUndoCheckpoint('复制家具');
    const copy = this.createFurnitureCopy(selected, this.currentIndoorBuildingId);
    addIndoorFurnitureDef(copy);
    this.furnitureEditorSelectedId = copy.id;
    this.characterEditorSelectedId = null;
    this.interactableEditorSelectedId = null;
    this.furnitureEditorSelectedMaskIndex = null;
    this.furnitureEditorDrag = null;
    this.createIndoorDecorSprites();
    this.updateIndoorDebugOverlay(0, 0);
    this.saveFurnitureEditorLayoutToStorage();
    this.createIndoorSceneObjectPanel();
    this.showFurnitureEditorMessage(`已复制家具/贴图：${selected.id} -> ${copy.id}`);
  }

  deleteSelectedIndoorEditorItem(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;
    if (this.removeLastFurnitureMaskPoint()) return;

    if (this.pendingIndoorAssetId) {
      const assetName = getIndoorAsset(this.pendingIndoorAssetId)?.name ?? this.pendingIndoorAssetId;
      this.pendingIndoorAssetId = null;
      this.indoorAssetPlacementDrag = null;
      this.destroyIndoorAssetDragPreview();
      this.createIndoorAssetPanel();
      this.createIndoorSceneObjectPanel();
      this.updateFurnitureEditorHelpText();
      this.showFurnitureEditorMessage(`已取消放置素材：${assetName}`);
      return;
    }

    const selectedCharacter = this.getSelectedCharacter();
    if (selectedCharacter) {
      this.pushIndoorEditorUndoCheckpoint('删除人物');
      const deletedId = selectedCharacter.id;
      removeIndoorCharacterDefs(this.currentIndoorBuildingId, (item) => item.id === deletedId);
      this.characterEditorSelectedId = getIndoorCharacterDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
      this.characterEditorDrag = null;
      this.createIndoorCharacterSprites();
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      this.createIndoorSceneObjectPanel();
      this.showFurnitureEditorMessage(`已删除人物：${deletedId}`);
      return;
    }

    const selectedFurniture = this.getSelectedFurniture(false);
    if (selectedFurniture) {
      this.pushIndoorEditorUndoCheckpoint('删除家具');
      const deletedId = selectedFurniture.id;
      removeIndoorFurnitureDefs(this.currentIndoorBuildingId, (item) => item.id === deletedId);
      this.furnitureEditorSelectedId = getIndoorFurnitureDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
      this.furnitureEditorSelectedMaskIndex = null;
      this.furnitureEditorDrag = null;
      this.createIndoorDecorSprites();
      this.updateIndoorDebugOverlay(0, 0);
      this.saveFurnitureEditorLayoutToStorage();
      this.createIndoorSceneObjectPanel();
      this.showFurnitureEditorMessage(`已删除家具/贴图：${deletedId}`);
      return;
    }

    this.showFurnitureEditorMessage('没有选中的人物/家具/贴图可删除');
  }

  private createFurnitureCopy(source: IndoorFurnitureDef, buildingId: string): IndoorFurnitureDef {
    const offset = 1;
    const copyId = createIndoorFurnitureCopyId(buildingId, source.id);
    const offsetNumber = (value: number | undefined): number | undefined => (
      value === undefined ? undefined : roundEditorValue(value + offset)
    );

    return {
      ...source,
      buildingId,
      id: copyId,
      localX: roundEditorValue(source.localX + offset),
      localY: roundEditorValue(source.localY + offset),
      depthLocalX: offsetNumber(source.depthLocalX),
      depthLocalY: offsetNumber(source.depthLocalY),
      collider: source.collider
        ? {
            minLocalX: roundEditorValue(source.collider.minLocalX + offset),
            maxLocalX: roundEditorValue(source.collider.maxLocalX + offset),
            minLocalY: roundEditorValue(source.collider.minLocalY + offset),
            maxLocalY: roundEditorValue(source.collider.maxLocalY + offset),
          }
        : undefined,
      occluderMask: source.occluderMask?.map((point) => ({ ...point })),
    };
  }

  private createCharacterCopy(source: IndoorCharacterDef, buildingId: string): IndoorCharacterDef {
    const offset = 1;
    const offsetNumber = (value: number | undefined): number | undefined => (
      value === undefined ? undefined : roundEditorValue(value + offset)
    );

    return {
      ...source,
      buildingId,
      id: createIndoorCharacterInstanceId(buildingId, source.id),
      localX: roundEditorValue(source.localX + offset),
      localY: roundEditorValue(source.localY + offset),
      depthLocalX: offsetNumber(source.depthLocalX),
      depthLocalY: offsetNumber(source.depthLocalY),
      collider: source.collider
        ? {
            minLocalX: roundEditorValue(source.collider.minLocalX + offset),
            maxLocalX: roundEditorValue(source.collider.maxLocalX + offset),
            minLocalY: roundEditorValue(source.collider.minLocalY + offset),
            maxLocalY: roundEditorValue(source.collider.maxLocalY + offset),
          }
        : undefined,
    };
  }

  private placePendingIndoorAsset(localX: number, localY: number): void {
    if (!this.currentIndoorBuildingId || !this.pendingIndoorAssetId) return;
    const asset = getIndoorAsset(this.pendingIndoorAssetId);
    if (!asset) return;

    if (asset.kind === 'character') {
      this.pushIndoorEditorUndoCheckpoint('放置人物素材');
      const character = this.createCharacterFromAsset(asset, this.currentIndoorBuildingId, localX, localY);
      addIndoorCharacterDef(character);
      this.characterEditorSelectedId = character.id;
      this.furnitureEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
      this.createIndoorCharacterSprites();
      this.saveIndoorCharacterEditorLayoutToStorage();
    } else {
      this.pushIndoorEditorUndoCheckpoint('放置家具素材');
      const furniture = this.createFurnitureFromAsset(asset, this.currentIndoorBuildingId, localX, localY);
      addIndoorFurnitureDef(furniture);
      this.furnitureEditorSelectedId = furniture.id;
      this.characterEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
      this.createIndoorDecorSprites();
      this.saveFurnitureEditorLayoutToStorage();
    }

    this.pendingIndoorAssetId = null;
    this.createIndoorAssetPanel();
    this.createIndoorSceneObjectPanel();
    this.updateIndoorDebugOverlay(0, 0);
    this.showFurnitureEditorMessage(`已放置素材：${asset.name}`);
  }

  private createCharacterFromAsset(
    asset: IndoorAssetDef,
    buildingId: string,
    localX: number,
    localY: number,
  ): IndoorCharacterDef {
    const colliderSize = asset.defaultColliderSize ?? { width: 1.2, height: 1.2 };
    const halfW = colliderSize.width / 2;
    const halfH = colliderSize.height / 2;
    return {
      buildingId,
      id: createIndoorCharacterInstanceId(buildingId, asset.id),
      textureKey: asset.textureKey,
      localX,
      localY,
      scale: asset.defaultScale,
      originX: asset.defaultOriginX,
      originY: asset.defaultOriginY,
      collider: {
        minLocalX: roundEditorValue(localX - halfW),
        maxLocalX: roundEditorValue(localX + halfW),
        minLocalY: roundEditorValue(localY - halfH),
        maxLocalY: roundEditorValue(localY + halfH),
      },
    };
  }

  private createFurnitureFromAsset(
    asset: IndoorAssetDef,
    buildingId: string,
    localX: number,
    localY: number,
  ): IndoorFurnitureDef {
    return {
      buildingId,
      id: createIndoorFurnitureCopyId(buildingId, asset.id),
      textureKey: asset.textureKey,
      renderLayer: asset.kind === 'wallDecor' ? 'wall' : undefined,
      localX,
      localY,
      scale: asset.defaultScale,
      originX: asset.defaultOriginX,
      originY: asset.defaultOriginY,
    };
  }

  private canEditIndoorFloorTiles(): boolean {
    return getIndoorEditableTileRegions(this.currentIndoorBuildingId, 'floor').length > 0;
  }

  private getIndoorFloorBrushes(): BuildTileBrush[] {
    const floorRegions = getIndoorEditableTileRegions(this.currentIndoorBuildingId, 'floor');
    if (floorRegions.length === 0) return [];

    const textureKeys = new Set<string>();
    const brushSrcByTextureKey = new Map<string, string>();
    for (const region of floorRegions) {
      for (const assetId of region.brushAssetIds ?? []) {
        const asset = getAsset(assetId);
        if (!asset) continue;
        textureKeys.add(asset.textureKey);
        brushSrcByTextureKey.set(asset.textureKey, asset.src);
      }
      for (const textureKey of region.textureKeys ?? []) {
        textureKeys.add(textureKey);
        const asset = getAssetByTextureKey(textureKey);
        if (asset) brushSrcByTextureKey.set(textureKey, asset.src);
      }
      for (let row = region.rowStart; row <= region.rowEnd; row++) {
        for (let col = region.colStart; col <= region.colEnd; col++) {
          const earthId = this.mapData.earth?.[row]?.[col] ?? 0;
          const surfaceId = this.mapData.surface?.[row]?.[col] ?? 0;
          if (earthId > 0) {
            const textureKey = `smap_${earthId}`;
            textureKeys.add(textureKey);
            const asset = getAssetByTextureKey(textureKey);
            if (asset) brushSrcByTextureKey.set(textureKey, asset.src);
          }
          if (surfaceId > 0 && surfaceId !== 307) {
            const textureKey = `smap_${surfaceId}`;
            textureKeys.add(textureKey);
            const asset = getAssetByTextureKey(textureKey);
            if (asset) brushSrcByTextureKey.set(textureKey, asset.src);
          }
        }
      }
    }
    return Array.from(textureKeys)
      .filter((textureKey) => this.scene.textures.exists(textureKey))
      .map((textureKey) => ({
        textureKey,
        label: getAssetByTextureKey(textureKey)?.name ?? textureKey.replace('smap_', '#'),
        src: brushSrcByTextureKey.get(textureKey),
      }));
  }

  private getIndoorFloorTileOverrideList(): IndoorFloorTileOverride[] {
    return Array.from(this.indoorFloorTileOverrides.values())
      .sort((a, b) => (a.row - b.row) || (a.col - b.col));
  }

  private restoreIndoorFloorTileOverridesFromStorage(buildingId: string): void {
    this.indoorFloorTileOverrides.clear();
    const items = loadIndoorFloorTileOverrides(buildingId) ?? [];
    for (const item of items) {
      this.indoorFloorTileOverrides.set(`${item.col},${item.row}`, { ...item });
    }
  }

  private saveIndoorFloorTileOverridesToStorage(): void {
    if (!this.currentIndoorBuildingId) return;
    try {
      saveIndoorFloorTileOverrides(this.currentIndoorBuildingId, this.getIndoorFloorTileOverrideList());
      this.saveIndoorSceneDraftToRepository('floor-tile');
      this.updateFurnitureEditorHelpText();
    } catch (error) {
      console.warn('[IndoorTileEditor] Failed to save floor tile overrides:', error);
      this.showFurnitureEditorMessage('地板瓦片自动保存失败，请检查浏览器存储权限');
    }
  }

  private refreshIndoorFloorTiles(): void {
    this.indoorLayerRenderer.updateFloor(
      this.mapData,
      this.currentFixedRoomLayout,
      this.getIndoorFloorTileOverrideList(),
    );
    this.updateIndoorDebugOverlay(0, 0);
    this.renderBuildModeOverlay();
  }

  private paintIndoorFloorTile(pointer: Phaser.Input.Pointer): void {
    if (!this.currentIndoorBuildingId || !this.canEditIndoorFloorTiles() || this.isPointInsideIndoorAssetPanel(pointer.x, pointer.y)) return;
    const floorCell = this.getIndoorFloorCellFromPointer(pointer.x, pointer.y);
    if (!floorCell) return;
    const key = `${floorCell.col},${floorCell.row}`;
    const current = this.indoorFloorTileOverrides.get(key)?.textureKey ?? null;
    if (this.selectedFloorBrushTextureKey === null) {
      if (!this.indoorFloorTileOverrides.has(key)) return;
      this.pushIndoorEditorUndoCheckpoint('恢复地板瓦片');
      this.indoorFloorTileOverrides.delete(key);
      this.refreshIndoorFloorTiles();
      this.saveIndoorFloorTileOverridesToStorage();
      this.showFurnitureEditorMessage(`已恢复默认地板：${floorCell.col},${floorCell.row}`);
      return;
    }
    if (current === this.selectedFloorBrushTextureKey) return;
    this.pushIndoorEditorUndoCheckpoint('绘制地板瓦片');
    this.indoorFloorTileOverrides.set(key, {
      col: floorCell.col,
      row: floorCell.row,
      textureKey: this.selectedFloorBrushTextureKey,
    });
    this.refreshIndoorFloorTiles();
    this.saveIndoorFloorTileOverridesToStorage();
    this.showFurnitureEditorMessage(`已绘制地板：${floorCell.col},${floorCell.row}`);
  }

  private getIndoorFloorCellFromPointer(screenX: number, screenY: number): { col: number; row: number } | null {
    if (!this.currentIndoorBuildingId) return null;
    const floorRegions = getIndoorEditableTileRegions(this.currentIndoorBuildingId, 'floor');
    if (floorRegions.length === 0) return null;
    const offset = this.indoorContainerOffset;
    const mapPos = this.indoorCoordinateMapper.screenToMap(screenX - offset.x, screenY - offset.y);
    const col = Math.round(mapPos.mapX);
    const row = Math.round(mapPos.mapY);
    if (!isIndoorTileEditable(this.currentIndoorBuildingId, 'floor', col, row)) return null;
    return { col, row };
  }

  private captureIndoorEditorUndoSnapshot(label: string): IndoorEditorUndoSnapshot | null {
    if (!this.currentIndoorBuildingId) return null;
    return {
      label,
      furniture: createFurnitureEditorSnapshot(this.currentIndoorBuildingId),
      characters: createIndoorCharacterEditorSnapshot(this.currentIndoorBuildingId),
      interactables: createInteractableEditorSnapshot(this.currentIndoorBuildingId),
      floorTileOverrides: this.getIndoorFloorTileOverrideList().map((item) => ({ ...item })),
      furnitureSelectedId: this.furnitureEditorSelectedId,
      characterSelectedId: this.characterEditorSelectedId,
      interactableSelectedId: this.interactableEditorSelectedId,
      selectedMaskIndex: this.furnitureEditorSelectedMaskIndex,
      maskActive: this.furnitureMaskEditorActive,
      editorMode: this.buildEditorMode,
      selectedFloorBrushTextureKey: this.selectedFloorBrushTextureKey,
    };
  }

  private pushIndoorEditorUndoCheckpoint(label: string): void {
    if (this.isApplyingIndoorEditorHistory || !this.furnitureEditorActive || !this.currentIndoorBuildingId) return;
    const snapshot = this.captureIndoorEditorUndoSnapshot(label);
    if (!snapshot) return;
    this.indoorEditorUndoStack.push(snapshot);
    if (this.indoorEditorUndoStack.length > INDOOR_EDITOR_HISTORY_LIMIT) this.indoorEditorUndoStack.shift();
    this.indoorEditorRedoStack = [];
    this.renderBuildModeOverlay();
  }

  private clearIndoorEditorHistory(): void {
    this.indoorEditorUndoStack = [];
    this.indoorEditorRedoStack = [];
  }

  private applyIndoorEditorUndoSnapshot(snapshot: IndoorEditorUndoSnapshot): void {
    if (!this.currentIndoorBuildingId) return;
    this.isApplyingIndoorEditorHistory = true;
    try {
      applyFurnitureEditorSnapshot(this.currentIndoorBuildingId, snapshot.furniture, { replaceMissing: true });
      applyIndoorCharacterEditorSnapshot(this.currentIndoorBuildingId, snapshot.characters, { replaceMissing: true });
      applyInteractableEditorSnapshot(this.currentIndoorBuildingId, snapshot.interactables);
      this.applyIndoorFloorTileOverrideSnapshot(snapshot.floorTileOverrides);

      this.furnitureEditorSelectedId = snapshot.furnitureSelectedId;
      this.characterEditorSelectedId = snapshot.characterSelectedId;
      this.interactableEditorSelectedId = snapshot.interactableSelectedId;
      this.furnitureEditorSelectedMaskIndex = snapshot.selectedMaskIndex;
      this.furnitureMaskEditorActive = snapshot.maskActive;
      this.buildEditorMode = snapshot.editorMode;
      this.selectedFloorBrushTextureKey = snapshot.selectedFloorBrushTextureKey;
      this.normalizeIndoorEditorSelection();

      this.furnitureEditorDrag = null;
      this.characterEditorDrag = null;
      this.interactableEditorDrag = null;
      this.indoorAssetPlacementDrag = null;
      this.pendingIndoorAssetId = null;
      this.destroyIndoorAssetDragPreview();

      this.createIndoorDecorSprites();
      this.createIndoorCharacterSprites();
      this.refreshIndoorFloorTiles();
      this.saveFurnitureEditorLayoutToStorage();
      this.saveIndoorCharacterEditorLayoutToStorage();
      this.saveInteractableEditorLayoutToStorage();
      this.saveIndoorFloorTileOverridesToStorage();
      this.createIndoorAssetPanel();
      this.createIndoorSceneObjectPanel();
      this.updateIndoorDebugOverlay(0, 0);
      this.renderBuildModeOverlay();
      this.updateFurnitureEditorHelpText();
    } finally {
      this.isApplyingIndoorEditorHistory = false;
    }
  }

  private applyIndoorFloorTileOverrideSnapshot(items: IndoorFloorTileOverride[]): void {
    this.indoorFloorTileOverrides.clear();
    for (const item of items) {
      this.indoorFloorTileOverrides.set(`${item.col},${item.row}`, { ...item });
    }
  }

  private normalizeIndoorEditorSelection(): void {
    if (!this.currentIndoorBuildingId) return;

    const characterSelected = this.characterEditorSelectedId
      ? getIndoorCharacterDefs(this.currentIndoorBuildingId).some((item) => item.id === this.characterEditorSelectedId)
      : false;
    if (!characterSelected) this.characterEditorSelectedId = null;

    const interactableSelected = this.interactableEditorSelectedId
      ? getIndoorInteractables(this.currentIndoorBuildingId).some((item) => item.id === this.interactableEditorSelectedId)
      : false;
    if (!interactableSelected) this.interactableEditorSelectedId = null;

    const furnitureSelected = this.furnitureEditorSelectedId
      ? getIndoorFurnitureDefs(this.currentIndoorBuildingId).some((item) => item.id === this.furnitureEditorSelectedId)
      : false;
    if (!furnitureSelected) {
      this.furnitureEditorSelectedId = this.characterEditorSelectedId || this.interactableEditorSelectedId
        ? null
        : getIndoorFurnitureDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
    }

    const selectedFurniture = this.getSelectedFurniture(false);
    if (
      this.furnitureEditorSelectedMaskIndex !== null &&
      !selectedFurniture?.occluderMask?.[this.furnitureEditorSelectedMaskIndex]
    ) {
      this.furnitureEditorSelectedMaskIndex = null;
    }
  }

  resetFurnitureEditorSavedLayout(): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId) return;

    this.pushIndoorEditorUndoCheckpoint('恢复默认场景');
    localStorage.removeItem(getFurnitureEditorStorageKey(this.currentIndoorBuildingId));
    localStorage.removeItem(getIndoorCharacterEditorStorageKey(this.currentIndoorBuildingId));
    localStorage.removeItem(getInteractableEditorStorageKey(this.currentIndoorBuildingId));
    clearIndoorFloorTileOverrides(this.currentIndoorBuildingId);
    this.indoorFloorTileOverrides.clear();
    const defaults = this.furnitureEditorDefaultSnapshots.get(this.currentIndoorBuildingId);
    if (defaults) {
      const defaultIds = new Set(defaults.map((item) => item.id));
      removeIndoorFurnitureDefs(this.currentIndoorBuildingId, (item) => !defaultIds.has(item.id));
      applyFurnitureEditorSnapshot(this.currentIndoorBuildingId, defaults);
      if (!defaultIds.has(this.furnitureEditorSelectedId ?? '')) {
        this.furnitureEditorSelectedId = defaults[0]?.id ?? null;
      }
      this.createIndoorDecorSprites();
      this.updateIndoorDebugOverlay(0, 0);
      this.createIndoorSceneObjectPanel();
    }
    const characterDefaults = this.characterEditorDefaultSnapshots.get(this.currentIndoorBuildingId);
    if (characterDefaults) {
      const defaultCharacterIds = new Set(characterDefaults.map((item) => item.id));
      removeIndoorCharacterDefs(this.currentIndoorBuildingId, (item) => !defaultCharacterIds.has(item.id));
      applyIndoorCharacterEditorSnapshot(this.currentIndoorBuildingId, characterDefaults);
      if (!characterDefaults.some((item) => item.id === this.characterEditorSelectedId)) {
        this.characterEditorSelectedId = characterDefaults[0]?.id ?? null;
      }
      this.createIndoorCharacterSprites();
      this.updateIndoorDebugOverlay(0, 0);
      this.createIndoorSceneObjectPanel();
    }
    const interactableDefaults = this.interactableEditorDefaultSnapshots.get(this.currentIndoorBuildingId);
    if (interactableDefaults) {
      applyInteractableEditorSnapshot(this.currentIndoorBuildingId, interactableDefaults);
    }
    this.refreshIndoorFloorTiles();
    this.sceneRepository.clearSceneDraft('indoor', this.currentIndoorBuildingId);
    this.saveIndoorSceneDraftToRepository('reset');
    this.showFurnitureEditorMessage('已清空本地保存，并恢复代码默认家具参数');
  }

  setFurnitureEditorActive(active: boolean): void {
    this.furnitureEditorActive = active && this.isIndoor && !!this.currentIndoorBuildingId;
    if (this.furnitureEditorActive && !this.furnitureEditorSelectedId && !this.characterEditorSelectedId) {
      this.furnitureEditorSelectedId = getIndoorFurnitureDefs(this.currentIndoorBuildingId)[0]?.id ?? null;
    }
    if (!this.furnitureEditorActive) {
      this.furnitureEditorDrag = null;
      this.characterEditorDrag = null;
      this.interactableEditorDrag = null;
      this.indoorAssetPlacementDrag = null;
      this.destroyIndoorAssetDragPreview();
      this.pendingIndoorAssetId = null;
      this.furnitureMaskEditorActive = false;
      this.furnitureEditorSelectedMaskIndex = null;
      this.destroyIndoorDebugOverlay();
      this.destroyIndoorAssetPanel();
      this.destroyIndoorSceneObjectPanel();
      this.buildPreviewMode = false;
      this.buildEditorMode = 'object';
    } else {
      this.createIndoorDebugOverlay();
      this.createIndoorAssetPanel();
      this.createIndoorSceneObjectPanel();
      this.updateIndoorDebugOverlay(0, 0);
    }
    this.renderBuildModeOverlay();
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

  exportIndoorCharacterEditorLayout(): string {
    const layout = getIndoorCharacterDefs(this.currentIndoorBuildingId).map((item) => ({
      ...item,
      collider: item.collider ? { ...item.collider } : undefined,
    }));
    const json = JSON.stringify(layout, null, 2);
    navigator.clipboard?.writeText(json).catch(() => undefined);
    DebugLogger.userInfo('IndoorCharacterEditor', 'Exported layout', json);
    this.showFurnitureEditorMessage('人物配置已复制到剪贴板，详情见 console.info');
    return json;
  }

  exportIndoorSceneSnapshot(): string {
    if (!this.currentIndoorBuildingId) return '';
    const snapshot = createIndoorEditableSceneSnapshot(this.currentIndoorBuildingId, {
      floorTileOverrides: this.getIndoorFloorTileOverrideList(),
    });
    this.lastIndoorSceneDraft = this.sceneRepository.saveSceneDraft(snapshot);
    const json = JSON.stringify(snapshot, null, 2);
    navigator.clipboard?.writeText(json).catch(() => undefined);
    DebugLogger.userInfo('IndoorSceneEditor', 'Exported unified scene snapshot', json);
    this.showFurnitureEditorMessage(`统一场景快照已保存并复制：${snapshot.objects.length} 个对象，详情见 console.info`);
    return json;
  }

  async saveIndoorSceneToSource(): Promise<void> {
    if (!this.currentIndoorBuildingId) return;
    const sceneId = this.currentIndoorBuildingId;
    const snapshot = createIndoorEditableSceneSnapshot(sceneId, {
      floorTileOverrides: this.getIndoorFloorTileOverrideList(),
    });
    const layout = {
      sceneId,
      savedAt: Date.now(),
      furniture: createFurnitureEditorSnapshot(sceneId),
      characters: createIndoorCharacterEditorSnapshot(sceneId),
      interactables: createInteractableEditorSnapshot(sceneId),
      floorTileOverrides: this.getIndoorFloorTileOverrideList(),
      sceneSnapshot: snapshot,
    };

    try {
      const res = await fetch('/api/save-indoor-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.removeItem(getFurnitureEditorStorageKey(sceneId));
        localStorage.removeItem(getIndoorCharacterEditorStorageKey(sceneId));
        localStorage.removeItem(getInteractableEditorStorageKey(sceneId));
        clearIndoorFloorTileOverrides(sceneId);
        this.sceneRepository.clearSceneDraft('indoor', sceneId);
        this.lastIndoorSceneDraft = null;
        this.renderBuildModeOverlay();
        this.showFurnitureEditorMessage(`已保存室内源码并清空本地草稿：${sceneId} / ${snapshot.objects.length} 个对象`);
      } else {
        this.showFurnitureEditorMessage(`室内源码保存失败：${data.error || res.statusText}`);
      }
    } catch (error: any) {
      this.showFurnitureEditorMessage(`室内源码保存失败：${error.message}`);
    }
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

  private createIndoorCharacterSprites(): void {
    this.destroyIndoorCharacterSprites();
    if (!this.indoorContainer || !this.currentIndoorBuildingId) return;

    const storyNpcCharacterIds = getStoryNpcSourceCharacterIds(this.currentIndoorBuildingId);
    const characters = getIndoorCharacterDefs(this.currentIndoorBuildingId)
      .filter((character) => !storyNpcCharacterIds.has(character.id));
    if (characters.length === 0) return;

    for (const character of characters) {
      if (!this.scene.textures.exists(character.textureKey)) continue;

      const { mapX, mapY } = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        character.localX,
        character.localY,
      );
      const depthPosition = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        character.depthLocalX ?? character.localX,
        character.depthLocalY ?? character.localY,
      );
      const position = this.indoorCoordinateMapper.mapToScreen(mapX, mapY);

      const img = this.scene.add.image(
        position.x + (character.pixelOffsetX ?? 0),
        position.y + (character.pixelOffsetY ?? 0),
        character.textureKey,
      )
        .setOrigin(character.originX ?? 0.5, character.originY ?? 1)
        .setScale(character.scale ?? 1)
        .setAlpha(character.alpha ?? 1)
        .setDepth(this.getIndoorCharacterDepth(character, depthPosition.mapX, depthPosition.mapY));

      this.indoorContainer.add(img);
      this.indoorCharacterSprites.set(character.id, img);
    }

    this.indoorContainer.sort('depth');
  }

  private destroyIndoorDecorSprites(): void {
    this.destroyIndoorFurnitureOccluders();
    for (const sprite of this.indoorDecorSprites) sprite.destroy();
    this.indoorDecorSprites = [];
    this.indoorFurnitureSprites.clear();
  }

  private destroyIndoorCharacterSprites(): void {
    for (const sprite of this.indoorCharacterSprites.values()) sprite.destroy();
    this.indoorCharacterSprites.clear();
  }

  private destroyIndoorFurnitureOccluders(): void {
    this.furnitureOccluderRenderer.destroyAll();
  }

  private createIndoorDebugOverlay(): void {
    this.destroyIndoorDebugOverlay();
    if (!this.indoorContainer || !this.currentIndoorBuildingId) return;

    this.indoorDebugGraphics = this.scene.add.graphics().setDepth(10000);
    this.indoorContainer.add(this.indoorDebugGraphics);

    const floorRegions = getIndoorEditableTileRegions(this.currentIndoorBuildingId, 'floor');
    if (floorRegions.length === 0) return;

    for (const region of floorRegions) {
      for (let row = region.rowStart; row <= region.rowEnd; row++) {
        for (let col = region.colStart; col <= region.colEnd; col++) {
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
  }

  private updateIndoorDebugOverlay(playerCol: number, playerRow: number): void {
    if (!this.indoorDebugGraphics || !this.currentIndoorBuildingId) return;

    const g = this.indoorDebugGraphics;
    g.clear();

    const floorRegions = getIndoorEditableTileRegions(this.currentIndoorBuildingId, 'floor');
    if (floorRegions.length > 0) {
      g.lineStyle(1, 0x60a5fa, 0.22);
      for (const region of floorRegions) {
        for (let row = region.rowStart; row <= region.rowEnd; row++) {
          for (let col = region.colStart; col <= region.colEnd; col++) {
            strokeIndoorDiamond(g, this.indoorCoordinateMapper, col, row, 0x60a5fa, 0.22);
          }
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

    for (const character of getIndoorCharacterDefs(this.currentIndoorBuildingId)) {
      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, character.localX, character.localY);
      const anchorScreen = this.indoorCoordinateMapper.mapToScreen(anchor.mapX, anchor.mapY);
      const depthPoint = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        character.depthLocalX ?? character.localX,
        character.depthLocalY ?? character.localY,
      );
      const depthScreen = this.indoorCoordinateMapper.mapToScreen(depthPoint.mapX, depthPoint.mapY);
      const selected = character.id === this.characterEditorSelectedId;

      if (character.collider) {
        const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, character.collider);
        strokeIndoorRectBounds(g, this.indoorCoordinateMapper, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0x34d399, selected ? 0.9 : 0.5);
      }

      g.lineStyle(selected ? 3 : 2, 0x34d399, 1);
      g.fillStyle(0x052e2b, 0.58);
      g.fillCircle(anchorScreen.x, anchorScreen.y, selected ? 6 : 5);
      g.strokeCircle(anchorScreen.x, anchorScreen.y, selected ? 7 : 6);

      g.fillStyle(0x38bdf8, 1);
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

  private createIndoorAssetPanel(): void {
    this.destroyIndoorAssetPanel();
    if (!this.buildOverlayAdvanced) return;

    const panelWidth = 206;
    const rowHeight = 44;
    const panelHeight = 54 + INDOOR_ASSET_LIBRARY.length * rowHeight;
    const panelX = SCREEN_WIDTH - panelWidth - 12;
    const panelY = 42;
    const panel = this.scene.add.container(panelX, panelY).setDepth(20000);
    panel.setScrollFactor(0);
    this.indoorAssetPanelBounds = new Phaser.Geom.Rectangle(panelX, panelY, panelWidth, panelHeight);

    const bg = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x111827, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x334155, 0.95);
    panel.add(bg);

    const title = this.scene.add.text(10, 8, '室内素材库', {
      fontSize: '13px',
      color: '#f8fafc',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    });
    panel.add(title);

    const hint = this.scene.add.text(10, 28, '点击或拖到场景放置', {
      fontSize: '10px',
      color: '#cbd5e1',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    });
    panel.add(hint);

    INDOOR_ASSET_LIBRARY.forEach((asset, index) => {
      const y = 50 + index * rowHeight;
      const selected = asset.id === this.pendingIndoorAssetId;
      const rowBg = this.scene.add.rectangle(8, y, panelWidth - 16, rowHeight - 6, selected ? 0x14532d : 0x1f2937, selected ? 0.95 : 0.78)
        .setOrigin(0, 0)
        .setStrokeStyle(1, selected ? 0x86efac : 0x475569, selected ? 1 : 0.6)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
        this.beginIndoorAssetPlacementDrag(asset.id, pointer);
      });
      panel.add(rowBg);

      if (this.scene.textures.exists(asset.textureKey)) {
        const icon = this.scene.add.image(26, y + 19, asset.textureKey)
          .setOrigin(0.5)
          .setDisplaySize(28, 28);
        panel.add(icon);
      }

      const kindLabel = asset.kind === 'character'
        ? '人物'
        : asset.kind === 'furniture'
          ? '家具'
          : '墙贴';
      const text = this.scene.add.text(48, y + 8, `${asset.name} · ${kindLabel}`, {
        fontSize: '12px',
        color: selected ? '#dcfce7' : '#e5e7eb',
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      });
      panel.add(text);
    });

    this.indoorAssetPanel = panel;
  }

  private createIndoorSceneObjectPanel(): void {
    this.destroyIndoorSceneObjectPanel();
    if (!this.buildOverlayAdvanced) return;
    if (!this.currentIndoorBuildingId) return;

    const snapshot = createIndoorEditableSceneSnapshot(this.currentIndoorBuildingId, {
      floorTileOverrides: this.getIndoorFloorTileOverrideList(),
    });
    const panelWidth = 250;
    const rowHeight = 26;
    const maxRows = 12;
    const visibleObjects = snapshot.objects.slice(0, maxRows);
    const panelHeight = 84 + visibleObjects.length * rowHeight + (snapshot.objects.length > maxRows ? 20 : 0);
    const panelX = SCREEN_WIDTH - panelWidth - 12;
    const panelY = 42 + 54 + INDOOR_ASSET_LIBRARY.length * 44 + 10;
    const panel = this.scene.add.container(panelX, panelY).setDepth(20000);
    panel.setScrollFactor(0);
    this.indoorSceneObjectPanelBounds = new Phaser.Geom.Rectangle(panelX, panelY, panelWidth, panelHeight);

    const bg = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x0f172a, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x475569, 0.95);
    panel.add(bg);

    const title = this.scene.add.text(10, 8, '当前场景对象', {
      fontSize: '13px',
      color: '#f8fafc',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    });
    panel.add(title);

    const savedAtText = this.lastIndoorSceneDraft
      ? new Date(this.lastIndoorSceneDraft.savedAt).toLocaleTimeString()
      : '未保存';
    const draftText = this.scene.add.text(10, 28, `Draft: ${savedAtText} · ${snapshot.objects.length} objects`, {
      fontSize: '10px',
      color: '#cbd5e1',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    });
    panel.add(draftText);

    const schemaText = this.scene.add.text(10, 44, `${snapshot.sceneId} / ${snapshot.sceneType} -> scene_objects`, {
      fontSize: '10px',
      color: '#93c5fd',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    });
    panel.add(schemaText);

    visibleObjects.forEach((object, index) => {
      const y = 64 + index * rowHeight;
      const selected = this.isSceneObjectSelected(object);
      const rowBg = this.scene.add.rectangle(8, y, panelWidth - 16, rowHeight - 3, selected ? 0x1d4ed8 : 0x1e293b, selected ? 0.9 : 0.74)
        .setOrigin(0, 0)
        .setStrokeStyle(1, selected ? 0x93c5fd : 0x334155, selected ? 1 : 0.55)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
        this.selectSceneObjectFromPanel(object);
      });
      panel.add(rowBg);

      const kindLabel = this.getSceneObjectKindLabel(object);
      const assetLabel = object.assetId ? ` · ${object.assetId}` : '';
      const text = this.scene.add.text(14, y + 5, `${kindLabel} ${object.id}${assetLabel}`, {
        fontSize: '10px',
        color: selected ? '#eff6ff' : '#e5e7eb',
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      });
      text.setCrop(0, 0, panelWidth - 28, rowHeight - 4);
      panel.add(text);
    });

    if (snapshot.objects.length > maxRows) {
      const more = this.scene.add.text(10, 64 + visibleObjects.length * rowHeight + 2, `还有 ${snapshot.objects.length - maxRows} 个对象，后续加滚动/搜索`, {
        fontSize: '10px',
        color: '#94a3b8',
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      });
      panel.add(more);
    }

    this.indoorSceneObjectPanel = panel;
  }

  private destroyIndoorAssetPanel(): void {
    this.indoorAssetPanel?.destroy(true);
    this.indoorAssetPanel = null;
    this.indoorAssetPanelBounds = null;
  }

  private destroyIndoorSceneObjectPanel(): void {
    this.indoorSceneObjectPanel?.destroy(true);
    this.indoorSceneObjectPanel = null;
    this.indoorSceneObjectPanelBounds = null;
  }

  private beginIndoorAssetPlacementDrag(assetId: string, pointer: Phaser.Input.Pointer): void {
    this.pendingIndoorAssetId = assetId;
    this.indoorAssetPlacementDrag = {
      assetId,
      startX: pointer.x,
      startY: pointer.y,
      hasMoved: false,
    };
    this.destroyIndoorAssetDragPreview();
    this.furnitureEditorDrag = null;
    this.characterEditorDrag = null;
    this.interactableEditorDrag = null;
    this.createIndoorAssetPanel();
    this.createIndoorSceneObjectPanel();
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
  }

  private updateIndoorAssetDragPreview(pointer: Phaser.Input.Pointer): void {
    const drag = this.indoorAssetPlacementDrag;
    if (!drag) return;
    const asset = getIndoorAsset(drag.assetId);
    if (!asset) return;

    if (!drag.hasMoved && Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) > 6) {
      drag.hasMoved = true;
    }
    if (!drag.hasMoved) return;

    if (!this.indoorAssetDragPreview && this.scene.textures.exists(asset.textureKey)) {
      const frame = this.scene.textures.getFrame(asset.textureKey);
      const previewScale = frame ? 44 / Math.max(frame.width, frame.height) : 1;
      this.indoorAssetDragPreview = this.scene.add.image(pointer.x, pointer.y, asset.textureKey)
        .setOrigin(0.5)
        .setScale(previewScale)
        .setAlpha(0.72)
        .setDepth(21000)
        .setScrollFactor(0);
    }
    this.indoorAssetDragPreview?.setPosition(pointer.x, pointer.y);
  }

  private endIndoorAssetPlacementDrag(pointer: Phaser.Input.Pointer): boolean {
    const drag = this.indoorAssetPlacementDrag;
    if (!drag) return false;

    this.indoorAssetPlacementDrag = null;
    this.destroyIndoorAssetDragPreview();
    if (!drag.hasMoved || this.isPointInsideIndoorAssetPanel(pointer.x, pointer.y)) {
      return true;
    }
    if (!this.currentIndoorBuildingId) return true;

    const localPos = this.indoorCoordinateMapper.screenToLocal(this.currentIndoorBuildingId, pointer.x, pointer.y);
    this.placePendingIndoorAsset(roundEditorValue(localPos.localX), roundEditorValue(localPos.localY));
    return true;
  }

  private destroyIndoorAssetDragPreview(): void {
    this.indoorAssetDragPreview?.destroy();
    this.indoorAssetDragPreview = null;
  }

  private isPointInsideIndoorAssetPanel(x: number, y: number): boolean {
    return !!this.indoorAssetPanelBounds?.contains(x, y) || !!this.indoorSceneObjectPanelBounds?.contains(x, y);
  }

  private isSceneObjectSelected(object: PlacedSceneObject): boolean {
    if (object.kind === 'indoorCharacter') return this.characterEditorSelectedId === object.id;
    if (object.kind === 'interactable') return this.interactableEditorSelectedId === object.id;
    return this.furnitureEditorSelectedId === object.id;
  }

  private selectSceneObjectFromPanel(object: PlacedSceneObject): void {
    this.furnitureEditorDrag = null;
    this.characterEditorDrag = null;
    this.interactableEditorDrag = null;
    this.furnitureEditorSelectedMaskIndex = null;
    this.pendingIndoorAssetId = null;

    if (object.kind === 'indoorCharacter') {
      this.characterEditorSelectedId = object.id;
      this.furnitureEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
    } else if (object.kind === 'interactable') {
      this.interactableEditorSelectedId = object.id;
      this.characterEditorSelectedId = null;
      this.furnitureEditorSelectedId = null;
    } else {
      this.furnitureEditorSelectedId = object.id;
      this.characterEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
    }

    this.createIndoorAssetPanel();
    this.createIndoorSceneObjectPanel();
    this.renderBuildModeOverlay();
    this.updateIndoorDebugOverlay(0, 0);
    this.updateFurnitureEditorHelpText();
  }

  private getSceneObjectKindLabel(object: PlacedSceneObject): string {
    if (object.kind === 'indoorCharacter') return '[人物]';
    if (object.kind === 'wallDecor') return '[墙贴]';
    if (object.kind === 'indoorFurniture') return '[家具]';
    if (object.kind === 'interactable') return '[交互]';
    return `[${object.kind}]`;
  }

  private renderBuildModeOverlay(): void {
    const snapshot = this.currentIndoorBuildingId
      ? createIndoorEditableSceneSnapshot(this.currentIndoorBuildingId, {
          floorTileOverrides: this.getIndoorFloorTileOverrideList(),
        })
      : null;
    this.buildModeOverlay.render({
      active: this.furnitureEditorActive,
      sceneId: this.currentIndoorBuildingId,
      assets: INDOOR_ASSET_LIBRARY,
      snapshot,
      selectedObject: snapshot ? this.getSelectedSceneObject(snapshot.objects) : null,
      pendingAssetId: this.pendingIndoorAssetId,
      draft: this.lastIndoorSceneDraft,
      advanced: this.buildOverlayAdvanced,
      maskActive: this.furnitureMaskEditorActive,
      previewMode: this.buildPreviewMode,
      editorMode: this.buildEditorMode,
      tileEditingAvailable: this.canEditIndoorFloorTiles(),
      tileBrushes: this.getIndoorFloorBrushes(),
      selectedTileBrush: this.selectedFloorBrushTextureKey,
      floorOverrideCount: this.indoorFloorTileOverrides.size,
      canUndo: this.indoorEditorUndoStack.length > 0,
      canRedo: this.indoorEditorRedoStack.length > 0,
    });
  }

  private getSelectedSceneObject(objects: PlacedSceneObject[]): PlacedSceneObject | null {
    return objects.find((object) => this.isSceneObjectSelected(object)) ?? null;
  }

  private selectIndoorAssetForPlacement(assetId: string): void {
    if (!this.furnitureEditorActive) return;
    this.buildEditorMode = 'object';
    const asset = getIndoorAsset(assetId);
    if (!asset) return;
    this.pendingIndoorAssetId = asset.id;
    this.furnitureEditorDrag = null;
    this.characterEditorDrag = null;
    this.interactableEditorDrag = null;
    this.destroyIndoorAssetDragPreview();
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
    this.showFurnitureEditorMessage(`待放置素材：${asset.name}`);
  }

  private selectSceneObjectById(objectId: string): void {
    if (!this.currentIndoorBuildingId) return;
    const snapshot = createIndoorEditableSceneSnapshot(this.currentIndoorBuildingId, {
      floorTileOverrides: this.getIndoorFloorTileOverrideList(),
    });
    const object = snapshot.objects.find((item) => item.id === objectId);
    if (object) this.selectSceneObjectFromPanel(object);
  }

  private toggleBuildOverlayAdvanced(): void {
    if (!this.furnitureEditorActive) return;
    this.buildOverlayAdvanced = !this.buildOverlayAdvanced;
    if (!this.buildOverlayAdvanced) {
      this.destroyIndoorAssetPanel();
      this.destroyIndoorSceneObjectPanel();
    } else {
      this.createIndoorAssetPanel();
      this.createIndoorSceneObjectPanel();
    }
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
  }

  private setBuildEditorMode(mode: BuildEditorMode): void {
    if (!this.furnitureEditorActive) return;
    if (mode === 'tile' && !this.canEditIndoorFloorTiles()) return;
    this.buildEditorMode = mode;
    this.pendingIndoorAssetId = null;
    this.indoorAssetPlacementDrag = null;
    this.destroyIndoorAssetDragPreview();
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
  }

  private selectFloorTileBrush(textureKey: string | null): void {
    if (!this.furnitureEditorActive || !this.canEditIndoorFloorTiles()) return;
    this.buildEditorMode = 'tile';
    this.selectedFloorBrushTextureKey = textureKey;
    this.pendingIndoorAssetId = null;
    this.renderBuildModeOverlay();
    this.showFurnitureEditorMessage(textureKey ? `已切换地板笔刷：${textureKey}` : '已切换地板橡皮');
  }

  private toggleBuildPreviewMode(): void {
    if (!this.furnitureEditorActive) return;
    this.buildPreviewMode = !this.buildPreviewMode;
    this.indoorDebugGraphics?.setVisible(!this.buildPreviewMode);
    this.renderBuildModeOverlay();
  }

  private enterBuildSelectMode(): void {
    if (!this.furnitureEditorActive) return;
    this.buildEditorMode = 'object';
    this.pendingIndoorAssetId = null;
    this.indoorAssetPlacementDrag = null;
    this.destroyIndoorAssetDragPreview();
    this.furnitureEditorDrag = null;
    this.characterEditorDrag = null;
    this.interactableEditorDrag = null;
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
  }

  private updateSelectedFieldFromOverlay(field: BuildEditableField, value: BuildFieldValue): void {
    if (!this.currentIndoorBuildingId) return;

    const character = this.getSelectedCharacter();
    if (character) {
      this.pushIndoorEditorUndoCheckpoint('修改人物属性');
      this.applyCharacterFieldUpdate(character, field, value);
      return;
    }

    const interactable = this.getSelectedInteractable();
    if (interactable) {
      this.pushIndoorEditorUndoCheckpoint('修改交互区属性');
      this.applyInteractableFieldUpdate(interactable, field, value);
      return;
    }

    const furniture = this.getSelectedFurniture(false);
    if (furniture) {
      this.pushIndoorEditorUndoCheckpoint('修改家具属性');
      this.applyFurnitureFieldUpdate(furniture, field, value);
    }
  }

  private applyFurnitureFieldUpdate(
    furniture: IndoorFurnitureDef,
    field: BuildEditableField,
    value: BuildFieldValue,
  ): void {
    if (field === 'positionX' || field === 'positionY') {
      const nextX = field === 'positionX' ? this.parseEditorNumber(value, furniture.localX) : furniture.localX;
      const nextY = field === 'positionY' ? this.parseEditorNumber(value, furniture.localY) : furniture.localY;
      this.moveFurnitureAnchor(furniture, nextX, nextY);
      this.updateFurnitureSprite(furniture);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (field === 'scale') {
      furniture.scale = this.parsePositiveEditorNumber(value, furniture.scale ?? 1, 0.05);
      this.updateFurnitureSprite(furniture);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (field === 'depthX' || field === 'depthY') {
      if (field === 'depthX') {
        furniture.depthLocalX = this.parseEditorNumber(value, furniture.depthLocalX ?? furniture.localX);
      } else {
        furniture.depthLocalY = this.parseEditorNumber(value, furniture.depthLocalY ?? furniture.localY);
      }
      this.updateFurnitureSprite(furniture);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (field === 'rotation') {
      furniture.rotation = this.parseEditorNumber(value, furniture.rotation ?? 0);
      this.updateFurnitureSprite(furniture);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (field === 'layer') {
      const nextLayer = value === 'wall' ? 'wall' : 'object';
      furniture.renderLayer = nextLayer;
      this.updateFurnitureSprite(furniture);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (field === 'colliderEnabled') {
      const enabled = value === true || value === 'true';
      furniture.collider = enabled ? (furniture.collider ?? this.createDefaultLocalCollider(furniture.localX, furniture.localY)) : undefined;
      this.updateFurnitureSprite(furniture);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveFurnitureEditorLayoutToStorage();
      return;
    }

    if (this.applyFurnitureColliderFieldUpdate(furniture, field, value)) return;
  }

  private applyCharacterFieldUpdate(
    character: IndoorCharacterDef,
    field: BuildEditableField,
    value: BuildFieldValue,
  ): void {
    if (field === 'positionX' || field === 'positionY') {
      const nextX = field === 'positionX' ? this.parseEditorNumber(value, character.localX) : character.localX;
      const nextY = field === 'positionY' ? this.parseEditorNumber(value, character.localY) : character.localY;
      this.moveCharacterAnchor(character, nextX, nextY);
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      return;
    }

    if (field === 'scale') {
      character.scale = this.parsePositiveEditorNumber(value, character.scale ?? 1, 0.05);
      this.updateIndoorCharacterSprite(character);
      this.saveIndoorCharacterEditorLayoutToStorage();
      return;
    }

    if (field === 'depthX' || field === 'depthY') {
      if (field === 'depthX') {
        character.depthLocalX = this.parseEditorNumber(value, character.depthLocalX ?? character.localX);
      } else {
        character.depthLocalY = this.parseEditorNumber(value, character.depthLocalY ?? character.localY);
      }
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      return;
    }

    if (field === 'colliderEnabled') {
      const enabled = value === true || value === 'true';
      character.collider = enabled ? (character.collider ?? this.createDefaultLocalCollider(character.localX, character.localY)) : undefined;
      this.updateIndoorCharacterSprite(character);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveIndoorCharacterEditorLayoutToStorage();
      return;
    }

    if (this.applyCharacterColliderFieldUpdate(character, field, value)) return;
  }

  private applyInteractableFieldUpdate(
    interactable: IndoorInteractableDef,
    field: BuildEditableField,
    value: BuildFieldValue,
  ): void {
    if (field === 'positionX' || field === 'positionY') {
      const center = this.getInteractableLocalCenter(interactable);
      const nextX = field === 'positionX' ? this.parseEditorNumber(value, center.localX) : center.localX;
      const nextY = field === 'positionY' ? this.parseEditorNumber(value, center.localY) : center.localY;
      this.updateInteractableEditorDrag({ interactable, kind: 'interaction-center' }, nextX, nextY);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveInteractableEditorLayoutToStorage();
      return;
    }

    if (field === 'interactRadius') {
      const fallback = interactable.interactRadius ?? 1;
      interactable.interactRadius = this.parsePositiveEditorNumber(value, fallback, 0);
      this.updateIndoorDebugOverlay(0, 0);
      this.saveInteractableEditorLayoutToStorage();
      return;
    }

    if (!isInteractableField(field)) return;
    const zone = this.ensureInteractableZone(interactable);
    if (field === 'interactionMinX') zone.minLocalX = this.parseEditorNumber(value, zone.minLocalX);
    if (field === 'interactionMaxX') zone.maxLocalX = this.parseEditorNumber(value, zone.maxLocalX);
    if (field === 'interactionMinY') zone.minLocalY = this.parseEditorNumber(value, zone.minLocalY);
    if (field === 'interactionMaxY') zone.maxLocalY = this.parseEditorNumber(value, zone.maxLocalY);
    normalizeInteractableZone(interactable);
    const center = this.getInteractableLocalCenter(interactable);
    const actual = toActualIndoorMapPosition(interactable.buildingId, center.localX, center.localY);
    interactable.mapX = roundEditorValue(actual.mapX);
    interactable.mapY = roundEditorValue(actual.mapY);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveInteractableEditorLayoutToStorage();
  }

  private applyFurnitureColliderFieldUpdate(
    furniture: IndoorFurnitureDef,
    field: BuildEditableField,
    value: BuildFieldValue,
  ): boolean {
    if (!isColliderBoundsField(field)) return false;
    furniture.collider = furniture.collider ?? this.createDefaultLocalCollider(furniture.localX, furniture.localY);
    this.updateLocalColliderField(furniture.collider, field, value);
    normalizeFurnitureCollider(furniture);
    this.updateFurnitureSprite(furniture);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveFurnitureEditorLayoutToStorage();
    return true;
  }

  private applyCharacterColliderFieldUpdate(
    character: IndoorCharacterDef,
    field: BuildEditableField,
    value: BuildFieldValue,
  ): boolean {
    if (!isColliderBoundsField(field)) return false;
    character.collider = character.collider ?? this.createDefaultLocalCollider(character.localX, character.localY);
    this.updateLocalColliderField(character.collider, field, value);
    this.normalizeLocalCollider(character.collider);
    this.updateIndoorCharacterSprite(character);
    this.updateIndoorDebugOverlay(0, 0);
    this.saveIndoorCharacterEditorLayoutToStorage();
    return true;
  }

  private updateLocalColliderField(
    collider: IndoorLocalColliderBounds,
    field: BuildColliderField,
    value: BuildFieldValue,
  ): void {
    if (field === 'colliderMinX') collider.minLocalX = this.parseEditorNumber(value, collider.minLocalX);
    if (field === 'colliderMaxX') collider.maxLocalX = this.parseEditorNumber(value, collider.maxLocalX);
    if (field === 'colliderMinY') collider.minLocalY = this.parseEditorNumber(value, collider.minLocalY);
    if (field === 'colliderMaxY') collider.maxLocalY = this.parseEditorNumber(value, collider.maxLocalY);
  }

  private normalizeLocalCollider(collider: IndoorLocalColliderBounds): void {
    const minX = Math.min(collider.minLocalX, collider.maxLocalX);
    const maxX = Math.max(collider.minLocalX, collider.maxLocalX);
    const minY = Math.min(collider.minLocalY, collider.maxLocalY);
    const maxY = Math.max(collider.minLocalY, collider.maxLocalY);
    collider.minLocalX = roundEditorValue(minX);
    collider.maxLocalX = roundEditorValue(maxX);
    collider.minLocalY = roundEditorValue(minY);
    collider.maxLocalY = roundEditorValue(maxY);
  }

  private ensureInteractableZone(interactable: IndoorInteractableDef): NonNullable<IndoorInteractableDef['interactionZone']> {
    if (!interactable.interactionZone) {
      const center = this.getInteractableLocalCenter(interactable);
      interactable.interactionZone = {
        type: 'rect',
        minLocalX: roundEditorValue(center.localX - 0.5),
        maxLocalX: roundEditorValue(center.localX + 0.5),
        minLocalY: roundEditorValue(center.localY - 0.5),
        maxLocalY: roundEditorValue(center.localY + 0.5),
      };
    }
    return interactable.interactionZone;
  }

  private moveFurnitureAnchor(furniture: IndoorFurnitureDef, nextX: number, nextY: number): void {
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
  }

  private moveCharacterAnchor(character: IndoorCharacterDef, nextX: number, nextY: number): void {
    const dx = nextX - character.localX;
    const dy = nextY - character.localY;
    character.localX = nextX;
    character.localY = nextY;

    if (character.depthLocalX !== undefined) character.depthLocalX = roundEditorValue(character.depthLocalX + dx);
    if (character.depthLocalY !== undefined) character.depthLocalY = roundEditorValue(character.depthLocalY + dy);
    if (character.collider) {
      character.collider.minLocalX = roundEditorValue(character.collider.minLocalX + dx);
      character.collider.maxLocalX = roundEditorValue(character.collider.maxLocalX + dx);
      character.collider.minLocalY = roundEditorValue(character.collider.minLocalY + dy);
      character.collider.maxLocalY = roundEditorValue(character.collider.maxLocalY + dy);
    }
  }

  private createDefaultLocalCollider(localX: number, localY: number): IndoorLocalColliderBounds {
    return {
      minLocalX: roundEditorValue(localX - 0.5),
      maxLocalX: roundEditorValue(localX + 0.5),
      minLocalY: roundEditorValue(localY - 0.5),
      maxLocalY: roundEditorValue(localY + 0.5),
    };
  }

  private parseEditorNumber(value: BuildFieldValue, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return roundEditorValue(parsed);
  }

  private parsePositiveEditorNumber(value: BuildFieldValue, fallback: number, min: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.round(parsed * 100) / 100);
  }

  private onFurnitureEditorPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.furnitureEditorActive || !this.currentIndoorBuildingId || !this.indoorContainer) return;

    if (this.buildEditorMode === 'tile') {
      this.paintIndoorFloorTile(pointer);
      return;
    }

    if (this.pendingIndoorAssetId) {
      if (this.isPointInsideIndoorAssetPanel(pointer.x, pointer.y)) return;
      const localPos = this.indoorCoordinateMapper.screenToLocal(this.currentIndoorBuildingId, pointer.x, pointer.y);
      this.placePendingIndoorAsset(roundEditorValue(localPos.localX), roundEditorValue(localPos.localY));
      return;
    }

    if (this.furnitureMaskEditorActive) {
      const maskHandle = this.findFurnitureMaskHandle(pointer.x, pointer.y);
      if (maskHandle) {
        this.furnitureEditorSelectedId = maskHandle.furniture.id;
        this.characterEditorSelectedId = null;
        this.furnitureEditorSelectedMaskIndex = maskHandle.maskIndex ?? null;
        if (this.isMaskDeletePointer(pointer)) {
          (pointer.event as MouseEvent | undefined)?.preventDefault();
          this.pushIndoorEditorUndoCheckpoint('删除遮挡 Mask 点');
          this.deleteFurnitureMaskPoint(maskHandle.furniture, maskHandle.maskIndex);
          return;
        }
        this.pushIndoorEditorUndoCheckpoint('拖动遮挡 Mask 点');
        this.furnitureEditorDrag = maskHandle;
        this.renderBuildModeOverlay();
        this.updateFurnitureEditorHelpText();
        return;
      }

      const selected = this.getSelectedFurniture();
      const point = selected ? this.screenToFurniturePixel(selected, pointer.x, pointer.y) : null;
      if (selected && point) {
        this.pushIndoorEditorUndoCheckpoint('新增遮挡 Mask 点');
        this.characterEditorSelectedId = null;
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
        this.renderBuildModeOverlay();
        this.updateFurnitureEditorHelpText();
        return;
      }
    }

    const characterHandle = this.findIndoorCharacterEditorHandle(pointer.x, pointer.y, this.isShiftPointer(pointer));
    if (characterHandle) {
      this.pushIndoorEditorUndoCheckpoint('拖动人物');
      this.characterEditorSelectedId = characterHandle.character.id;
      this.furnitureEditorSelectedId = null;
      this.interactableEditorSelectedId = null;
      this.furnitureEditorSelectedMaskIndex = null;
      this.characterEditorDrag = characterHandle;
      this.furnitureEditorDrag = null;
      this.interactableEditorDrag = null;
      this.renderBuildModeOverlay();
      this.updateFurnitureEditorHelpText();
      return;
    }

    const interactableHandle = this.findInteractableEditorHandle(pointer.x, pointer.y);
    if (interactableHandle) {
      this.pushIndoorEditorUndoCheckpoint('拖动交互区');
      this.interactableEditorSelectedId = interactableHandle.interactable.id;
      this.interactableEditorDrag = interactableHandle;
      this.furnitureEditorDrag = null;
      this.characterEditorDrag = null;
      this.characterEditorSelectedId = null;
      this.renderBuildModeOverlay();
      this.updateFurnitureEditorHelpText();
      return;
    }

    const handle = this.findFurnitureEditorHandle(pointer.x, pointer.y, this.isShiftPointer(pointer));
    if (!handle) return;

    this.pushIndoorEditorUndoCheckpoint('拖动家具');
    if (this.furnitureEditorSelectedId !== handle.furniture.id) {
      this.furnitureEditorSelectedMaskIndex = null;
    }
    this.furnitureEditorSelectedId = handle.furniture.id;
    this.characterEditorSelectedId = null;
    this.furnitureEditorDrag = handle;
    this.characterEditorDrag = null;
    this.renderBuildModeOverlay();
    this.updateFurnitureEditorHelpText();
  }

  private onFurnitureEditorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.furnitureEditorActive && this.indoorAssetPlacementDrag) {
      this.updateIndoorAssetDragPreview(pointer);
    }

    if (
      !this.furnitureEditorActive ||
      (!this.furnitureEditorDrag && !this.characterEditorDrag && !this.interactableEditorDrag) ||
      !this.currentIndoorBuildingId
    ) return;

    const localPos = this.indoorCoordinateMapper.screenToLocal(this.currentIndoorBuildingId, pointer.x, pointer.y);

    if (this.interactableEditorDrag) {
      const nextX = roundEditorValue(localPos.localX);
      const nextY = roundEditorValue(localPos.localY);
      this.updateInteractableEditorDrag(this.interactableEditorDrag, nextX, nextY);
      this.updateFurnitureEditorHelpText();
      return;
    }

    if (this.characterEditorDrag) {
      const nextX = roundEditorValue(localPos.localX);
      const nextY = roundEditorValue(localPos.localY);
      this.updateIndoorCharacterEditorDrag(this.characterEditorDrag, nextX, nextY);
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

  private onFurnitureEditorPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.furnitureEditorActive && this.endIndoorAssetPlacementDrag(pointer)) {
      return;
    }
    if (this.furnitureEditorDrag) {
      this.saveFurnitureEditorLayoutToStorage();
    }
    if (this.interactableEditorDrag) {
      this.saveInteractableEditorLayoutToStorage();
    }
    if (this.characterEditorDrag) {
      this.saveIndoorCharacterEditorLayoutToStorage();
    }
    this.furnitureEditorDrag = null;
    this.characterEditorDrag = null;
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

  private updateIndoorCharacterEditorDrag(drag: CharacterEditorDrag, nextX: number, nextY: number): void {
    const { character, kind } = drag;
    if (kind === 'character-anchor') {
      const dx = nextX - character.localX;
      const dy = nextY - character.localY;
      character.localX = nextX;
      character.localY = nextY;
      if (character.depthLocalX !== undefined) character.depthLocalX = roundEditorValue(character.depthLocalX + dx);
      if (character.depthLocalY !== undefined) character.depthLocalY = roundEditorValue(character.depthLocalY + dy);
      if (character.collider) {
        character.collider.minLocalX = roundEditorValue(character.collider.minLocalX + dx);
        character.collider.maxLocalX = roundEditorValue(character.collider.maxLocalX + dx);
        character.collider.minLocalY = roundEditorValue(character.collider.minLocalY + dy);
        character.collider.maxLocalY = roundEditorValue(character.collider.maxLocalY + dy);
      }
    } else if (kind === 'character-depth') {
      character.depthLocalX = nextX;
      character.depthLocalY = nextY;
    } else {
      if (!character.collider) {
        character.collider = {
          minLocalX: character.localX - 0.5,
          maxLocalX: character.localX + 0.5,
          minLocalY: character.localY - 0.5,
          maxLocalY: character.localY + 0.5,
        };
      }
      if (kind === 'character-nw' || kind === 'character-sw') character.collider.minLocalX = nextX;
      if (kind === 'character-ne' || kind === 'character-se') character.collider.maxLocalX = nextX;
      if (kind === 'character-nw' || kind === 'character-ne') character.collider.minLocalY = nextY;
      if (kind === 'character-sw' || kind === 'character-se') character.collider.maxLocalY = nextY;
      this.normalizeIndoorCharacterCollider(character);
    }
    this.updateIndoorCharacterSprite(character);
  }

  private normalizeIndoorCharacterCollider(character: IndoorCharacterDef): void {
    if (!character.collider) return;
    const minX = Math.min(character.collider.minLocalX, character.collider.maxLocalX);
    const maxX = Math.max(character.collider.minLocalX, character.collider.maxLocalX);
    const minY = Math.min(character.collider.minLocalY, character.collider.maxLocalY);
    const maxY = Math.max(character.collider.minLocalY, character.collider.maxLocalY);
    character.collider.minLocalX = roundEditorValue(minX);
    character.collider.maxLocalX = roundEditorValue(maxX);
    character.collider.minLocalY = roundEditorValue(minY);
    character.collider.maxLocalY = roundEditorValue(maxY);
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

  private findIndoorCharacterEditorHandle(screenX: number, screenY: number, preferDepth = false): CharacterEditorDrag | null {
    if (!this.currentIndoorBuildingId) return null;

    const handles: Array<CharacterEditorDrag & { x: number; y: number }> = [];
    for (const character of getIndoorCharacterDefs(this.currentIndoorBuildingId)) {
      const anchor = toActualIndoorMapPosition(this.currentIndoorBuildingId, character.localX, character.localY);
      const anchorScreen = this.indoorCoordinateMapper.mapToScreenWithContainer(anchor.mapX, anchor.mapY);
      handles.push({ character, kind: 'character-anchor', x: anchorScreen.x, y: anchorScreen.y });

      const depth = toActualIndoorMapPosition(
        this.currentIndoorBuildingId,
        character.depthLocalX ?? character.localX,
        character.depthLocalY ?? character.localY,
      );
      const depthScreen = this.indoorCoordinateMapper.mapToScreenWithContainer(depth.mapX, depth.mapY);
      handles.push({ character, kind: 'character-depth', x: depthScreen.x, y: depthScreen.y });

      if (character.collider) {
        const bounds = toActualIndoorBounds(this.currentIndoorBuildingId, character.collider);
        const corners: Array<{ kind: CharacterEditorHandleKind; x: number; y: number }> = [
          { kind: 'character-nw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.minY) },
          { kind: 'character-ne', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.minY) },
          { kind: 'character-se', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.maxX, bounds.maxY) },
          { kind: 'character-sw', ...this.indoorCoordinateMapper.mapToScreenWithContainer(bounds.minX, bounds.maxY) },
        ];
        for (const corner of corners) handles.push({ character, ...corner });
      }
    }

    let best: (CharacterEditorDrag & { x: number; y: number }) | null = null;
    let bestScore = Infinity;
    let bestDistance = Infinity;
    for (const handle of handles) {
      const distance = Math.hypot(handle.x - screenX, handle.y - screenY);
      const score = distance - (preferDepth && handle.kind === 'character-depth' ? 0.5 : 0);
      if (score < bestScore) {
        best = handle;
        bestScore = score;
        bestDistance = distance;
      }
    }

    if (!best || bestDistance > 16) return null;
    return { character: best.character, kind: best.kind };
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

  private applyGeneratedIndoorLayout(buildingId: string): void {
    const layout = getGeneratedIndoorLayout(buildingId);
    if (!layout) return;
    try {
      applyFurnitureEditorSnapshot(buildingId, layout.furniture, { replaceMissing: true });
      applyIndoorCharacterEditorSnapshot(buildingId, layout.characters, { replaceMissing: true });
      applyInteractableEditorSnapshot(buildingId, layout.interactables);
      this.applyIndoorFloorTileOverrideSnapshot(layout.floorTileOverrides);
    } catch (error) {
      console.warn('[IndoorSourceLayout] Failed to apply generated layout:', error);
    }
  }

  private restoreFurnitureEditorLayoutFromStorage(buildingId: string): void {
    try {
      const snapshot = loadFurnitureEditorSnapshotPayload(buildingId);
      if (snapshot) {
        applyFurnitureEditorSnapshot(
          buildingId,
          snapshot.items,
          { replaceMissing: snapshot.replaceMissing },
        );
      }
    } catch (error) {
      console.warn('[FurnitureEditor] Failed to restore saved layout:', error);
    }
  }

  private captureIndoorCharacterEditorDefaults(buildingId: string): void {
    if (this.characterEditorDefaultSnapshots.has(buildingId)) return;
    this.characterEditorDefaultSnapshots.set(buildingId, createIndoorCharacterEditorSnapshot(buildingId));
  }

  private restoreIndoorCharacterEditorLayoutFromStorage(buildingId: string): void {
    try {
      const snapshot = loadIndoorCharacterEditorSnapshotPayload(buildingId);
      if (snapshot) {
        applyIndoorCharacterEditorSnapshot(
          buildingId,
          snapshot.items,
          { replaceMissing: snapshot.replaceMissing },
        );
      }
    } catch (error) {
      console.warn('[IndoorCharacterEditor] Failed to restore saved layout:', error);
    }
  }

  private saveIndoorCharacterEditorLayoutToStorage(): void {
    if (!this.currentIndoorBuildingId) return;

    try {
      saveIndoorCharacterEditorSnapshot(
        this.currentIndoorBuildingId,
        createIndoorCharacterEditorSnapshot(this.currentIndoorBuildingId),
      );
      this.saveIndoorSceneDraftToRepository('character');
      this.updateFurnitureEditorHelpText();
    } catch (error) {
      console.warn('[IndoorCharacterEditor] Failed to save layout:', error);
      this.showFurnitureEditorMessage('人物贴图自动保存失败，请检查浏览器存储权限');
    }
  }

  private saveFurnitureEditorLayoutToStorage(): void {
    if (!this.currentIndoorBuildingId) return;

    try {
      saveFurnitureEditorSnapshot(
        this.currentIndoorBuildingId,
        createFurnitureEditorSnapshot(this.currentIndoorBuildingId),
      );
      this.saveIndoorSceneDraftToRepository('furniture');
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
      this.saveIndoorSceneDraftToRepository('interactable');
      this.updateFurnitureEditorHelpText();
    } catch (error) {
      console.warn('[InteractableEditor] Failed to save layout:', error);
      this.showFurnitureEditorMessage('交互区域自动保存失败，请检查浏览器存储权限');
    }
  }

  private saveIndoorSceneDraftToRepository(reason: string): void {
    if (!this.currentIndoorBuildingId) return;

    try {
      const snapshot = createIndoorEditableSceneSnapshot(this.currentIndoorBuildingId, {
        floorTileOverrides: this.getIndoorFloorTileOverrideList(),
      });
      this.lastIndoorSceneDraft = this.sceneRepository.saveSceneDraft({
        ...snapshot,
        metadata: {
          ...snapshot.metadata,
          saveReason: reason,
        },
      });
      if (this.furnitureEditorActive) this.createIndoorSceneObjectPanel();
      this.renderBuildModeOverlay();
    } catch (error) {
      console.warn('[SceneRepository] Failed to save indoor scene draft:', error);
      this.showFurnitureEditorMessage('统一场景草稿保存失败，请检查浏览器存储权限');
    }
  }

  private isShiftPointer(pointer: Phaser.Input.Pointer): boolean {
    return !!(pointer.event as MouseEvent | undefined)?.shiftKey;
  }

  private isMaskDeletePointer(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as MouseEvent | undefined;
    return !!event?.altKey || pointer.rightButtonDown();
  }

  private getSelectedFurniture(fallbackToFirst = true): IndoorFurnitureDef | null {
    if (!this.currentIndoorBuildingId) return null;
    const furniture = getIndoorFurnitureDefs(this.currentIndoorBuildingId);
    return furniture.find((item) => item.id === this.furnitureEditorSelectedId)
      ?? (fallbackToFirst ? furniture[0] : null)
      ?? null;
  }

  private getSelectedCharacter(): IndoorCharacterDef | null {
    if (!this.currentIndoorBuildingId || !this.characterEditorSelectedId) return null;
    return getIndoorCharacterDefs(this.currentIndoorBuildingId)
      .find((item) => item.id === this.characterEditorSelectedId)
      ?? null;
  }

  private getSelectedInteractable(): IndoorInteractableDef | null {
    if (!this.currentIndoorBuildingId || !this.interactableEditorSelectedId) return null;
    return getIndoorInteractables(this.currentIndoorBuildingId)
      .find((item) => item.id === this.interactableEditorSelectedId)
      ?? null;
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
      .setScale(furniture.scale ?? 1)
      .setAlpha(furniture.alpha ?? 1)
      .setAngle(furniture.rotation ?? 0)
      .setDepth(this.getIndoorVisualDepth(furniture, depthPosition.mapX, depthPosition.mapY));
    this.furnitureOccluderRenderer.sync(furniture, sprite, this.currentIndoorBuildingId);
    this.indoorContainer?.sort('depth');
  }

  private updateIndoorCharacterSprite(character: IndoorCharacterDef): void {
    if (!this.currentIndoorBuildingId) return;
    const sprite = this.indoorCharacterSprites.get(character.id);
    if (!sprite) return;

    const { mapX, mapY } = toActualIndoorMapPosition(
      this.currentIndoorBuildingId,
      character.localX,
      character.localY,
    );
    const depthPosition = toActualIndoorMapPosition(
      this.currentIndoorBuildingId,
      character.depthLocalX ?? character.localX,
      character.depthLocalY ?? character.localY,
    );
    const position = this.indoorCoordinateMapper.mapToScreen(mapX, mapY);
    sprite
      .setPosition(
        position.x + (character.pixelOffsetX ?? 0),
        position.y + (character.pixelOffsetY ?? 0),
      )
      .setOrigin(character.originX ?? 0.5, character.originY ?? 1)
      .setScale(character.scale ?? 1)
      .setAlpha(character.alpha ?? 1)
      .setDepth(this.getIndoorCharacterDepth(character, depthPosition.mapX, depthPosition.mapY));
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

  private getIndoorCharacterDepth(character: IndoorCharacterDef, mapX: number, mapY: number): number {
    return INDOOR_ACTOR_DEPTH_BASE + mapX + mapY + (character.depthBias ?? 0);
  }

  private updateFurnitureEditorHelpText(): void {
    if (!this.furnitureEditorActive || !this.buildOverlayAdvanced) {
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
    const selectedCharacter = getIndoorCharacterDefs(this.currentIndoorBuildingId)
      .find((item) => item.id === this.characterEditorSelectedId);
    const characterText = selectedCharacter
      ? [
          `当前人物：${selectedCharacter.id}`,
          `锚点 local：${selectedCharacter.localX.toFixed(1)}, ${selectedCharacter.localY.toFixed(1)}`,
          `遮挡 depth：${(selectedCharacter.depthLocalX ?? selectedCharacter.localX).toFixed(1)}, ${(selectedCharacter.depthLocalY ?? selectedCharacter.localY).toFixed(1)}`,
          selectedCharacter.collider
            ? `碰撞框：${selectedCharacter.collider.minLocalX.toFixed(1)},${selectedCharacter.collider.minLocalY.toFixed(1)} -> ${selectedCharacter.collider.maxLocalX.toFixed(1)},${selectedCharacter.collider.maxLocalY.toFixed(1)}`
            : '碰撞框：无',
          `缩放：${selectedCharacter.scale ?? 1}`,
        ].join('\n')
      : '当前人物：无';
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
      `场景Schema：${this.currentIndoorBuildingId ?? '-'} / indoor`,
      this.lastIndoorSceneDraft
        ? `统一草稿：已保存 ${new Date(this.lastIndoorSceneDraft.savedAt).toLocaleTimeString()}（${this.lastIndoorSceneDraft.snapshot.objects.length} 对象）`
        : '统一草稿：未保存',
      this.buildEditorMode === 'tile'
        ? `瓦片模式：floor / ${this.indoorFloorTileOverrides.size} 个覆盖 / ${this.selectedFloorBrushTextureKey ?? '橡皮'}`
        : '对象模式：人物 / 家具 / 墙贴 / 交互区',
      'Cmd/Ctrl+Shift+S：保存并导出统一场景快照',
      this.pendingIndoorAssetId
        ? `待放置素材：${getIndoorAsset(this.pendingIndoorAssetId)?.name ?? this.pendingIndoorAssetId}`
        : '待放置素材：无',
      selectedText,
      characterText,
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
          '顶部可切换：对象 / 瓦片。',
          '黄色圆环/紫色点/红框：家具。',
          '绿色圆环/蓝色点：人物贴图。',
          '绿色矩形：人物碰撞框。',
          '青色框/青色点：可交互区域。',
          'Cmd/Ctrl/Shift+D：复制当前人物/家具/墙面贴图。',
          'Backspace/Delete：删除当前选中人物/家具/贴图。',
          'Cmd/Ctrl+Shift+C：导出人物配置。',
          'Cmd/Ctrl+Shift+S：保存并导出统一场景快照(JSON，可入库)。',
          '',
          '2. 移动与碰撞',
          '拖黄色圆环：移动家具锚点。',
          '拖绿色圆环：移动人物贴图和碰撞框。',
          '方向键：微调选中对象 local 坐标 ±0.1。',
          'Alt+方向键：快速移动选中对象 local 坐标 ±1。',
          '拖红框角点：调整玩家不能进入的区域。',
          '拖绿色框角点：调整人物阻挡区域。',
          '',
          '3. 遮挡排序',
          '拖紫色点：调整整件家具和玩家谁在前。',
          '拖蓝色点：调整人物和玩家/墙体谁在前。',
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
          'mask 模式下 Backspace/Delete：删选中点；没有选中点就删最后一个。',
          'C：清空当前家具 mask。',
          '',
          '6. 交互区域',
          '拖青色中心点：移动交互区域。',
          '拖青色四角：调整触发范围。',
          '床休息点、书架翻书都用这个范围。',
          '',
          '7. 瓦片模式',
          '切到瓦片后，左侧选择地板笔刷或橡皮。',
          '点击地板单格：写入 floor override。',
          '橡皮点击：恢复模板默认瓦片。',
          '',
          '8. 保存与重置',
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
    this.buildModeOverlay.showToast(message);
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
