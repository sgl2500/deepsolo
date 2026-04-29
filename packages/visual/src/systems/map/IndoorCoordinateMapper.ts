import { INDOOR_SCALE, SCREEN_HEIGHT, SCREEN_WIDTH, TILE_HALF_H, TILE_HALF_W } from '../../config';
import type { IndoorInteractableDef } from '../../types';
import { toLocalIndoorMapPosition, type IndoorFurnitureDef } from '../../content/IndoorFurnitureLayout';

export type ScreenPoint = { x: number; y: number };
export type IndoorMapPoint = { mapX: number; mapY: number };
export type IndoorLocalPoint = { localX: number; localY: number };

type RoomCenterProvider = () => { cx: number; cy: number };
type ContainerOffsetProvider = () => { x: number; y: number };

type LocalRect = {
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
};

export class IndoorCoordinateMapper {
  constructor(
    private getRoomCenter: RoomCenterProvider,
    private getContainerOffset: ContainerOffsetProvider,
  ) {}

  mapToScreen(col: number, row: number): ScreenPoint {
    const { cx, cy } = this.getRoomCenter();
    const s = INDOOR_SCALE;
    return {
      x: TILE_HALF_W * s * ((col - cx) - (row - cy)) + SCREEN_WIDTH / 2,
      y: TILE_HALF_H * s * ((col - cx) + (row - cy)) + SCREEN_HEIGHT / 2,
    };
  }

  mapToScreenWithContainer(col: number, row: number): ScreenPoint {
    const point = this.mapToScreen(col, row);
    const offset = this.getContainerOffset();
    return {
      x: point.x + offset.x,
      y: point.y + offset.y,
    };
  }

  screenToMap(screenX: number, screenY: number): IndoorMapPoint {
    const { cx, cy } = this.getRoomCenter();
    const dx = (screenX - SCREEN_WIDTH / 2) / (TILE_HALF_W * INDOOR_SCALE);
    const dy = (screenY - SCREEN_HEIGHT / 2) / (TILE_HALF_H * INDOOR_SCALE);
    return {
      mapX: cx + (dx + dy) / 2,
      mapY: cy + (dy - dx) / 2,
    };
  }

  screenToLocal(buildingId: string, screenX: number, screenY: number): IndoorLocalPoint {
    const offset = this.getContainerOffset();
    const map = this.screenToMap(screenX - offset.x, screenY - offset.y);
    return toLocalIndoorMapPosition(buildingId, map.mapX, map.mapY);
  }
}

export function roundEditorValue(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normalizeFurnitureCollider(furniture: IndoorFurnitureDef): void {
  if (!furniture.collider) return;
  normalizeLocalRect(furniture.collider);
}

export function normalizeInteractableZone(interactable: IndoorInteractableDef): void {
  if (!interactable.interactionZone) return;
  normalizeLocalRect(interactable.interactionZone);
}

export function strokeIndoorDiamond(
  g: Phaser.GameObjects.Graphics,
  mapper: IndoorCoordinateMapper,
  col: number,
  row: number,
  color: number,
  alpha: number,
): void {
  const center = mapper.mapToScreen(col, row);
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

export function strokeIndoorRectBounds(
  g: Phaser.GameObjects.Graphics,
  mapper: IndoorCoordinateMapper,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  color: number,
  alpha: number,
): void {
  const p1 = mapper.mapToScreen(minX, minY);
  const p2 = mapper.mapToScreen(maxX, minY);
  const p3 = mapper.mapToScreen(maxX, maxY);
  const p4 = mapper.mapToScreen(minX, maxY);
  g.lineStyle(2, color, alpha);
  g.beginPath();
  g.moveTo(p1.x, p1.y);
  g.lineTo(p2.x, p2.y);
  g.lineTo(p3.x, p3.y);
  g.lineTo(p4.x, p4.y);
  g.closePath();
  g.strokePath();
}

function normalizeLocalRect(rect: LocalRect): void {
  const minX = Math.min(rect.minLocalX, rect.maxLocalX);
  const maxX = Math.max(rect.minLocalX, rect.maxLocalX);
  const minY = Math.min(rect.minLocalY, rect.maxLocalY);
  const maxY = Math.max(rect.minLocalY, rect.maxLocalY);
  rect.minLocalX = roundEditorValue(minX);
  rect.maxLocalX = roundEditorValue(maxX);
  rect.minLocalY = roundEditorValue(minY);
  rect.maxLocalY = roundEditorValue(maxY);
}
