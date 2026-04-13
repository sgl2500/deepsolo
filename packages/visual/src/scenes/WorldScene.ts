// ============================================================
// WorldScene.ts — 主游戏场景（协调者）
// ============================================================

import Phaser from 'phaser';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../config';
import type { MapData, TileMeta, CharMeta } from '../types';
import { EventBus } from '../core/EventBus';
import { GameStore } from '../core/GameStore';
import { MapRenderer } from '../systems/MapRenderer';
import { InputController } from '../systems/InputController';
import { EntitySystem } from '../systems/EntitySystem';
import { MinimapSystem } from '../systems/MinimapSystem';
import { DayCycleSystem } from '../systems/DayCycleSystem';
import { DiscussionSystem } from '../systems/DiscussionSystem';

let _eventBus: EventBus;
let _store: GameStore;

export function setWorldContext(eventBus: EventBus, store: GameStore): void {
  _eventBus = eventBus;
  _store = store;
}

export class WorldScene extends Phaser.Scene {
  private mapRenderer!: MapRenderer;
  private inputController!: InputController;
  private entitySystem!: EntitySystem;
  private minimapSystem!: MinimapSystem;
  private dayCycleSystem!: DayCycleSystem;
  private discussionSystem!: DiscussionSystem;

  private mapData!: MapData;
  private tileMeta!: TileMeta;
  private charMeta!: CharMeta;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.mapData = this.cache.json.get('map');
    this.tileMeta = this.cache.json.get('tmeta');
    this.charMeta = this.cache.json.get('charmeta');

    this.inputController = new InputController(this);

    this.mapRenderer = new MapRenderer(this);
    this.mapRenderer.init(this.mapData, this.tileMeta);
    const initX = this.mapData.width / 2;
    const initY = this.mapData.height / 2;
    this.mapRenderer.renderBuffer(initX, initY);
    this.mapRenderer.blitToScreen(initX, initY);

    this.entitySystem = new EntitySystem(this, this.mapData);
    this.entitySystem.createPlayer(this.inputController);
    this.entitySystem.createAgents(this.charMeta, _store.strategies);

    this.minimapSystem = new MinimapSystem(this.mapData);

    this.discussionSystem = new DiscussionSystem(
      this, this.entitySystem, _store, _eventBus,
    );

    this.dayCycleSystem = new DayCycleSystem(
      this, _store, this.entitySystem, _eventBus, this.discussionSystem,
    );

    // 点击交互
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const agent = this.entitySystem.getClickedAgent(ptr.x, ptr.y);
      if (agent) {
        _store.selectStrategy(agent.strategy);
        // 如果在讨论中，同时打开讨论实况
        if (agent.inDiscussion) {
          const group = this.discussionSystem.getGroupForAgent(agent.id);
          if (group) {
            _eventBus.emit('discussion:view', group);
          }
        }
      }
    });

    // 玩家初始气泡
    this.time.delayedCall(1000, () => {
      this.entitySystem.showBubble('player', '我今天心情不错');
    });

    _eventBus.emit('ui:refresh');
  }

  update(time: number, delta: number): void {
    this.entitySystem.update(time, delta);

    const px = this.entitySystem.player.mapX;
    const py = this.entitySystem.player.mapY;

    if (this.mapRenderer.shouldRerender(px, py)) {
      this.mapRenderer.renderBuffer(px, py);
    }
    this.mapRenderer.blitToScreen(px, py);

    this.minimapSystem.update(time, px, py, this.entitySystem.agents);

    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      debugEl.textContent = `x:${px.toFixed(1)} y:${py.toFixed(1)}`;
    }
  }
}
