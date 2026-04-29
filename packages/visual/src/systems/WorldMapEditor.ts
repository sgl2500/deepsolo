import { LS_KEY_WORLD_MAP_EDITOR_LAYOUTS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W } from '../config';
import { BUILDINGS } from '../data/BuildingData';
import type { BuildingDef } from '../types';
import { toScreen } from '../utils/IsoProjection';

type WorldEditorHandleKind = 'visual-center' | 'entry-center' | 'entry-radius' | 'collision-center' | 'collision-radius' | 'collision-point';

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
  entryX: number;
  entryY: number;
  entryRadius: number;
  collisionX?: number;
  collisionY?: number;
  collisionRadius?: number;
  collisionPolygon?: BuildingDef['collisionPolygon'];
};

type WorldEditorStoragePayload = {
  version: 1 | 2 | 3 | 4;
  savedAt: number;
  items: WorldEditorSnapshotItem[];
};

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
  private guideCollapsed = false;
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private readonly collisionInsertScreenThreshold = 18;

  constructor(scene: Phaser.Scene) {
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

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('wheel', this.onPointerWheel, this);
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.overlay.setVisible(active);
    this.helpText.setVisible(active);
    this.guideText.setVisible(active);
    this.drag = null;
    if (active && !this.selectedBuildingId) {
      this.selectedBuildingId = BUILDINGS[0]?.id ?? null;
    }
    this.clearTexts();
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
    this.updateHelpText();
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
      const visualScreen = toScreen(visualX, visualY, playerX, playerY);
      const entryScreen = toScreen(building.entryX, building.entryY, playerX, playerY);
      const entryRadiusHandle = toScreen(building.entryX + building.entryRadius, building.entryY, playerX, playerY);
      const entryRx = building.entryRadius * TILE_HALF_W;
      const entryRy = building.entryRadius * TILE_HALF_H;

      if (selected) {
        this.overlay.lineStyle(1, 0xfbbf24, 0.55);
        this.overlay.lineBetween(visualScreen.x, visualScreen.y, entryScreen.x, entryScreen.y);
      }

      this.overlay.fillStyle(0xfbbf24, selected ? 0.96 : 0.68);
      this.overlay.fillCircle(visualScreen.x, visualScreen.y, selected ? 7 : 5);
      this.overlay.lineStyle(selected ? 2 : 1, selected ? 0xffffff : 0x78350f, selected ? 0.95 : 0.65);
      this.overlay.strokeCircle(visualScreen.x, visualScreen.y, selected ? 10 : 7);

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
      const label = this.scene.add.text(visualScreen.x + 10, visualScreen.y - 54, `${building.name}\n建筑 ${visualX.toFixed(1)},${visualY.toFixed(1)}\n入口 ${building.entryX.toFixed(1)},${building.entryY.toFixed(1)} r=${building.entryRadius.toFixed(1)}\n${collisionText}`, {
        fontSize: selected ? '11px' : '10px',
        color: selected ? '#fef3c7' : '#d1d5db',
        stroke: '#000000',
        strokeThickness: 3,
        fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
      }).setDepth(21001).setScrollFactor(0);
      this.texts.push(label);
    }
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
      const visualScreen = toScreen(visualX, visualY, this.lastPlayerX, this.lastPlayerY);
      const entryScreen = toScreen(building.entryX, building.entryY, this.lastPlayerX, this.lastPlayerY);
      const entryRadiusHandle = toScreen(building.entryX + building.entryRadius, building.entryY, this.lastPlayerX, this.lastPlayerY);
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
      const entryScreen = toScreen(building.entryX, building.entryY, this.lastPlayerX, this.lastPlayerY);
      const dist = Math.min(
        Phaser.Math.Distance.Between(screenX, screenY, entryScreen.x, entryScreen.y),
        Phaser.Math.Distance.Between(screenX, screenY, visualScreen.x, visualScreen.y),
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
      if ((payload.version !== 1 && payload.version !== 2 && payload.version !== 3 && payload.version !== 4) || !Array.isArray(payload.items)) return;
      this.applySnapshot(payload.items, payload.version);
    } catch (error) {
      console.warn('[WorldMapEditor] Failed to load saved layout:', error);
    }
  }

  private saveLayoutToStorage(): void {
    const payload: WorldEditorStoragePayload = {
      version: 4,
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
      entryX: building.entryX,
      entryY: building.entryY,
      entryRadius: building.entryRadius,
      collisionX: building.collisionX,
      collisionY: building.collisionY,
      collisionRadius: building.collisionRadius ?? 0,
      collisionPolygon: building.collisionPolygon?.map((point) => ({ ...point })),
    }));
  }

  private applySnapshot(items: WorldEditorSnapshotItem[], payloadVersion: 1 | 2 | 3 | 4 = 4): void {
    for (const item of items) {
      const building = BUILDINGS.find((candidate) => candidate.id === item.id);
      if (!building) continue;
      if (item.visualX !== undefined) building.visualX = item.visualX;
      if (item.visualY !== undefined) building.visualY = item.visualY;
      building.entryX = item.entryX;
      building.entryY = item.entryY;
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
    const selectedText = selected
      ? [
          `当前建筑：${selected.name}`,
          `入口：${selected.entryX.toFixed(1)}, ${selected.entryY.toFixed(1)}  r=${selected.entryRadius.toFixed(1)}`,
          `碰撞：${(selected.collisionX ?? selected.entryX).toFixed(1)}, ${(selected.collisionY ?? selected.entryY).toFixed(1)}  r=${(selected.collisionRadius ?? 0).toFixed(1)}`,
        ].join('\n')
      : '当前建筑：无';

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
          '黄色点/建筑本体：拖动整栋建筑贴图。',
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
          '3. 清除与恢复',
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
