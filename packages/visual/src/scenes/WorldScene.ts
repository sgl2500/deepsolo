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

// 这些由 main.ts 创建并通过 scene data 传入
let _eventBus: EventBus;
let _store: GameStore;

export function setWorldContext(eventBus: EventBus, store: GameStore): void {
  _eventBus = eventBus;
  _store = store;
}

export class WorldScene extends Phaser.Scene {
  // Systems
  private mapRenderer!: MapRenderer;
  private inputController!: InputController;
  private entitySystem!: EntitySystem;
  private minimapSystem!: MinimapSystem;
  private dayCycleSystem!: DayCycleSystem;

  // Data
  private mapData!: MapData;
  private tileMeta!: TileMeta;
  private charMeta!: CharMeta;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    // 加载缓存数据
    this.mapData = this.cache.json.get('map');
    this.tileMeta = this.cache.json.get('tmeta');
    this.charMeta = this.cache.json.get('charmeta');

    // 初始化输入
    this.inputController = new InputController(this);

    // 初始化地图渲染器
    this.mapRenderer = new MapRenderer(this);
    this.mapRenderer.init(this.mapData, this.tileMeta);
    const initX = this.mapData.width / 2;
    const initY = this.mapData.height / 2;
    this.mapRenderer.renderBuffer(initX, initY);
    // 立即 blit 一次，确保第一帧就有地图
    this.mapRenderer.blitToScreen(initX, initY);

    // 初始化实体系统
    this.entitySystem = new EntitySystem(this, this.mapData);
    this.entitySystem.createPlayer(this.inputController);
    this.entitySystem.createAgents(this.charMeta, _store.strategies);

    // 初始化小地图
    this.minimapSystem = new MinimapSystem(this.mapData);

    // 初始化日循环系统
    this.dayCycleSystem = new DayCycleSystem(this, _store, this.entitySystem, _eventBus);

    // 点击交互
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const agent = this.entitySystem.getClickedAgent(ptr.x, ptr.y);
      if (agent) {
        _store.selectStrategy(agent.strategy);
      }
    });

    // 玩家初始气泡
    this.time.delayedCall(1000, () => {
      this.entitySystem.showBubble('player', '我今天心情不错');
    });

    // 触发 UI 初始渲染
    _eventBus.emit('ui:refresh');
  }

  update(time: number, delta: number): void {
    // 更新实体（含玩家移动）
    this.entitySystem.update(time, delta);

    const px = this.entitySystem.player.mapX;
    const py = this.entitySystem.player.mapY;

    // 地图渲染
    if (this.mapRenderer.shouldRerender(px, py)) {
      this.mapRenderer.renderBuffer(px, py);
    }
    this.mapRenderer.blitToScreen(px, py);

    // 更新小地图
    this.minimapSystem.update(time, px, py, this.entitySystem.agents);

    // Debug info
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      debugEl.textContent = `x:${px.toFixed(1)} y:${py.toFixed(1)}`;
    }
  }
}
