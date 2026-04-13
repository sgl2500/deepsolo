// ============================================================
// BuildingMarkers.ts — 世界地图上的建筑入口标记
// ============================================================

import { toScreen } from '../utils/IsoProjection';
import { TILE_HALF_W, TILE_HALF_H, SCREEN_WIDTH, SCREEN_HEIGHT } from '../config';
import { BUILDINGS } from '../data/BuildingData';
import type { MapData } from '../types';

/**
 * 在世界地图上为每个建筑入口创建浮动标记
 * 标记跟随玩家视点移动
 */
export function createBuildingMarkers(scene: Phaser.Scene, mapData: MapData): Phaser.GameObjects.Container[] {
  const markers: Phaser.GameObjects.Container[] = [];

  for (const building of BUILDINGS) {
    const container = scene.add.container(0, 0).setDepth(9999);

    // 建筑名称标签
    const label = scene.add.text(0, -28, building.name, {
      fontSize: '10px',
      color: '#f0c040',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    container.add(label);

    // 浮动菱形图标
    const icon = scene.add.graphics();
    icon.fillStyle(0xf0c040, 0.8);
    icon.fillCircle(0, 0, 6);
    icon.lineStyle(1, 0xffffff, 0.6);
    icon.strokeCircle(0, 0, 8);
    container.add(icon);

    // 入口脉冲动画
    scene.tweens.add({
      targets: icon,
      alpha: { from: 0.6, to: 1.0 },
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 上下浮动
    scene.tweens.add({
      targets: container,
      y: '-=3',
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 存储建筑坐标，用于 update 时计算屏幕位置
    container.setData('mapX', building.entryX);
    container.setData('mapY', building.entryY);

    markers.push(container);
  }

  return markers;
}

/** 每帧更新标记的屏幕位置 */
export function updateBuildingMarkers(
  markers: Phaser.GameObjects.Container[],
  playerX: number,
  playerY: number,
): void {
  for (const m of markers) {
    const bx = m.getData('mapX') as number;
    const by = m.getData('mapY') as number;
    const screen = toScreen(bx, by, playerX, playerY);
    m.x = screen.x;
    // 覆盖 tween 设的 y，用基础值 + tween 偏移
    m.y = screen.y - 10;
  }
}

/** 隐藏/显示标记 */
export function setBuildingMarkersVisible(
  markers: Phaser.GameObjects.Container[],
  visible: boolean,
): void {
  for (const m of markers) {
    m.setVisible(visible);
  }
}
