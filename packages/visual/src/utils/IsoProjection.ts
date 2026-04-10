// ============================================================
// IsoProjection.ts — 等距投影工具
// ============================================================

import { TILE_HALF_W, TILE_HALF_H, SCREEN_WIDTH, SCREEN_HEIGHT } from '../config';
import type { MapData } from '../types';

/** 地图坐标 → 屏幕坐标（相对于玩家视角中心） */
export function toScreen(
  mapX: number, mapY: number,
  playerX: number, playerY: number,
): { x: number; y: number } {
  const dx = mapX - playerX;
  const dy = mapY - playerY;
  return {
    x: TILE_HALF_W * (dx - dy) + SCREEN_WIDTH / 2,
    y: TILE_HALF_H * (dx + dy) + SCREEN_HEIGHT / 2,
  };
}

/** 获取地图瓦片 ID */
export function getTile(map: MapData, layer: 0 | 1, mx: number, my: number): number {
  const ix = Math.round(mx);
  const iy = Math.round(my);
  if (ix < 0 || ix >= map.width || iy < 0 || iy >= map.height) return 0;
  return layer === 0 ? map.earth[iy][ix] : map.surface[iy][ix];
}
