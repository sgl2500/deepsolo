import { Direction } from '../types';
import type { NPCDef } from '../types';

/**
 * NPC 定义 — 各地图中的 NPC 角色
 *
 * mapId: 'world' 表示世界地图，或建筑 id 表示室内
 * charKey: 用于从 Phaser 纹理中查找精灵帧
 * dialogueId: 对话脚本 ID，对应 DialogueScripts.ts 中的 key
 */
export const NPC_DEFS: NPCDef[] = [
  // --- 观察者小屋 NPC ---
  {
    id: 'gushen',
    name: '股神',
    mapId: 'birth_house',
    mapX: 10.5,
    mapY: 12.5,
    charKey: 'token_center_shishu',
    dialogueId: 'gushen_story_entry',
    defaultDir: Direction.Down,
  },
  // --- 证券交易所 NPC ---
  {
    id: 'broker_wang',
    name: '王经纪',
    mapId: 'exchange',
    mapX: 6,
    mapY: 6,
    charKey: 'npc_1001',
    dialogueId: 'broker_wang_intro',
    defaultDir: Direction.Down,
  },
  {
    id: 'analyst_li',
    name: '李分析师',
    mapId: 'exchange',
    mapX: 12,
    mapY: 6,
    charKey: 'npc_1010',
    dialogueId: 'analyst_li_intro',
    defaultDir: Direction.Left,
  },
  // --- 策略茶馆 NPC ---
  {
    id: 'master_chen',
    name: '陈掌柜',
    mapId: 'teahouse',
    mapX: 10,
    mapY: 5.8,
    charKey: 'smap_2557',
    dialogueId: 'master_chen_intro',
    defaultDir: Direction.Down,
  },
];
