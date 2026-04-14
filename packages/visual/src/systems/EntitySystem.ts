// ============================================================
// EntitySystem.ts — 实体管理
// ============================================================

import { Player } from '../entities/Player';
import { Agent } from '../entities/Agent';
import { NPC } from '../entities/NPC';
import { NPC_DEFS } from '../data/NPCData';
import type { BubbleHandle } from '../ui/BubbleFactory';
import { BubbleFactory } from '../ui/BubbleFactory';
import type { MapData, CharMeta, Strategy, BubbleConfig } from '../types';

export class EntitySystem {
  player!: Player;
  agents: Map<string, Agent> = new Map();
  npcs: Map<string, NPC> = new Map();
  private bubbles: Map<string, BubbleHandle> = new Map();

  private scene: Phaser.Scene;
  private mapData: MapData;

  constructor(scene: Phaser.Scene, mapData: MapData) {
    this.scene = scene;
    this.mapData = mapData;
  }

  createPlayer(inputController: import('../systems/InputController').InputController): void {
    this.player = new Player(this.scene, this.mapData, inputController);
  }

  createAgents(charMeta: CharMeta, strategies: Strategy[]): void {
    strategies.forEach((s, idx) => {
      const agent = new Agent(this.scene, this.mapData, charMeta, s, idx);
      this.agents.set(s.id, agent);
    });
  }

  /** 为指定建筑创建 NPC */
  createNPCs(buildingId: string, indoorCx?: number, indoorCy?: number): void {
    this.clearNPCs();
    const mapData = this.mapData; // 使用当前地图数据
    const defs = NPC_DEFS.filter(n => n.mapId === buildingId);
    defs.forEach(def => {
      const npc = new NPC(this.scene, mapData, def);
      if (indoorCx !== undefined && indoorCy !== undefined) {
        npc.setIndoorMode(true, indoorCx, indoorCy);
      }
      this.npcs.set(def.id, npc);
    });
  }

  /** 清除所有 NPC */
  clearNPCs(): void {
    this.npcs.forEach(n => n.destroy());
    this.npcs.clear();
  }

  /** 获取玩家附近的 NPC */
  getNearbyNPC(playerX: number, playerY: number, threshold: number): NPC | null {
    for (const npc of this.npcs.values()) {
      const dx = npc.mapX - playerX;
      const dy = npc.mapY - playerY;
      if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
        return npc;
      }
    }
    return null;
  }

  /** 立即同步所有实体的屏幕位置（场景切换时调用，防止闪现） */
  syncEntityScreenPositions(playerX: number, playerY: number): void {
    // 玩家固定在屏幕中心
    this.player.container.x = 1280 / 2;
    this.player.container.y = 720 / 2;
    // NPC 按相对玩家位置放置
    for (const npc of this.npcs.values()) {
      npc.updateScreenPosition(playerX, playerY);
    }
  }

  /** 设置世界 Agent 可见性 */
  setWorldAgentsVisible(visible: boolean): void {
    for (const agent of this.agents.values()) {
      agent.container.setVisible(visible);
    }
  }

  update(time: number, delta: number): void {
    const px = this.player.mapX;
    const py = this.player.mapY;

    this.player.update(time, delta, px, py);

    for (const agent of this.agents.values()) {
      agent.update(time, delta, px, py);
    }

    for (const npc of this.npcs.values()) {
      npc.update(time, delta, px, py);
    }
  }

  /** 为指定实体显示气泡 */
  showBubble(entityId: string, text: string, config?: BubbleConfig): void {
    // 销毁旧气泡
    const old = this.bubbles.get(entityId);
    if (old) {
      old.destroy();
      this.bubbles.delete(entityId);
    }

    let parent: Phaser.GameObjects.Container;
    if (entityId === 'player') {
      parent = this.player.container;
    } else {
      const agent = this.agents.get(entityId);
      if (!agent) return;
      parent = agent.container;
    }

    const handle = BubbleFactory.create(this.scene, parent, text, config);
    this.bubbles.set(entityId, handle);
  }

  /** 获取玩家点击检测 */
  getClickedAgent(worldX: number, worldY: number): Agent | null {
    for (const agent of this.agents.values()) {
      if (!agent.container.visible) continue;
      if (Math.abs(worldX - agent.container.x) < 20 && Math.abs(worldY - agent.container.y) < 25) {
        return agent;
      }
    }
    return null;
  }

  getPlayer(): Player {
    return this.player;
  }

  destroy(): void {
    this.player.destroy();
    this.agents.forEach(a => a.destroy());
    this.npcs.forEach(n => n.destroy());
  }
}
