import type { Direction } from './common';

/** 场景状态 */
export enum SceneState {
  WorldMap = 'world_map',
  TransitionOut = 'transition_out',
  Indoor = 'indoor',
  TransitionIn = 'transition_in',
  Dialogue = 'dialogue',
  Battle = 'battle',
}

/** 建筑定义 */
export interface BuildingDef {
  id: string;
  name: string;
  /** 世界地图入口坐标 */
  entryX: number;
  entryY: number;
  /** 世界地图建筑贴图锚点；不配置时兼容使用入口坐标 */
  visualX?: number;
  visualY?: number;
  /** 世界地图建筑遮挡排序点；不配置时使用贴图锚点 */
  depthX?: number;
  depthY?: number;
  /** 触发半径（地图格） */
  entryRadius: number;
  /** 大地图建筑碰撞中心与半径；未配置或半径为 0 时不阻挡 */
  collisionX?: number;
  collisionY?: number;
  collisionRadius?: number;
  /** 大地图建筑不规则碰撞多边形；优先于圆形碰撞 */
  collisionPolygon?: Array<{ x: number; y: number }>;
  /** 室内地图 Phaser cache key */
  indoorMapKey: string;
  /** 室内出生点（初始/游戏开始） */
  spawnX: number;
  spawnY: number;
  /** 从外部进入时的出生点（门口），不指定则默认 exitX, exitY-3 */
  doorSpawnX?: number;
  doorSpawnY?: number;
  /** 室内出口坐标 */
  exitX: number;
  exitY: number;
  /** 返回世界地图坐标 */
  returnX: number;
  returnY: number;
}

/** NPC 定义 */
export interface NPCDef {
  id: string;
  name: string;
  /** 所在地图 ID（'world' 或建筑 id） */
  mapId: string;
  mapX: number;
  mapY: number;
  /** 精灵图 key */
  charKey: string;
  /** 对话脚本 ID */
  dialogueId: string;
  /** 默认朝向 */
  defaultDir: Direction;
}

/** 室内可交互对象定义 */
export type IndoorInteractableAction =
  | { type: 'dialogue'; dialogueId: string }
  | {
      type: 'discover_manual';
      manualId: string;
      manualName: string;
      onceFlag: string;
      firstDialogueId: string;
      repeatDialogueId: string;
    }
  | {
      type: 'rest';
      hpRecover: 'full' | number;
      mpRecover: 'full' | number;
      message: string;
    };

export type IndoorInteractableZone = {
  type: 'rect';
  minLocalX: number;
  maxLocalX: number;
  minLocalY: number;
  maxLocalY: number;
};

export interface IndoorInteractableDef {
  id: string;
  name: string;
  /** 所属建筑/室内场景 ID */
  buildingId: string;
  mapX: number;
  mapY: number;
  /** 交互半径（地图格） */
  interactRadius?: number;
  /** 文案提示 */
  prompt?: string;
  /** 矩形交互区域，优先于圆形半径 */
  interactionZone?: IndoorInteractableZone;
  /** 触发的对话脚本 ID（旧配置兼容） */
  dialogueId?: string;
  /** 触发行为 */
  action?: IndoorInteractableAction;
}
