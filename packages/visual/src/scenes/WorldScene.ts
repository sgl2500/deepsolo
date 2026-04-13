// ============================================================
// WorldScene.ts — 主游戏场景（协调者）
// ============================================================

import Phaser from 'phaser';
import { SCREEN_WIDTH, SCREEN_HEIGHT, NPC_INTERACT_DIST } from '../config';
import { SceneState, type MapData, type TileMeta, type CharMeta } from '../types';
import { EventBus } from '../core/EventBus';
import { GameStore } from '../core/GameStore';
import { MapRenderer } from '../systems/MapRenderer';
import { InputController } from '../systems/InputController';
import { EntitySystem } from '../systems/EntitySystem';
import { MinimapSystem } from '../systems/MinimapSystem';
import { DayCycleSystem } from '../systems/DayCycleSystem';
import { DiscussionSystem } from '../systems/DiscussionSystem';
import { SceneManager } from '../systems/SceneManager';
import { DialogueSystem } from '../systems/DialogueSystem';
import { BUILDINGS } from '../data/BuildingData';
import { createBuildingMarkers, updateBuildingMarkers } from '../systems/BuildingMarkers';

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
  private sceneManager!: SceneManager;
  private dialogueSystem!: DialogueSystem;
  private buildingMarkers!: Phaser.GameObjects.Container[];

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

    this.dialogueSystem = new DialogueSystem(this, _eventBus);

    // 建筑入口标记（必须在 SceneManager 之前创建）
    this.buildingMarkers = createBuildingMarkers(this, this.mapData);

    this.sceneManager = new SceneManager(
      this, this.mapRenderer, this.entitySystem,
      this.inputController, this.dialogueSystem,
      this.minimapSystem, this.buildingMarkers, _eventBus, _store,
    );
    this.sceneManager.saveWorldContext(this.mapData, this.tileMeta);

    // 点击交互
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.sceneManager.isPlayerLocked()) return;
      const agent = this.entitySystem.getClickedAgent(ptr.x, ptr.y);
      if (agent) {
        _store.selectStrategy(agent.strategy);
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

    // 监听对话 advance/choice 事件（通过键盘 E 键触发）
    _eventBus.on('dialogue:advance', () => {
      this.dialogueSystem.advance();
    });
    _eventBus.on('dialogue:choice', (index: number) => {
      this.dialogueSystem.choose(index);
    });

    _eventBus.emit('ui:refresh');
  }

  update(time: number, delta: number): void {
    const state = this.sceneManager.getState();

    // 对话状态下处理交互键
    if (state === SceneState.Dialogue) {
      if (this.inputController.isInteractPressed()) {
        this.dialogueSystem.advance();
      }
      // 对话中不更新游戏逻辑
      return;
    }

    // 过渡状态：锁定玩家移动
    if (this.sceneManager.isPlayerLocked()) {
      return;
    }

    // 正常更新
    this.entitySystem.update(time, delta);

    const px = this.entitySystem.player.mapX;
    const py = this.entitySystem.player.mapY;

    if (this.mapRenderer.shouldRerender(px, py)) {
      this.mapRenderer.renderBuffer(px, py);
    }
    this.mapRenderer.blitToScreen(px, py);

    // 小地图更新
    this.minimapSystem.update(time, px, py, this.entitySystem.agents);

    // 建筑标记位置更新（仅世界地图）
    if (state === SceneState.WorldMap) {
      updateBuildingMarkers(this.buildingMarkers, px, py);
    }

    // 场景管理更新（检测建筑进出）
    this.sceneManager.update(time, delta, this.entitySystem.player);

    // NPC 交互检测（E 键）
    if (this.inputController.isInteractPressed()) {
      const npc = this.entitySystem.getNearbyNPC(px, py, NPC_INTERACT_DIST);
      if (npc) {
        this.sceneManager.startDialogue();
        this.dialogueSystem.startDialogue(npc.dialogueId);
      }
    }

    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      const sceneLabel = state === SceneState.Indoor ? ' [室内]' : '';
      let exitInfo = '';
      if (state === SceneState.Indoor && this.sceneManager.isIndoor()) {
        const building = BUILDINGS.find(b => true); // get current building
        if (building) {
          const dx = px - building.exitX;
          const dy = py - building.exitY;
          exitInfo = ` 出口距离:${Math.sqrt(dx*dx+dy*dy).toFixed(1)}`;
        }
      }
      debugEl.textContent = `x:${px.toFixed(1)} y:${py.toFixed(1)}${sceneLabel}${exitInfo}`;
    }
  }
}
