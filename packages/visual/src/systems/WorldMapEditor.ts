import { LS_KEY_WORLD_MAP_EDITOR_LAYOUTS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W } from '../config';
import { BUILDINGS, createBuildingDefFromAutomatedSpec } from '../data/BuildingData';
import type { BuildingDef } from '../types';
import { toScreen } from '../utils/IsoProjection';
import { createBuildingMarker } from './BuildingMarkers';
import {
  addRuntimeAutomatedBuilding,
  getAutomatedBuildings,
  getAutomatedIndoorFurnitureDefs,
  removeRuntimeAutomatedBuilding,
  type AutomatedBuildingSpec,
  type AutomatedWorldBuildingVisual,
} from '../content/AutomatedBuildingRegistry';
import { addIndoorFurnitureDef, removeIndoorFurnitureDefs } from '../content/IndoorFurnitureLayout';

type WorldEditorHandleKind =
  | 'visual-center'
  | 'depth-center'
  | 'entry-center'
  | 'entry-radius'
  | 'collision-center'
  | 'collision-radius'
  | 'collision-point';

type WorldEditorDrag = {
  buildingId: string;
  kind: WorldEditorHandleKind;
  pointIndex?: number;
  offsetX?: number;
  offsetY?: number;
};

type WorldEditorSnapshotItem = {
  id: string;
  visualX?: number;
  visualY?: number;
  depthX?: number;
  depthY?: number;
  entryX: number;
  entryY: number;
  entryRadius: number;
  collisionX?: number;
  collisionY?: number;
  collisionRadius?: number;
  collisionPolygon?: BuildingDef['collisionPolygon'];
  returnX?: number;
  returnY?: number;
};

type WorldEditorStoragePayload = {
  version: 1 | 2 | 3 | 4 | 5;
  savedAt: number;
  items: WorldEditorSnapshotItem[];
};

type WorldBuildingPlacementPreset = {
  idPrefix: string;
  namePrefix: string;
  buttonLabel: string;
  worldVisual: Required<Pick<AutomatedWorldBuildingVisual, 'textureKey' | 'originY' | 'offsetY' | 'labelY'>> & { scale?: number };
  indoorMapKey: string;
  starterDecor: boolean;
};

const DEFAULT_PLACEMENT_WORLD_VISUAL: WorldBuildingPlacementPreset['worldVisual'] = {
  textureKey: 'world_building_a_share',
  originY: 0.9,
  offsetY: 0,
  labelY: -156,
  scale: 1,
};

const WORLD_BUILDING_PLACEMENT_PRESETS: WorldBuildingPlacementPreset[] = [
  {
    idPrefix: 'player_manor',
    namePrefix: '玩家宅邸',
    buttonLabel: '放置宅邸',
    worldVisual: { textureKey: 'world_building_a_share', originY: 0.9, offsetY: 0, labelY: -156, scale: 1 },
    indoorMapKey: 'indoor_news',
    starterDecor: true,
  },
  {
    idPrefix: 'player_shop',
    namePrefix: '玩家商铺',
    buttonLabel: '放置商铺',
    worldVisual: { textureKey: 'world_building_exchange', originY: 0.9, offsetY: 0, labelY: -130, scale: 0.45 },
    indoorMapKey: 'indoor_news',
    starterDecor: true,
  },
  {
    idPrefix: 'player_gallery',
    namePrefix: '玩家展馆',
    buttonLabel: '放置展馆',
    worldVisual: { textureKey: 'world_building_token_center', originY: 0.9, offsetY: 0, labelY: -130, scale: 1 },
    indoorMapKey: 'indoor_token_center',
    starterDecor: false,
  },
];

export class WorldMapEditor {
  private scene: Phaser.Scene;
  private active = false;
  private selectedBuildingId: string | null = BUILDINGS[0]?.id ?? null;
  private drag: WorldEditorDrag | null = null;
  private defaultItems: WorldEditorSnapshotItem[] = [];
  private overlay: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private helpText: Phaser.GameObjects.Text;
  private guideText: Phaser.GameObjects.Text;
  private toastText: Phaser.GameObjects.Text;
  private saveButton: Phaser.GameObjects.Text;
  private placementPanel: Phaser.GameObjects.Graphics;
  private placementTitleText: Phaser.GameObjects.Text;
  private placementHintText: Phaser.GameObjects.Text;
  private placementButtons: Phaser.GameObjects.Text[] = [];
  private placementPreviewImage: Phaser.GameObjects.Image;
  private placementPreviewText: Phaser.GameObjects.Text;
  private pendingPlacementPreset: WorldBuildingPlacementPreset | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private guideCollapsed = false;
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private readonly collisionInsertScreenThreshold = 18;

  constructor(scene: Phaser.Scene, private buildingMarkers: Phaser.GameObjects.Container[]) {
    this.scene = scene;
    this.defaultItems = this.createSnapshot();
    this.applySavedLayout();

    this.overlay = scene.add.graphics().setDepth(21000).setScrollFactor(0).setVisible(false);
    this.helpText = scene.add.text(12, 42, '', {
      fontSize: '12px',
      color: '#e5e7eb',
      backgroundColor: 'rgba(17,24,39,0.88)',
      padding: { x: 8, y: 6 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      lineSpacing: 3,
    }).setDepth(21001).setScrollFactor(0).setVisible(false);

    this.guideText = scene.add.text(12, SCREEN_HEIGHT - 40, '', {
      fontSize: '13px',
      color: '#f8fafc',
      backgroundColor: 'rgba(15,23,42,0.9)',
      padding: { x: 10, y: 8 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      lineSpacing: 3,
      wordWrap: { width: 380, useAdvancedWrap: true },
    }).setDepth(21001).setScrollFactor(0).setVisible(false).setInteractive({ useHandCursor: true });
    this.guideText.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
      event?.stopPropagation();
      this.toggleGuide();
    });

    this.toastText = scene.add.text(SCREEN_WIDTH / 2, 80, '', {
      fontSize: '14px',
      color: '#f0fdf4',
      backgroundColor: 'rgba(22,101,52,0.92)',
      padding: { x: 16, y: 10 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    }).setDepth(21002).setScrollFactor(0).setVisible(false).setOrigin(0.5, 0.5);

    this.saveButton = scene.add.text(SCREEN_WIDTH - 22, 24, ' 保存到源码 ', {
      fontSize: '13px',
      color: '#fef3c7',
      backgroundColor: '#92400e',
      padding: { x: 12, y: 8 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      fontStyle: 'bold',
    }).setDepth(21001).setScrollFactor(0).setVisible(false).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.saveButton.on('pointerover', () => {
      this.saveButton.setBackgroundColor('#b45309');
    });
    this.saveButton.on('pointerout', () => {
      this.saveButton.setBackgroundColor('#92400e');
    });
    this.saveButton.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
      event?.stopPropagation();
      this.saveToSource();
    });

    this.placementPanel = scene.add.graphics().setDepth(21000).setScrollFactor(0).setVisible(false);
    this.placementTitleText = scene.add.text(SCREEN_WIDTH - 202, 68, '新增建筑', {
      fontSize: '15px',
      color: '#fef3c7',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      fontStyle: 'bold',
    }).setDepth(21001).setScrollFactor(0).setVisible(false);
    this.placementHintText = scene.add.text(SCREEN_WIDTH - 202, 91, '选择类型后，点击地图放置', {
      fontSize: '11px',
      color: '#bbf7d0',
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    }).setDepth(21001).setScrollFactor(0).setVisible(false);
    this.createPlacementButtons();

    this.placementPreviewImage = scene.add.image(0, 0, DEFAULT_PLACEMENT_WORLD_VISUAL.textureKey)
      .setDepth(20999)
      .setScrollFactor(0)
      .setAlpha(0.48)
      .setTint(0x86efac)
      .setVisible(false);
    this.placementPreviewText = scene.add.text(0, 0, '', {
      fontSize: '12px',
      color: '#ecfccb',
      backgroundColor: 'rgba(20,83,45,0.88)',
      padding: { x: 8, y: 5 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      lineSpacing: 3,
    }).setDepth(21002).setScrollFactor(0).setVisible(false).setOrigin(0.5, 1);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('wheel', this.onPointerWheel, this);

    scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.active) return;
      if (event.key === 'Escape' && this.pendingPlacementPreset) {
        event.preventDefault();
        this.cancelPendingPlacement('已取消建筑放置');
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        this.saveToSource();
      }
    });
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.overlay.setVisible(active);
    this.helpText.setVisible(active);
    this.guideText.setVisible(active);
    this.saveButton.setVisible(active);
    this.placementPanel.setVisible(active);
    this.placementTitleText.setVisible(active);
    this.placementHintText.setVisible(active);
    for (const button of this.placementButtons) button.setVisible(active);
    this.setHudHidden(active);
    this.drag = null;
    if (!active) this.cancelPendingPlacement();
    if (active && !this.selectedBuildingId) {
      this.selectedBuildingId = BUILDINGS[0]?.id ?? null;
    }
    this.clearTexts();
    this.updatePlacementButtons();
    this.updateHelpText();
  }

  isActive(): boolean {
    return this.active;
  }

  update(playerX: number, playerY: number): void {
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;
    if (!this.active) return;
    this.renderOverlay(playerX, playerY);
  }

  adjustEntryRadius(delta: number): void {
    const building = this.selectedBuilding;
    if (!this.active || !building) return;
    building.entryRadius = this.round(Math.max(0.5, building.entryRadius + delta));
    this.saveLayoutToStorage();
    this.updateHelpText();
  }

  adjustCollisionRadius(delta: number): void {
    const building = this.selectedBuilding;
    if (!this.active || !building) return;
    if ((building.collisionRadius ?? 0) <= 0) {
      building.collisionX = building.entryX;
      building.collisionY = building.entryY;
      building.collisionRadius = 2;
    }
    building.collisionRadius = this.round(Math.max(0, (building.collisionRadius ?? 0) + delta));
    if (building.collisionRadius <= 0) {
      building.collisionX = undefined;
      building.collisionY = undefined;
      building.collisionRadius = 0;
    }
    this.saveLayoutToStorage();
    this.updateHelpText();
  }

  deleteSelectedAutomatedBuilding(): void {
    if (!this.active) return;
    const building = this.selectedBuilding;
    if (!building) {
      this.showToast('没有选中的建筑');
      return;
    }
    if (!this.canDeleteSelectedBuilding()) {
      this.showToast('固定建筑不能删除，只能删除新增建筑');
      return;
    }

    if (!removeRuntimeAutomatedBuilding(building.id)) {
      this.showToast('删除失败：没有找到新增建筑注册');
      return;
    }

    const buildingIndex = BUILDINGS.findIndex((item) => item.id === building.id);
    if (buildingIndex >= 0) BUILDINGS.splice(buildingIndex, 1);

    const markerIndex = this.buildingMarkers.findIndex((marker) => marker.getData('buildingId') === building.id);
    if (markerIndex >= 0) {
      const [marker] = this.buildingMarkers.splice(markerIndex, 1);
      marker.destroy(true);
    }

    removeIndoorFurnitureDefs(building.id, () => true);
    this.selectedBuildingId = BUILDINGS[0]?.id ?? null;
    this.pendingPlacementPreset = null;
    this.defaultItems = this.createSnapshot();
    this.saveLayoutToStorage();
    this.updatePlacementButtons();
    this.updateHelpText();
    this.showToast(`已删除新增建筑：${building.name}。Cmd/Ctrl+S 可同步到源码。`);
  }

  clearSelectedCollision(): void {
    const building = this.selectedBuilding;
    if (!this.active || !building) return;
    building.collisionX = undefined;
    building.collisionY = undefined;
    building.collisionRadius = 0;
    building.collisionPolygon = [];
    this.saveLayoutToStorage();
    this.updateHelpText();
  }

  resetSavedLayout(): void {
    if (!this.active) return;
    localStorage.removeItem(LS_KEY_WORLD_MAP_EDITOR_LAYOUTS);
    this.applySnapshot(this.defaultItems);
    this.pendingPlacementPreset = null;
    this.updateHelpText();
  }

  private async saveToSource(): Promise<void> {
    const items = BUILDINGS.map((b) => ({
      id: b.id,
      visualX: b.visualX,
      visualY: b.visualY,
      depthX: b.depthX,
      depthY: b.depthY,
      entryX: b.entryX,
      entryY: b.entryY,
      entryRadius: b.entryRadius,
      collisionX: b.collisionX,
      collisionY: b.collisionY,
      collisionRadius: b.collisionRadius ?? 0,
      collisionPolygon: b.collisionPolygon?.map((p) => ({ x: p.x, y: p.y })),
      returnX: b.returnX,
      returnY: b.returnY,
    }));

    try {
      const res = await fetch('/api/save-world-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          items,
          automatedBuildings: getAutomatedBuildings(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.removeItem(LS_KEY_WORLD_MAP_EDITOR_LAYOUTS);
        this.showToast('已保存到源码，并清空浏览器本地地图草稿');
      } else {
        this.showToast(`保存失败: ${data.error || res.statusText}`);
      }
    } catch (e: any) {
      this.showToast(`保存失败: ${e.message}`);
    }
  }

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastText.setText(msg).setVisible(true);
    this.toastTimer = setTimeout(() => {
      this.toastText.setVisible(false);
      this.toastTimer = null;
    }, 2500);
  }

  private setHudHidden(hidden: boolean): void {
    document.getElementById('game-container')?.classList.toggle('world-editor-active', hidden);
  }

  private cancelPendingPlacement(toast?: string): void {
    this.pendingPlacementPreset = null;
    this.placementPreviewImage.setVisible(false);
    this.placementPreviewText.setVisible(false);
    this.updatePlacementButtons();
    this.updateHelpText();
    if (toast) this.showToast(toast);
  }

  private createPlacementButtons(): void {
    const startY = 122;
    const labels = [
      ...WORLD_BUILDING_PLACEMENT_PRESETS.map((preset) => ({
        action: 'place' as const,
        preset,
        label: this.getPlacementButtonLabel(preset),
      })),
      { action: 'cancel' as const, preset: null, label: '取消当前放置\nEsc / 右键地图' },
      { action: 'delete' as const, preset: null, label: '删除选中建筑\n仅限新增建筑' },
    ];
    this.placementButtons = labels.map((item, index) => {
      const button = this.scene.add.text(SCREEN_WIDTH - 202, startY + index * 56, item.label, {
        fontSize: item.preset ? '12px' : '11px',
        color: '#dcfce7',
        backgroundColor: 'rgba(22,101,52,0.82)',
        padding: { x: 11, y: 8 },
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
        fontStyle: 'bold',
        lineSpacing: 4,
        fixedWidth: 180,
      }).setDepth(21001).setScrollFactor(0).setVisible(false).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      button.setData('preset', item.preset);
      button.setData('action', item.action);
      button.on('pointerover', () => {
        if (item.preset && this.pendingPlacementPreset?.idPrefix !== item.preset.idPrefix) {
          button.setBackgroundColor('rgba(21,128,61,0.96)');
        }
      });
      button.on('pointerout', () => this.updatePlacementButtons());
      button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
        if (item.action === 'delete') {
          this.deleteSelectedAutomatedBuilding();
          return;
        }
        if (item.action === 'cancel') {
          this.cancelPendingPlacement('已取消建筑放置');
          return;
        }
        this.pendingPlacementPreset = item.preset;
        this.updatePlacementButtons();
        this.updateHelpText();
        this.showToast(`已选择${item.preset.namePrefix}，移动鼠标预览，点击地图放置`);
      });
      return button;
    });
    this.updatePlacementButtons();
  }

  private updatePlacementButtons(): void {
    this.placementPanel.clear();
    this.placementPanel.fillStyle(0x0b1314, 0.9);
    this.placementPanel.lineStyle(1, 0xd6a84f, 0.38);
    this.placementPanel.fillRoundedRect(SCREEN_WIDTH - 218, 58, 204, 360, 16);
    this.placementPanel.strokeRoundedRect(SCREEN_WIDTH - 218, 58, 204, 360, 16);
    this.placementHintText.setText(
      this.pendingPlacementPreset
        ? `已选：${this.pendingPlacementPreset.namePrefix}\n点击地图落点`
        : '选择类型后，点击地图放置',
    );
    for (const button of this.placementButtons) {
      const preset = button.getData('preset') as WorldBuildingPlacementPreset | null;
      const action = button.getData('action') as 'place' | 'cancel' | 'delete';
      const active = preset && this.pendingPlacementPreset?.idPrefix === preset.idPrefix;
      if (active) {
        button.setBackgroundColor('rgba(234,179,8,0.95)');
        button.setColor('#1f1300');
      } else if (action === 'delete') {
        const enabled = this.canDeleteSelectedBuilding();
        button.setBackgroundColor(enabled ? 'rgba(153,27,27,0.92)' : 'rgba(68,64,60,0.62)');
        button.setColor(enabled ? '#fee2e2' : '#d6d3d1');
      } else if (!preset) {
        button.setBackgroundColor(this.pendingPlacementPreset ? 'rgba(127,29,29,0.92)' : 'rgba(76,29,29,0.58)');
        button.setColor('#fee2e2');
      } else {
        button.setBackgroundColor('rgba(22,101,52,0.82)');
        button.setColor('#dcfce7');
      }
    }
  }

  private getPlacementButtonLabel(preset: WorldBuildingPlacementPreset): string {
    if (preset.idPrefix === 'player_manor') return '宅邸\n玩家住宅 / 默认家具';
    if (preset.idPrefix === 'player_shop') return '商铺\n交易所外观 / 默认家具';
    if (preset.idPrefix === 'player_gallery') return '展馆\nToken外观 / 空房间';
    return `${preset.namePrefix}\n点击地图放置`;
  }

  private canDeleteSelectedBuilding(): boolean {
    const buildingId = this.selectedBuildingId;
    if (!buildingId) return false;
    return getAutomatedBuildings().some((building) => building.id === buildingId);
  }

  private placeBuildingPreset(preset: WorldBuildingPlacementPreset, x: number, y: number): void {
    const id = this.createUniqueBuildingId(preset.idPrefix);
    const index = this.getPlacementIndex(preset.idPrefix, id);
    const spec = this.createPlacedBuildingSpec(preset, id, `${preset.namePrefix}${index}`, x, y);
    addRuntimeAutomatedBuilding(spec);

    const building = createBuildingDefFromAutomatedSpec(spec);
    BUILDINGS.push(building);
    this.selectedBuildingId = building.id;
    this.buildingMarkers.push(createBuildingMarker(this.scene, building));
    for (const furniture of getAutomatedIndoorFurnitureDefs(building.id)) {
      addIndoorFurnitureDef(furniture);
    }

    this.pendingPlacementPreset = null;
    this.defaultItems = this.createSnapshot();
    this.saveLayoutToStorage();
    this.updatePlacementButtons();
    this.updateHelpText();
    this.showToast(`已放置建筑：${building.name}。走到绿色入口可进入，室内按 F2 装修。`);
  }

  private createPlacedBuildingSpec(
    preset: WorldBuildingPlacementPreset,
    id: string,
    name: string,
    x: number,
    y: number,
  ): AutomatedBuildingSpec {
    const useTokenRoom = preset.indoorMapKey === 'indoor_token_center';
    return {
      id,
      name,
      entryX: x,
      entryY: y,
      visualX: x,
      visualY: y,
      entryRadius: 2,
      indoorMapKey: preset.indoorMapKey,
      spawnX: useTokenRoom ? 20 : 10,
      spawnY: useTokenRoom ? 20 : 10,
      doorSpawnX: useTokenRoom ? 20 : 10,
      doorSpawnY: useTokenRoom ? 34 : 17,
      exitX: useTokenRoom ? 20 : 10,
      exitY: useTokenRoom ? 37 : 19,
      returnX: x,
      returnY: this.round(y + 3),
      worldVisual: preset.worldVisual,
      roomTemplate: {
        localOrigin: { x: 3, y: 3 },
        editableFloor: {
          rowStart: useTokenRoom ? 4 : 4,
          rowEnd: useTokenRoom ? 36 : 34,
          colStart: useTokenRoom ? 4 : 4,
          colEnd: useTokenRoom ? 36 : 34,
          brushAssetIds: [
            'tile_floor_token_center_0514',
            'tile_rug_0309',
            'tile_rug_0313',
            'tile_rug_0330',
          ],
          allowErase: true,
          description: `${name}地板装修区`,
        },
      },
      furniture: preset.starterDecor ? this.createStarterFurnitureSpec() : [],
    };
  }

  private createStarterFurnitureSpec(): NonNullable<AutomatedBuildingSpec['furniture']> {
    return [
      {
        id: 'starter_table',
        assetId: 'furniture_birth_house_table',
        localX: 10,
        localY: 13,
        scale: 0.55,
        depthLocalX: 10,
        depthLocalY: 13,
        collider: { minLocalX: 8.8, maxLocalX: 11.2, minLocalY: 11.8, maxLocalY: 14.2 },
      },
      {
        id: 'starter_bookshelf',
        assetId: 'furniture_birth_house_bookshelf',
        localX: 8,
        localY: 4,
        scale: 0.54,
        collider: { minLocalX: 7.2, maxLocalX: 8.8, minLocalY: 3.2, maxLocalY: 4.8 },
      },
      {
        id: 'starter_chest',
        assetId: 'furniture_birth_house_chest',
        localX: 13,
        localY: 6,
        scale: 0.5,
        collider: { minLocalX: 12.2, maxLocalX: 13.8, minLocalY: 5.2, maxLocalY: 6.8 },
      },
    ];
  }

  private createUniqueBuildingId(prefix: string): string {
    const existingIds = new Set(BUILDINGS.map((building) => building.id));
    let index = 1;
    let id = `${prefix}_${index}`;
    while (existingIds.has(id)) {
      index++;
      id = `${prefix}_${index}`;
    }
    return id;
  }

  private getPlacementIndex(prefix: string, id: string): number {
    const suffix = id.slice(prefix.length + 1);
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? parsed : 1;
  }

  toggleGuide(): void {
    if (!this.active) return;
    this.guideCollapsed = !this.guideCollapsed;
    this.updateHelpText();
  }

  private get selectedBuilding(): BuildingDef | undefined {
    return BUILDINGS.find((building) => building.id === this.selectedBuildingId);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    if (this.pendingPlacementPreset) {
      if (this.isDeletePointer(pointer)) {
        (pointer.event as MouseEvent | undefined)?.preventDefault();
        this.cancelPendingPlacement('已取消建筑放置');
        return;
      }
      const mapPos = this.screenToMap(pointer.x, pointer.y, this.lastPlayerX, this.lastPlayerY);
      this.placeBuildingPreset(this.pendingPlacementPreset, this.round(mapPos.x), this.round(mapPos.y));
      return;
    }

    const hit = this.findHandleAt(pointer.x, pointer.y);
    if (hit) {
      this.selectedBuildingId = hit.buildingId;
      if (this.isDeletePointer(pointer) && hit.kind.startsWith('collision')) {
        (pointer.event as MouseEvent | undefined)?.preventDefault();
        if (hit.kind === 'collision-point') {
          const building = this.selectedBuilding;
          if (building) this.deleteCollisionPolygonPoint(building, hit.pointIndex);
          return;
        }
        this.clearSelectedCollision();
        return;
      }
      const building = this.selectedBuilding;
      if (building && hit.kind.startsWith('collision') && (building.collisionRadius ?? 0) <= 0) {
        const seedPos = this.getCollisionSeedMapPosition(building);
        building.collisionX = seedPos.x;
        building.collisionY = seedPos.y;
        building.collisionRadius = 2;
        this.saveLayoutToStorage();
      }
      if (building && hit.kind === 'visual-center') {
        const mapPos = this.screenToMap(pointer.x, pointer.y, this.lastPlayerX, this.lastPlayerY);
        hit.offsetX = (building.visualX ?? building.entryX) - mapPos.x;
        hit.offsetY = (building.visualY ?? building.entryY) - mapPos.y;
      }
      if (building && hit.kind === 'depth-center') {
        const mapPos = this.screenToMap(pointer.x, pointer.y, this.lastPlayerX, this.lastPlayerY);
        const depthPos = this.getDepthPosition(building);
        hit.offsetX = depthPos.x - mapPos.x;
        hit.offsetY = depthPos.y - mapPos.y;
      }
      this.drag = hit;
      this.updateHelpText();
      return;
    }

    const nearest = this.findNearestBuilding(pointer.x, pointer.y);
    if (nearest) {
      this.selectedBuildingId = nearest.id;
      this.updateHelpText();
    }

    if (this.isShiftPointer(pointer)) {
      const building = this.selectedBuilding;
      if (building && (building.collisionPolygon?.length ?? 0) < 3) {
        building.collisionPolygon = this.createDefaultCollisionPolygon(building);
        this.syncCircleFromPolygon(building);
        this.saveLayoutToStorage();
        this.updateHelpText();
        return;
      }

      const candidate = building ? this.findCollisionPolygonInsertCandidate(building, pointer.x, pointer.y) : null;
      if (building && candidate) {
        const index = this.insertCollisionPolygonPoint(building, candidate.mapPos, candidate.edgeIndex);
        this.drag = { buildingId: building.id, kind: 'collision-point', pointIndex: index };
        this.saveLayoutToStorage();
        this.updateHelpText();
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active || !this.drag || !pointer.isDown) return;
    const building = BUILDINGS.find((item) => item.id === this.drag?.buildingId);
    if (!building) return;

    const mapPos = this.screenToMap(pointer.x, pointer.y, this.lastPlayerX, this.lastPlayerY);
    if (this.drag.kind === 'visual-center') {
      const nextX = this.round(mapPos.x + (this.drag.offsetX ?? 0));
      const nextY = this.round(mapPos.y + (this.drag.offsetY ?? 0));
      const prevX = building.visualX ?? building.entryX;
      const prevY = building.visualY ?? building.entryY;
      const dx = nextX - prevX;
      const dy = nextY - prevY;
      building.visualX = nextX;
      building.visualY = nextY;
      this.translateBuildingCollision(building, dx, dy);
      this.translateBuildingDepth(building, dx, dy);
    } else if (this.drag.kind === 'depth-center') {
      building.depthX = this.round(mapPos.x + (this.drag.offsetX ?? 0));
      building.depthY = this.round(mapPos.y + (this.drag.offsetY ?? 0));
    } else if (this.drag.kind === 'entry-center') {
      building.entryX = this.round(mapPos.x);
      building.entryY = this.round(mapPos.y);
    } else if (this.drag.kind === 'collision-point') {
      const index = this.drag.pointIndex;
      if (index !== undefined && building.collisionPolygon?.[index]) {
        building.collisionPolygon[index] = {
          x: this.round(mapPos.x),
          y: this.round(mapPos.y),
        };
        this.syncCircleFromPolygon(building);
      }
    } else if (this.drag.kind === 'collision-center') {
      building.collisionX = this.round(mapPos.x);
      building.collisionY = this.round(mapPos.y);
      if ((building.collisionRadius ?? 0) <= 0) building.collisionRadius = 2;
    } else if (this.drag.kind === 'entry-radius') {
      building.entryRadius = this.round(Math.max(0.5, Phaser.Math.Distance.Between(
        mapPos.x, mapPos.y, building.entryX, building.entryY,
      )));
    } else if (this.drag.kind === 'collision-radius') {
      const collisionX = building.collisionX ?? building.entryX;
      const collisionY = building.collisionY ?? building.entryY;
      building.collisionX = collisionX;
      building.collisionY = collisionY;
      building.collisionRadius = this.round(Math.max(0.5, Phaser.Math.Distance.Between(
        mapPos.x, mapPos.y, collisionX, collisionY,
      )));
    }
    this.saveLayoutToStorage();
    this.updateHelpText();
  }

  private onPointerUp(): void {
    this.drag = null;
  }

  private onPointerWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
    _deltaZ: number,
    event: WheelEvent,
  ): void {
    if (!this.active) return;
    const hit = this.findHandleAt(pointer.x, pointer.y);
    if (hit) this.selectedBuildingId = hit.buildingId;
    const delta = deltaY < 0 ? 0.5 : -0.5;
    const adjustCollision = event.shiftKey || hit?.kind.startsWith('collision');
    if (adjustCollision) this.adjustCollisionRadius(delta);
    else this.adjustEntryRadius(delta);
    event.preventDefault();
  }

  private renderOverlay(playerX: number, playerY: number): void {
    this.overlay.clear();
    this.clearTexts();

    for (const building of BUILDINGS) {
      const selected = building.id === this.selectedBuildingId;
      const visualX = building.visualX ?? building.entryX;
      const visualY = building.visualY ?? building.entryY;
      const depthPos = this.getDepthPosition(building);
      const visualScreen = toScreen(visualX, visualY, playerX, playerY);
      const depthScreen = toScreen(depthPos.x, depthPos.y, playerX, playerY);
      const entryScreen = toScreen(building.entryX, building.entryY, playerX, playerY);
      const entryRadiusHandle = toScreen(building.entryX + building.entryRadius, building.entryY, playerX, playerY);
      const entryRx = building.entryRadius * TILE_HALF_W;
      const entryRy = building.entryRadius * TILE_HALF_H;

      if (selected) {
        this.overlay.lineStyle(1, 0xfbbf24, 0.55);
        this.overlay.lineBetween(visualScreen.x, visualScreen.y, entryScreen.x, entryScreen.y);
        this.overlay.lineStyle(1, 0xa855f7, 0.7);
        this.overlay.lineBetween(visualScreen.x, visualScreen.y, depthScreen.x, depthScreen.y);
      }

      this.overlay.fillStyle(0xfbbf24, selected ? 0.96 : 0.68);
      this.overlay.fillCircle(visualScreen.x, visualScreen.y, selected ? 7 : 5);
      this.overlay.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x78350f, selected ? 0.95 : 0.65);
      this.overlay.strokeCircle(visualScreen.x, visualScreen.y, selected ? 10 : 7);

      this.overlay.fillStyle(0xa855f7, selected ? 0.96 : 0.62);
      this.overlay.fillCircle(depthScreen.x, depthScreen.y, selected ? 7 : 5);
      this.overlay.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x581c87, selected ? 0.95 : 0.65);
      this.overlay.strokeCircle(depthScreen.x, depthScreen.y, selected ? 11 : 7);

      this.overlay.lineStyle(selected ? 3 : 2, selected ? 0xfbbf24 : 0x22c55e, selected ? 0.95 : 0.55);
      this.overlay.strokeEllipse(entryScreen.x, entryScreen.y, entryRx * 2, entryRy * 2);
      this.overlay.fillStyle(0x22c55e, selected ? 0.95 : 0.65);
      this.overlay.fillCircle(entryScreen.x, entryScreen.y, selected ? 6 : 4);
      this.drawSquareHandle(entryRadiusHandle.x, entryRadiusHandle.y, selected ? 8 : 6, 0x22c55e, selected ? 0.95 : 0.55);

      const radius = building.collisionRadius ?? 0;
      const collisionX = building.collisionX ?? building.entryX;
      const collisionY = building.collisionY ?? building.entryY;
      const collisionScreen = toScreen(collisionX, collisionY, playerX, playerY);
      const polygon = building.collisionPolygon ?? [];
      if (polygon.length >= 3) {
        const screenPoints = polygon.map((point) => toScreen(point.x, point.y, playerX, playerY));
        this.overlay.lineStyle(selected ? 3 : 2, selected ? 0xff9f1c : 0xef4444, selected ? 0.92 : 0.45);
        this.overlay.fillStyle(selected ? 0xff9f1c : 0xef4444, selected ? 0.12 : 0.06);
        this.overlay.beginPath();
        this.overlay.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (const point of screenPoints.slice(1)) this.overlay.lineTo(point.x, point.y);
        this.overlay.closePath();
        this.overlay.fillPath();
        this.overlay.strokePath();
        for (let i = 0; i < screenPoints.length; i++) {
          const point = screenPoints[i];
          this.overlay.fillStyle(selected ? 0xff9f1c : 0xef4444, selected ? 0.95 : 0.55);
          this.overlay.fillCircle(point.x, point.y, selected ? 5 : 4);
          this.overlay.lineStyle(1, 0xffffff, selected ? 0.9 : 0.45);
          this.overlay.strokeCircle(point.x, point.y, selected ? 7 : 5);
        }
      } else if (radius > 0) {
        const collisionRadiusHandle = toScreen(collisionX + radius, collisionY, playerX, playerY);
        this.overlay.lineStyle(selected ? 3 : 2, selected ? 0xff9f1c : 0xef4444, selected ? 0.9 : 0.42);
        this.overlay.strokeEllipse(collisionScreen.x, collisionScreen.y, radius * TILE_HALF_W * 2, radius * TILE_HALF_H * 2);
        this.overlay.fillStyle(0xef4444, selected ? 0.9 : 0.55);
        this.overlay.fillCircle(collisionScreen.x, collisionScreen.y, selected ? 6 : 4);
        this.drawSquareHandle(collisionRadiusHandle.x, collisionRadiusHandle.y, selected ? 8 : 6, selected ? 0xff9f1c : 0xef4444, selected ? 0.95 : 0.42);
      } else if (selected) {
        const seedPos = this.getCollisionSeedMapPosition(building);
        const seedScreen = toScreen(seedPos.x, seedPos.y, playerX, playerY);
        const seedX = seedScreen.x;
        const seedY = seedScreen.y;
        this.overlay.lineStyle(2, 0xef4444, 0.45);
        this.overlay.strokeCircle(seedX, seedY, 8);
        this.overlay.fillStyle(0xef4444, 0.22);
        this.overlay.fillCircle(seedX, seedY, 5);
      }

      const collisionText = polygon.length >= 3 ? `碰撞 多边形 ${polygon.length}点` : `碰撞 r=${radius.toFixed(1)}`;
      const label = this.scene.add.text(visualScreen.x + 10, visualScreen.y - 54, `${building.name}\n建筑 ${visualX.toFixed(1)},${visualY.toFixed(1)}\n遮挡 ${depthPos.x.toFixed(1)},${depthPos.y.toFixed(1)} d=${(depthPos.x + depthPos.y).toFixed(1)}\n入口 ${building.entryX.toFixed(1)},${building.entryY.toFixed(1)} r=${building.entryRadius.toFixed(1)}\n${collisionText}`, {
        fontSize: selected ? '11px' : '10px',
        color: selected ? '#fef3c7' : '#d1d5db',
        stroke: '#000000',
        strokeThickness: 3,
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      }).setDepth(21001).setScrollFactor(0);
      this.texts.push(label);
    }
    this.renderPlacementPreview(playerX, playerY);
  }

  private renderPlacementPreview(playerX: number, playerY: number): void {
    const preset = this.pendingPlacementPreset;
    if (!preset) {
      this.placementPreviewImage.setVisible(false);
      this.placementPreviewText.setVisible(false);
      return;
    }

    const pointer = this.scene.input.activePointer;
    const mapPos = this.screenToMap(pointer.x, pointer.y, playerX, playerY);
    const roundedX = this.round(mapPos.x);
    const roundedY = this.round(mapPos.y);
    const screen = toScreen(roundedX, roundedY, playerX, playerY);
    const textureKey = this.scene.textures.exists(preset.worldVisual.textureKey)
      ? preset.worldVisual.textureKey
      : DEFAULT_PLACEMENT_WORLD_VISUAL.textureKey;

    this.overlay.lineStyle(2, 0x86efac, 0.9);
    this.overlay.strokeEllipse(screen.x, screen.y, preset.worldVisual.scale === 0.45 ? 64 : 96, preset.worldVisual.scale === 0.45 ? 32 : 48);
    this.overlay.fillStyle(0x22c55e, 0.8);
    this.overlay.fillCircle(screen.x, screen.y, 5);
    this.overlay.lineStyle(1, 0xffffff, 0.7);
    this.overlay.strokeCircle(screen.x, screen.y, 9);

    this.placementPreviewImage
      .setTexture(textureKey)
      .setOrigin(0.5, preset.worldVisual.originY)
      .setScale(preset.worldVisual.scale ?? 1)
      .setPosition(screen.x, screen.y + preset.worldVisual.offsetY)
      .setVisible(true);
    this.placementPreviewText
      .setText(`${preset.namePrefix}  ${roundedX}, ${roundedY}\n点击放置 / Esc 或右键取消`)
      .setPosition(screen.x, screen.y - 18)
      .setVisible(true);
  }

  private drawSquareHandle(x: number, y: number, size: number, color: number, alpha: number): void {
    const half = size / 2;
    this.overlay.fillStyle(color, alpha);
    this.overlay.fillRect(x - half, y - half, size, size);
    this.overlay.lineStyle(1, 0xffffff, alpha);
    this.overlay.strokeRect(x - half, y - half, size, size);
  }

  private findHandleAt(screenX: number, screenY: number): WorldEditorDrag | null {
    for (const building of BUILDINGS) {
      const visualX = building.visualX ?? building.entryX;
      const visualY = building.visualY ?? building.entryY;
      const depthPos = this.getDepthPosition(building);
      const visualScreen = toScreen(visualX, visualY, this.lastPlayerX, this.lastPlayerY);
      const depthScreen = toScreen(depthPos.x, depthPos.y, this.lastPlayerX, this.lastPlayerY);
      const entryScreen = toScreen(building.entryX, building.entryY, this.lastPlayerX, this.lastPlayerY);
      const entryRadiusHandle = toScreen(building.entryX + building.entryRadius, building.entryY, this.lastPlayerX, this.lastPlayerY);
      if (Phaser.Math.Distance.Between(screenX, screenY, depthScreen.x, depthScreen.y) <= 14) {
        return { buildingId: building.id, kind: 'depth-center' };
      }
      if (Phaser.Math.Distance.Between(screenX, screenY, entryRadiusHandle.x, entryRadiusHandle.y) <= 12) {
        return { buildingId: building.id, kind: 'entry-radius' };
      }
      if (Phaser.Math.Distance.Between(screenX, screenY, entryScreen.x, entryScreen.y) <= 14) {
        return { buildingId: building.id, kind: 'entry-center' };
      }

      const collisionX = building.collisionX ?? building.entryX;
      const collisionY = building.collisionY ?? building.entryY;
      const collisionScreen = toScreen(collisionX, collisionY, this.lastPlayerX, this.lastPlayerY);
      const polygon = building.collisionPolygon ?? [];
      if (polygon.length >= 3) {
        for (let i = 0; i < polygon.length; i++) {
          const point = polygon[i];
          const screen = toScreen(point.x, point.y, this.lastPlayerX, this.lastPlayerY);
          if (Phaser.Math.Distance.Between(screenX, screenY, screen.x, screen.y) <= 12) {
            return { buildingId: building.id, kind: 'collision-point', pointIndex: i };
          }
        }
      }
      const radius = building.collisionRadius ?? 0;
      if (polygon.length < 3 && radius > 0) {
        const collisionRadiusHandle = toScreen(collisionX + radius, collisionY, this.lastPlayerX, this.lastPlayerY);
        if (Phaser.Math.Distance.Between(screenX, screenY, collisionRadiusHandle.x, collisionRadiusHandle.y) <= 12) {
          return { buildingId: building.id, kind: 'collision-radius' };
        }
        if (Phaser.Math.Distance.Between(screenX, screenY, collisionScreen.x, collisionScreen.y) <= 14) {
          return { buildingId: building.id, kind: 'collision-center' };
        }
      } else if (polygon.length < 3 && building.id === this.selectedBuildingId) {
        const seedPos = this.getCollisionSeedMapPosition(building);
        const seedScreen = toScreen(seedPos.x, seedPos.y, this.lastPlayerX, this.lastPlayerY);
        if (Phaser.Math.Distance.Between(screenX, screenY, seedScreen.x, seedScreen.y) <= 14) {
          return { buildingId: building.id, kind: 'collision-center' };
        }
      }

      if (Phaser.Math.Distance.Between(screenX, screenY, visualScreen.x, visualScreen.y) <= 18
        || this.isPointerOnBuildingBody(screenX, screenY, visualScreen.x, visualScreen.y)) {
        return { buildingId: building.id, kind: 'visual-center' };
      }
    }
    return null;
  }

  private findNearestBuilding(screenX: number, screenY: number): BuildingDef | null {
    let best: BuildingDef | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const building of BUILDINGS) {
      const visualScreen = toScreen(
        building.visualX ?? building.entryX,
        building.visualY ?? building.entryY,
        this.lastPlayerX,
        this.lastPlayerY,
      );
      const depthPos = this.getDepthPosition(building);
      const depthScreen = toScreen(depthPos.x, depthPos.y, this.lastPlayerX, this.lastPlayerY);
      const entryScreen = toScreen(building.entryX, building.entryY, this.lastPlayerX, this.lastPlayerY);
      const dist = Math.min(
        Phaser.Math.Distance.Between(screenX, screenY, entryScreen.x, entryScreen.y),
        Phaser.Math.Distance.Between(screenX, screenY, visualScreen.x, visualScreen.y),
        Phaser.Math.Distance.Between(screenX, screenY, depthScreen.x, depthScreen.y),
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = building;
      }
    }
    return bestDist <= 80 ? best : null;
  }

  private screenToMap(screenX: number, screenY: number, playerX: number, playerY: number): { x: number; y: number } {
    const sx = (screenX - SCREEN_WIDTH / 2) / TILE_HALF_W;
    const sy = (screenY - SCREEN_HEIGHT / 2) / TILE_HALF_H;
    return {
      x: playerX + (sx + sy) / 2,
      y: playerY + (sy - sx) / 2,
    };
  }

  private applySavedLayout(): void {
    const raw = localStorage.getItem(LS_KEY_WORLD_MAP_EDITOR_LAYOUTS);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as WorldEditorStoragePayload;
      if (![1, 2, 3, 4, 5].includes(payload.version) || !Array.isArray(payload.items)) return;
      this.applySnapshot(payload.items, payload.version);
    } catch (error) {
      console.warn('[WorldMapEditor] Failed to load saved layout:', error);
    }
  }

  private saveLayoutToStorage(): void {
    const payload: WorldEditorStoragePayload = {
      version: 5,
      savedAt: Date.now(),
      items: this.createSnapshot(),
    };
    localStorage.setItem(LS_KEY_WORLD_MAP_EDITOR_LAYOUTS, JSON.stringify(payload));
  }

  private createSnapshot(): WorldEditorSnapshotItem[] {
    return BUILDINGS.map((building) => ({
      id: building.id,
      visualX: building.visualX,
      visualY: building.visualY,
      depthX: building.depthX,
      depthY: building.depthY,
      entryX: building.entryX,
      entryY: building.entryY,
      entryRadius: building.entryRadius,
      collisionX: building.collisionX,
      collisionY: building.collisionY,
      collisionRadius: building.collisionRadius ?? 0,
      collisionPolygon: building.collisionPolygon?.map((point) => ({ ...point })),
      returnX: building.returnX,
      returnY: building.returnY,
    }));
  }

  private applySnapshot(items: WorldEditorSnapshotItem[], payloadVersion: 1 | 2 | 3 | 4 | 5 = 5): void {
    for (const item of items) {
      const building = BUILDINGS.find((candidate) => candidate.id === item.id);
      if (!building) continue;
      if (item.visualX !== undefined) building.visualX = item.visualX;
      if (item.visualY !== undefined) building.visualY = item.visualY;
      if (payloadVersion >= 5) {
        building.depthX = item.depthX;
        building.depthY = item.depthY;
      }
      building.entryX = item.entryX;
      building.entryY = item.entryY;
      building.returnX = item.returnX ?? item.entryX;
      building.returnY = item.returnY ?? item.entryY + 3;
      building.entryRadius = item.entryRadius;
      const savedCollisionRadius = item.collisionRadius ?? 0;
      if (payloadVersion < 3 && savedCollisionRadius <= 0 && (building.collisionRadius ?? 0) > 0) {
        continue;
      }
      building.collisionX = item.collisionX;
      building.collisionY = item.collisionY;
      building.collisionRadius = savedCollisionRadius;
      if (payloadVersion >= 4 && Array.isArray(item.collisionPolygon)) {
        building.collisionPolygon = item.collisionPolygon.map((point) => ({ ...point }));
      }
    }
  }

  private getCollisionSeedMapPosition(building: BuildingDef): { x: number; y: number } {
    return {
      x: building.visualX ?? building.entryX,
      y: building.visualY ?? building.entryY,
    };
  }

  private getDepthPosition(building: BuildingDef): { x: number; y: number } {
    return {
      x: building.depthX ?? building.visualX ?? building.entryX,
      y: building.depthY ?? building.visualY ?? building.entryY,
    };
  }

  private isPointerOnBuildingBody(screenX: number, screenY: number, visualScreenX: number, visualScreenY: number): boolean {
    const dx = Math.abs(screenX - visualScreenX);
    const dy = screenY - visualScreenY;
    return dx <= 130 && dy >= -190 && dy <= 32;
  }

  private translateBuildingCollision(building: BuildingDef, dx: number, dy: number): void {
    if (!dx && !dy) return;
    if (building.collisionPolygon?.length) {
      building.collisionPolygon = building.collisionPolygon.map((point) => ({
        x: this.round(point.x + dx),
        y: this.round(point.y + dy),
      }));
    }
    if (building.collisionX !== undefined) building.collisionX = this.round(building.collisionX + dx);
    if (building.collisionY !== undefined) building.collisionY = this.round(building.collisionY + dy);
  }

  private translateBuildingDepth(building: BuildingDef, dx: number, dy: number): void {
    if (!dx && !dy) return;
    if (building.depthX !== undefined) building.depthX = this.round(building.depthX + dx);
    if (building.depthY !== undefined) building.depthY = this.round(building.depthY + dy);
  }

  private insertCollisionPolygonPoint(building: BuildingDef, point: { x: number; y: number }, insertAfterIndex?: number): number {
    const polygon = building.collisionPolygon ?? this.createDefaultCollisionPolygon(building) ?? [];
    building.collisionPolygon = polygon;
    let insertAt = insertAfterIndex === undefined
      ? polygon.length
      : Math.min(Math.max(insertAfterIndex + 1, 0), polygon.length);

    if (insertAfterIndex === undefined) {
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < polygon.length; i++) {
        const next = polygon[(i + 1) % polygon.length];
        const dist = this.distanceToSegment(point, polygon[i], next);
        if (dist < bestDist) {
          bestDist = dist;
          insertAt = i + 1;
        }
      }
    }
    polygon.splice(insertAt, 0, {
      x: this.round(point.x),
      y: this.round(point.y),
    });
    this.syncCircleFromPolygon(building);
    return insertAt;
  }

  private findCollisionPolygonInsertCandidate(
    building: BuildingDef,
    screenX: number,
    screenY: number,
  ): { edgeIndex: number; mapPos: { x: number; y: number } } | null {
    const polygon = building.collisionPolygon ?? [];
    if (polygon.length < 3) return null;

    let bestEdgeIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < polygon.length; i++) {
      const a = toScreen(polygon[i].x, polygon[i].y, this.lastPlayerX, this.lastPlayerY);
      const b = toScreen(
        polygon[(i + 1) % polygon.length].x,
        polygon[(i + 1) % polygon.length].y,
        this.lastPlayerX,
        this.lastPlayerY,
      );
      const distance = this.distanceToScreenSegment(screenX, screenY, a.x, a.y, b.x, b.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEdgeIndex = i;
      }
    }

    if (bestDistance > this.collisionInsertScreenThreshold || bestEdgeIndex < 0) return null;
    return {
      edgeIndex: bestEdgeIndex,
      mapPos: this.screenToMap(screenX, screenY, this.lastPlayerX, this.lastPlayerY),
    };
  }

  private deleteCollisionPolygonPoint(building: BuildingDef, index: number | undefined): void {
    if (index === undefined || !building.collisionPolygon?.[index]) return;
    building.collisionPolygon.splice(index, 1);
    if (building.collisionPolygon.length < 3) {
      building.collisionPolygon = [];
      building.collisionRadius = 0;
    } else {
      this.syncCircleFromPolygon(building);
    }
    this.saveLayoutToStorage();
    this.updateHelpText();
  }

  private createDefaultCollisionPolygon(building: BuildingDef): BuildingDef['collisionPolygon'] {
    const x = building.visualX ?? building.entryX;
    const y = building.visualY ?? building.entryY;
    return [
      { x: this.round(x - 2.6), y: this.round(y - 1.1) },
      { x: this.round(x - 0.8), y: this.round(y - 2.4) },
      { x: this.round(x + 2.2), y: this.round(y - 1.6) },
      { x: this.round(x + 2.7), y: this.round(y + 0.7) },
      { x: this.round(x + 0.8), y: this.round(y + 2.3) },
      { x: this.round(x - 2.4), y: this.round(y + 1.4) },
    ];
  }

  private syncCircleFromPolygon(building: BuildingDef): void {
    const polygon = building.collisionPolygon ?? [];
    if (polygon.length < 3) return;
    const center = polygon.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    const cx = this.round(center.x / polygon.length);
    const cy = this.round(center.y / polygon.length);
    building.collisionX = cx;
    building.collisionY = cy;
    building.collisionRadius = this.round(Math.max(
      ...polygon.map((point) => Phaser.Math.Distance.Between(point.x, point.y, cx, cy)),
    ));
  }

  private distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return Phaser.Math.Distance.Between(point.x, point.y, a.x, a.y);
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    return Phaser.Math.Distance.Between(point.x, point.y, a.x + t * dx, a.y + t * dy);
  }

  private distanceToScreenSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return Phaser.Math.Distance.Between(px, py, ax, ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    return Phaser.Math.Distance.Between(px, py, ax + t * dx, ay + t * dy);
  }

  private clearTexts(): void {
    for (const text of this.texts) text.destroy();
    this.texts = [];
  }

  private updateHelpText(): void {
    const selected = this.selectedBuilding;
    const selectedDepth = selected ? this.getDepthPosition(selected) : null;
    const placementText = this.pendingPlacementPreset
      ? `待放置：${this.pendingPlacementPreset.namePrefix}（点击地图放置，右键/Alt 取消）`
      : '待放置：无';
    const selectedText = selected
      ? [
          `当前建筑：${selected.name}`,
          placementText,
          `遮挡：${selectedDepth!.x.toFixed(1)}, ${selectedDepth!.y.toFixed(1)}  d=${(selectedDepth!.x + selectedDepth!.y).toFixed(1)}`,
          `入口：${selected.entryX.toFixed(1)}, ${selected.entryY.toFixed(1)}  r=${selected.entryRadius.toFixed(1)}`,
          `碰撞：${(selected.collisionX ?? selected.entryX).toFixed(1)}, ${(selected.collisionY ?? selected.entryY).toFixed(1)}  r=${(selected.collisionRadius ?? 0).toFixed(1)}`,
        ].join('\n')
      : `当前建筑：无\n${placementText}`;

    this.helpText.setText([
      '大地图编辑模式',
      '参数会自动保存到浏览器',
      selectedText,
    ].join('\n'));

    const guideLines = this.guideCollapsed
      ? [
          '操作说明（已收起）',
          '点击展开 / 按 H 展开',
        ]
      : [
          '操作说明（点击收起 / H）',
          '',
          '1. 选择与移动',
          '右上“新增建筑”：选择建筑类型，移动鼠标预览，点击地图新增建筑。',
          'Esc / 右键 / Alt+点击：取消当前待放置建筑。',
          '新增建筑会自动生成入口、碰撞、室内模板和默认装饰。',
          '黄色点/建筑本体：拖动整栋建筑贴图。',
          '紫色点：建筑遮挡排序点，只影响谁盖住谁。',
          '人在建筑前面还被压住：把紫色点往屏幕上方/建筑后方挪。',
          '人在建筑后面却盖住建筑：把紫色点往屏幕下方/建筑前方挪。',
          '绿色点：建筑入口中心。拖动绿色点移动入口。',
          '绿色方块：入口半径手柄。拖动可缩放入口圈。',
          '橙色多边形：建筑真实碰撞区域。',
          '拖橙色点：调整碰撞多边形顶点。',
          'Shift+点击多边形边附近：新增碰撞顶点。',
          '右键/Alt+点击橙色点：删除碰撞顶点。',
          '点击建筑文字附近：选择建筑。',
          '',
          '2. 调整半径',
          '入口范围仍用绿色方块或滚轮调整。',
          '旧圆形碰撞数据只作为兜底，不再是主要碰撞形状。',
          '',
          '3. 保存与恢复',
          'Ctrl+S / Cmd+S：保存编辑结果到源码。',
          'Shift+Delete 或右上“删除选中建筑”：删除当前新增建筑。',
          'Delete：清除当前建筑碰撞。',
          'R：清空本地保存，恢复代码默认。',
          'F3：退出编辑模式。',
        ];
    this.guideText.setText(guideLines.join('\n'));
    this.guideText.setPosition(
      12,
      Math.max(42, SCREEN_HEIGHT - this.guideText.height - 12),
    );
  }

  private isDeletePointer(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as MouseEvent | undefined;
    return !!event?.altKey || pointer.rightButtonDown();
  }

  private isShiftPointer(pointer: Phaser.Input.Pointer): boolean {
    return !!(pointer.event as MouseEvent | undefined)?.shiftKey;
  }

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
