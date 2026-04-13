// ============================================================
// EntitySystem.ts — 实体管理
// ============================================================

import { Player } from '../entities/Player';
import { Agent } from '../entities/Agent';
import type { BubbleHandle } from '../ui/BubbleFactory';
import { BubbleFactory } from '../ui/BubbleFactory';
import type { MapData, CharMeta, Strategy, BubbleConfig } from '../types';

export class EntitySystem {
  player!: Player;
  agents: Map<string, Agent> = new Map();
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

  update(time: number, delta: number): void {
    const px = this.player.mapX;
    const py = this.player.mapY;

    this.player.update(time, delta, px, py);

    for (const agent of this.agents.values()) {
      agent.update(time, delta, px, py);
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
      if (Math.abs(worldX - agent.container.x) < 20 && Math.abs(worldY - agent.container.y) < 25) {
        return agent;
      }
    }
    return null;
  }

  destroy(): void {
    this.player.destroy();
    this.agents.forEach(a => a.destroy());
  }
}
