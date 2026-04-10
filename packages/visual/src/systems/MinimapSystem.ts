// ============================================================
// MinimapSystem.ts — 小地图
// ============================================================

import { MINIMAP_SIZE, MINIMAP_THROTTLE } from '../config';
import type { MapData } from '../types';

export class MinimapSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mapData: MapData;
  private baseImage!: ImageData;
  private lastTime = 0;

  constructor(mapData: MapData) {
    this.mapData = mapData;
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.renderBase();
  }

  private renderBase(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    const step = 2;

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < this.mapData.height; y += step) {
      for (let x = 0; x < this.mapData.width; x += step) {
        const ev = this.mapData.earth[y][x];
        let c = '#111a11';
        if (ev > 0) {
          const g = ev >> 1;
          if (g >= 25 && g <= 45) c = '#1a3a1a';
          else if (g >= 55 && g <= 75) c = '#1a2a5a';
          else if (g >= 170 && g <= 185) c = '#2a1a1a';
          else c = '#1a2a1a';
        }
        ctx.fillStyle = c;
        ctx.fillRect(
          x / this.mapData.width * w,
          y / this.mapData.height * h,
          w / this.mapData.width * step + 1,
          h / this.mapData.height * step + 1,
        );
      }
    }
    this.baseImage = ctx.getImageData(0, 0, w, h);
  }

  update(
    time: number,
    playerX: number, playerY: number,
    agents: Map<string, import('../entities/Agent').Agent>,
  ): void {
    if (time - this.lastTime < MINIMAP_THROTTLE) return;
    this.lastTime = time;

    const cv = this.canvas;
    const ctx = this.ctx;
    ctx.putImageData(this.baseImage, 0, 0);

    // 玩家
    const mx = (playerX / this.mapData.width) * cv.width;
    const my = (playerY / this.mapData.height) * cv.height;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(mx - 2, my - 2, 4, 4);

    // Agents
    for (const a of agents.values()) {
      const ax = (a.mapX / this.mapData.width) * cv.width;
      const ay = (a.mapY / this.mapData.height) * cv.height;
      ctx.fillStyle = a.strategy.category === 'hot' ? '#fbbf24'
        : a.strategy.category === 'emerged' ? '#60a5fa' : '#6b7280';
      ctx.fillRect(ax - 1, ay - 1, 2, 2);
    }
  }
}
