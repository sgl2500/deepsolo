// ============================================================
// BuildingMarkers.ts — 世界地图上的建筑入口标记
// ============================================================

import { toScreen } from '../utils/IsoProjection';
import { BUILDINGS } from '../data/BuildingData';
import type { BuildingDef } from '../types';
import type { MapData } from '../types';

type WorldBuildingVisual = {
  textureKey: string;
  originY: number;
  offsetY: number;
  labelY: number;
  scale?: number;
};

const DEFAULT_WORLD_BUILDING_VISUAL: WorldBuildingVisual = {
  textureKey: 'world_building_a_share',
  originY: 0.9,
  offsetY: 0,
  labelY: -156,
};

const WORLD_BUILDING_VISUALS: Record<string, WorldBuildingVisual> = {
  birth_house: {
    textureKey: 'world_building_player_house',
    originY: 0.9,
    offsetY: 0,
    labelY: -96,
    scale: 2,
  },
  exchange: { textureKey: 'world_building_exchange', originY: 0.9, offsetY: 0, labelY: -130, scale: 0.45 },
  teahouse: { textureKey: 'world_building_teahouse', originY: 0.9, offsetY: 0, labelY: -130 },
  news: { textureKey: 'world_building_news_center', originY: 0.9, offsetY: 0, labelY: -170 },
  token_center: { textureKey: 'world_building_token_center', originY: 0.9, offsetY: 0, labelY: -130 },
  heimu_cliff: { textureKey: 'world_building_heimu_cliff', originY: 0.9, offsetY: 0, labelY: -150 },
};

function findBuilding(id: string): BuildingDef | undefined {
  return BUILDINGS.find((building) => building.id === id);
}

/**
 * 在世界地图上为每个建筑入口创建浮动标记
 * 标记跟随玩家视点移动
 */
export function createBuildingMarkers(scene: Phaser.Scene, mapData: MapData): Phaser.GameObjects.Container[] {
  const markers: Phaser.GameObjects.Container[] = [];

  for (const building of BUILDINGS) {
    const visual = WORLD_BUILDING_VISUALS[building.id] ?? DEFAULT_WORLD_BUILDING_VISUAL;
    const container = scene.add.container(0, 0);

    const buildingSprite = scene.add.image(0, visual.offsetY, visual.textureKey)
      .setOrigin(0.5, visual.originY)
      .setScale(visual.scale ?? 1);
    buildingSprite.setData('baseY', visual.offsetY);
    container.add(buildingSprite);

    // 建筑名称标签
    const label = scene.add.text(0, visual.labelY, building.name, {
      fontSize: '10px',
      color: '#f0c040',
      stroke: '#000',
      strokeThickness: 3,
      fontFamily: 'PingFang SC, monospace',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
    container.add(label);

    const entryGlow = scene.add.graphics();
    entryGlow.fillStyle(0xf0c040, 0.7);
    entryGlow.fillCircle(0, 0, 4);
    entryGlow.lineStyle(1, 0xffffff, 0.45);
    entryGlow.strokeCircle(0, 0, 7);
    container.add(entryGlow);

    // 入口脉冲动画
    scene.tweens.add({
      targets: entryGlow,
      alpha: { from: 0.55, to: 0.95 },
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 存储建筑坐标，用于 update 时计算屏幕位置
    container.setData('buildingId', building.id);
    container.setData('entryGlow', entryGlow);

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
    const building = findBuilding(m.getData('buildingId') as string);
    if (!building) continue;
    const bx = building.visualX ?? building.entryX;
    const by = building.visualY ?? building.entryY;
    const depthX = building.depthX ?? bx;
    const depthY = building.depthY ?? by;
    const screen = toScreen(bx, by, playerX, playerY);
    const entryScreen = toScreen(building.entryX, building.entryY, playerX, playerY);
    m.x = screen.x;
    m.y = screen.y;
    m.setDepth(depthX + depthY + 0.25);
    const entryGlow = m.getData('entryGlow') as Phaser.GameObjects.Graphics | undefined;
    if (entryGlow) {
      entryGlow.x = entryScreen.x - screen.x;
      entryGlow.y = entryScreen.y - screen.y;
    }
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
