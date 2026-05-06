// ============================================================
// SceneData.ts — 场景定义 + NPC 家的位置
// ============================================================

import { getAutomatedBuildings } from '../content/AutomatedBuildingRegistry';

/** 场景定义（建筑在世界地图上的位置） */
export interface SceneDef {
  id: string;
  name: string;
  x: number;            // 世界地图坐标
  y: number;
  entryRadius: number;  // 触发进入的半径
}

/** 世界上的场景建筑 */
export const SCENES: SceneDef[] = [
  { id: 'birth_house', name: '观察者小屋',  x: 50, y: 55, entryRadius: 2 },
  { id: 'exchange',  name: '证券交易所',   x: 50, y: 50, entryRadius: 2 },
  { id: 'teahouse',  name: '策略茶馆',     x: 20, y: 45, entryRadius: 2 },
  { id: 'news',      name: '新闻中心',     x: 75, y: 15, entryRadius: 2 },
  { id: 'datacenter',name: '行情数据中心', x: 75, y: 30, entryRadius: 2 },
  { id: 'lab',       name: '进化实验室',   x: 75, y: 65, entryRadius: 2 },
  { id: 'rank',      name: '排行榜广场',   x: 75, y: 80, entryRadius: 2 },
  { id: 'token_center', name: 'Token中心', x: 40, y: 85, entryRadius: 2 },
  { id: 'heimu_cliff',  name: '黑木崖',     x: 85, y: 50, entryRadius: 2 },
  ...getAutomatedBuildings().map((building): SceneDef => ({
    id: building.id,
    name: building.name,
    x: building.entryX,
    y: building.entryY,
    entryRadius: building.entryRadius ?? 2,
  })),
];

/** 场景坐标查找表 */
export const SCENE_POSITIONS: Record<string, { x: number; y: number }> = {};
SCENES.forEach(s => { SCENE_POSITIONS[s.id] = { x: s.x, y: s.y }; });

/** NPC 家的位置（每个 agent ID 对应一个家） */
export const HOME_POSITIONS: Record<string, { x: number; y: number }> = {
  hv1: { x: 10, y: 15 },
  hv2: { x: 20, y: 15 },
  hv3: { x: 30, y: 15 },
  hv4: { x: 10, y: 25 },
  nv1: { x: 20, y: 25 },
  nv2: { x: 30, y: 25 },
};

/** 获取场景或家的坐标 */
export function getScenePosition(sceneId: string, agentId: string): { x: number; y: number } {
  if (sceneId === 'home') {
    return HOME_POSITIONS[agentId] || { x: 50, y: 50 };
  }
  return SCENE_POSITIONS[sceneId] || { x: 50, y: 50 };
}
