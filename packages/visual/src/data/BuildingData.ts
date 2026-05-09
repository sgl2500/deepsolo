import type { BuildingDef } from '../types';
import { SCENES } from './SceneData';
import { getAutomatedBuildings, type AutomatedBuildingSpec } from '../content/AutomatedBuildingRegistry';
import { WORLD_LAYOUT_SOURCE } from './WorldLayoutSource';

const layoutOverride = WORLD_LAYOUT_SOURCE;

/**
 * 建筑定义 — 世界地图上的建筑入口与室内场景对应关系
 *
 * 坐标系：使用现有 100x100 世界地图坐标
 * entryX/Y: 世界地图上建筑的入口位置（玩家走到这里触发进入）
 * exitX/Y: 室内地图上的出口位置
 * returnX/Y: 退出后回到世界地图的位置
 */

/** 通用室内地图参数（所有新建筑复用） */
function makeDefaultCollisionPolygon(x: number, y: number): BuildingDef['collisionPolygon'] {
  return [
    { x: x - 2.6, y: y - 1.1 },
    { x: x - 0.8, y: y - 2.4 },
    { x: x + 2.2, y: y - 1.6 },
    { x: x + 2.7, y: y + 0.7 },
    { x: x + 0.8, y: y + 2.3 },
    { x: x - 2.4, y: y + 1.4 },
  ];
}

function makeSimpleIndoor(id: string, entryX: number, entryY: number): BuildingDef {
  return {
    id,
    name: SCENES.find(s => s.id === id)?.name || id,
    entryX,
    entryY,
    visualX: entryX,
    visualY: entryY,
    entryRadius: 2,
    collisionX: entryX,
    collisionY: entryY,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(entryX, entryY),
    indoorMapKey: `indoor_${id}`,
    spawnX: 9,
    spawnY: 9,
    exitX: 10,
    exitY: 17,
    returnX: entryX,
    returnY: entryY + 3,
  };
}

export function createBuildingDefFromAutomatedSpec(spec: AutomatedBuildingSpec): BuildingDef {
  const entryRadius = spec.entryRadius ?? 2;
  const indoorMapKey = spec.indoorMapKey ?? `indoor_${spec.id}`;
  const exitX = spec.exitX ?? 10;
  const exitY = spec.exitY ?? 19;
  return {
    id: spec.id,
    name: spec.name,
    entryX: spec.entryX,
    entryY: spec.entryY,
    visualX: spec.visualX ?? spec.entryX,
    visualY: spec.visualY ?? spec.entryY,
    depthX: spec.depthX,
    depthY: spec.depthY,
    entryRadius,
    collisionX: spec.entryX,
    collisionY: spec.entryY,
    collisionRadius: spec.collisionRadius ?? 2.8,
    collisionPolygon: spec.collisionPolygon ?? makeDefaultCollisionPolygon(spec.entryX, spec.entryY),
    indoorMapKey,
    spawnX: spec.spawnX ?? 10,
    spawnY: spec.spawnY ?? 10,
    doorSpawnX: spec.doorSpawnX,
    doorSpawnY: spec.doorSpawnY,
    exitX,
    exitY,
    returnX: spec.returnX ?? spec.entryX,
    returnY: spec.returnY ?? spec.entryY + 3,
  };
}

export const BUILDINGS: BuildingDef[] = [
  // --- 观察者小屋（26×26 含草地外围） ---
  {
    id: 'birth_house',
    name: '观察者小屋',
    entryX: 50,
    entryY: 55,
    visualX: 50,
    visualY: 55,
    entryRadius: 2,
    collisionX: 50,
    collisionY: 55,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(50, 55),
    indoorMapKey: 'indoor_birth_house',
    spawnX: 13,
    spawnY: 13,
    doorSpawnX: 12.5,
    doorSpawnY: 20.4,
    exitX: 12.5,
    exitY: 21.8,
    exitRadius: 0.65,
    returnX: 50,
    returnY: 58,
  },

  // --- 原有建筑 ---
  {
    id: 'exchange',
    name: '证券交易所',
    entryX: 20,
    entryY: 90,
    visualX: 20,
    visualY: 90,
    entryRadius: 2,
    collisionX: 20,
    collisionY: 90,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(20, 90),
    indoorMapKey: 'indoor_exchange',
    spawnX: 9,
    spawnY: 9,
    exitX: 10,
    exitY: 17,
    returnX: 20,
    returnY: 93,
  },
  {
    id: 'teahouse',
    name: '策略茶馆',
    entryX: 30,
    entryY: 90,
    visualX: 30,
    visualY: 90,
    entryRadius: 2,
    collisionX: 30,
    collisionY: 90,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(30, 90),
    indoorMapKey: 'indoor_teahouse',
    spawnX: 10,
    spawnY: 10,
    exitX: 10,
    exitY: 19,
    returnX: 30,
    returnY: 93,
  },

  // --- 新增场景建筑 ---
  makeSimpleIndoor('news',       10, 90),

  // --- Token中心（60×60，35×35 砖墙房间） ---
  {
    id: 'token_center',
    name: 'Token中心',
    entryX: 40,
    entryY: 85,
    visualX: 40,
    visualY: 85,
    entryRadius: 2,
    collisionX: 40,
    collisionY: 85,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(40, 85),
    indoorMapKey: 'indoor_token_center',
    spawnX: 20,
    spawnY: 20,
    exitX: 20,
    exitY: 37,
    returnX: 40,
    returnY: 88,
  },

  // --- 黑木崖（JYQXZ 场景 82） ---
  {
    id: 'heimu_cliff',
    name: '黑木崖',
    entryX: 85,
    entryY: 50,
    visualX: 85,
    visualY: 50,
    entryRadius: 2,
    collisionX: 85,
    collisionY: 50,
    collisionRadius: 2.8,
    collisionPolygon: makeDefaultCollisionPolygon(85, 50),
    indoorMapKey: 'indoor_heimu_cliff',
    spawnX: 38,
    spawnY: 34,
    exitX: 38,
    exitY: 40,
    returnX: 85,
    returnY: 53,
  },

  // --- 自动注册建筑（由 scripts/register_indoor_building.mjs 维护） ---
  ...getAutomatedBuildings().map(createBuildingDefFromAutomatedSpec),
];

// 应用编辑器保存的 override 数据（覆盖位置/碰撞等运行时可编辑字段）
if (Array.isArray(layoutOverride.items) && layoutOverride.items.length > 0) {
  for (const item of layoutOverride.items) {
    const building = BUILDINGS.find((b) => b.id === item.id);
    if (!building) continue;
    if (item.entryX !== undefined) building.entryX = item.entryX;
    if (item.entryY !== undefined) building.entryY = item.entryY;
    if (item.returnX !== undefined) {
      building.returnX = item.returnX;
    } else if (item.entryX !== undefined) {
      building.returnX = item.entryX;
    }
    if (item.returnY !== undefined) {
      building.returnY = item.returnY;
    } else if (item.entryY !== undefined) {
      building.returnY = item.entryY + 3;
    }
    if (item.visualX !== undefined) building.visualX = item.visualX;
    if (item.visualY !== undefined) building.visualY = item.visualY;
    if (item.depthX !== undefined) building.depthX = item.depthX;
    if (item.depthY !== undefined) building.depthY = item.depthY;
    if (item.entryRadius !== undefined) building.entryRadius = item.entryRadius;
    if (item.collisionX !== undefined) building.collisionX = item.collisionX;
    if (item.collisionY !== undefined) building.collisionY = item.collisionY;
    if (item.collisionRadius !== undefined) building.collisionRadius = item.collisionRadius;
    if (Array.isArray(item.collisionPolygon)) {
      building.collisionPolygon = item.collisionPolygon.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    }
  }
}
