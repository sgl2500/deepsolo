// ============================================================
// SceneManager.ts — 场景状态机（世界地图 ↔ 室内场景）
// ============================================================

import { SceneState, type MapData, type TileMeta } from '../types';
import { TRANSITION_FADE_MS } from '../config';
import { BUILDINGS } from '../data/BuildingData';
import type { MapRenderer } from './MapRenderer';
import type { EntitySystem } from './EntitySystem';
import type { InputController } from './InputController';
import type { Player } from '../entities/Player';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import type { DialogueSystem } from './DialogueSystem';
import type { MinimapSystem } from './MinimapSystem';
import { setBuildingMarkersVisible } from './BuildingMarkers';

export class SceneManager {
  private state: SceneState = SceneState.WorldMap;
  private prevSceneState: SceneState = SceneState.WorldMap;
  private currentBuildingId: string | null = null;

  private scene: Phaser.Scene;
  private mapRenderer: MapRenderer;
  private entitySystem: EntitySystem;
  private inputController: InputController;
  private dialogueSystem: DialogueSystem;
  private minimapSystem: MinimapSystem;
  private buildingMarkers: Phaser.GameObjects.Container[];
  private eventBus: EventBus;
  private store: GameStore;

  // 淡入淡出遮罩
  private fadeOverlay: Phaser.GameObjects.Rectangle;

  // 保存的世界地图状态
  private savedWorldMap: MapData | null = null;
  private savedPlayerX = 0;
  private savedPlayerY = 0;
  private worldTileMeta: TileMeta | null = null;

  // 世界 Agent 可见性
  private worldAgentsVisible = true;

  constructor(
    scene: Phaser.Scene,
    mapRenderer: MapRenderer,
    entitySystem: EntitySystem,
    inputController: InputController,
    dialogueSystem: DialogueSystem,
    minimapSystem: MinimapSystem,
    buildingMarkers: Phaser.GameObjects.Container[],
    eventBus: EventBus,
    store: GameStore,
  ) {
    this.scene = scene;
    this.mapRenderer = mapRenderer;
    this.entitySystem = entitySystem;
    this.inputController = inputController;
    this.dialogueSystem = dialogueSystem;
    this.minimapSystem = minimapSystem;
    this.buildingMarkers = buildingMarkers;
    this.eventBus = eventBus;
    this.store = store;

    // 创建全屏黑色遮罩（用于淡入淡出）
    this.fadeOverlay = scene.add.rectangle(
      640, 360, 1280, 720, 0x000000,
    ).setOrigin(0.5).setDepth(10000).setAlpha(0).setScrollFactor(0);
  }

  /** 保存世界地图引用，在 init 之后调用一次 */
  saveWorldContext(mapData: MapData, tileMeta: TileMeta): void {
    this.savedWorldMap = mapData;
    this.worldTileMeta = tileMeta;
  }

  getState(): SceneState {
    return this.state;
  }

  isIndoor(): boolean {
    return this.state === SceneState.Indoor;
  }

  isPlayerLocked(): boolean {
    return this.state === SceneState.TransitionOut
      || this.state === SceneState.TransitionIn
      || this.state === SceneState.Dialogue;
  }

  /** 每帧更新 */
  update(time: number, delta: number, player: Player): void {
    if (this.state === SceneState.WorldMap) {
      this.checkBuildingEntry(player);
    } else if (this.state === SceneState.Indoor) {
      this.checkExit(player);
    }
  }

  /** 检测玩家是否走到建筑入口 */
  private checkBuildingEntry(player: Player): void {
    for (const b of BUILDINGS) {
      const dx = player.mapX - b.entryX;
      const dy = player.mapY - b.entryY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= b.entryRadius) {
        this.enterBuilding(b);
        return;
      }
    }
  }

  /** 检测玩家是否走到室内出口 */
  private checkExit(player: Player): void {
    if (!this.currentBuildingId) return;
    const building = BUILDINGS.find(b => b.id === this.currentBuildingId);
    if (!building) return;

    const dx = player.mapX - building.exitX;
    const dy = player.mapY - building.exitY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 2.0) {
      this.exitBuilding(building);
    }
  }

  /** 进入建筑 */
  private enterBuilding(building: typeof BUILDINGS[0]): void {
    if (this.state !== SceneState.WorldMap) return;

    this.state = SceneState.TransitionOut;
    this.currentBuildingId = building.id;

    // 保存玩家世界位置
    const player = this.entitySystem.getPlayer();
    this.savedPlayerX = player.mapX;
    this.savedPlayerY = player.mapY;

    // 淡出
    this.scene.tweens.add({
      targets: this.fadeOverlay,
      alpha: { from: 0, to: 1 },
      duration: TRANSITION_FADE_MS,
      onComplete: () => {
        this.onEnterMidpoint(building);
      },
    });
  }

  /** 进入建筑 — 中间点（切换地图） */
  private onEnterMidpoint(building: typeof BUILDINGS[0]): void {
    // 加载室内地图
    const indoorMap = this.scene.cache.json.get(building.indoorMapKey);
    if (!indoorMap) {
      console.error('Indoor map not found:', building.indoorMapKey);
      this.state = SceneState.WorldMap;
      this.currentBuildingId = null;
      this.fadeOverlay.setAlpha(0);
      return;
    }

    // 移动玩家到室内出生点（必须在切地图之前，确保渲染中心正确）
    const player = this.entitySystem.getPlayer();
    player.setMapPosition(building.spawnX, building.spawnY);

    // 切换地图渲染，以玩家位置为中心渲染
    this.mapRenderer.switchToIndoor(indoorMap, building.spawnX, building.spawnY);

    // 隐藏世界 Agent
    this.entitySystem.setWorldAgentsVisible(false);
    this.worldAgentsVisible = false;

    // 创建室内 NPC
    this.entitySystem.createNPCs(building.id);

    // 立即对齐所有实体的屏幕位置（避免过渡结束后闪现）
    const px = player.mapX;
    const py = player.mapY;
    this.entitySystem.syncEntityScreenPositions(px, py);

    // 隐藏小地图和建筑标记
    this.minimapSystem.setVisible(false);
    setBuildingMarkersVisible(this.buildingMarkers, false);

    // 淡入
    this.state = SceneState.TransitionIn;
    this.scene.tweens.add({
      targets: this.fadeOverlay,
      alpha: { from: 1, to: 0 },
      duration: TRANSITION_FADE_MS,
      onComplete: () => {
        this.state = SceneState.Indoor;
      },
    });

    this.eventBus.emit('scene:state-changed', { state: SceneState.Indoor, buildingId: building.id });
  }

  /** 退出建筑 */
  private exitBuilding(building: typeof BUILDINGS[0]): void {
    if (this.state !== SceneState.Indoor) return;

    this.state = SceneState.TransitionOut;

    this.scene.tweens.add({
      targets: this.fadeOverlay,
      alpha: { from: 0, to: 1 },
      duration: TRANSITION_FADE_MS,
      onComplete: () => {
        this.onExitMidpoint(building);
      },
    });
  }

  /** 退出建筑 — 中间点 */
  private onExitMidpoint(building: typeof BUILDINGS[0]): void {
    // 清除室内 NPC
    this.entitySystem.clearNPCs();

    // 恢复玩家位置（必须在切地图之前）
    const player = this.entitySystem.getPlayer();
    player.setMapPosition(building.returnX, building.returnY);

    // 恢复世界地图渲染
    if (this.savedWorldMap && this.worldTileMeta) {
      this.mapRenderer.switchToWorld(this.savedWorldMap, this.worldTileMeta);
      // 以玩家位置为中心重新渲染世界地图
      this.mapRenderer.renderBuffer(building.returnX, building.returnY);
      this.mapRenderer.blitToScreen(building.returnX, building.returnY);
    }

    // 恢复世界 Agent
    this.entitySystem.setWorldAgentsVisible(true);
    this.worldAgentsVisible = true;

    // 立即同步所有实体的屏幕位置
    this.entitySystem.syncEntityScreenPositions(building.returnX, building.returnY);

    // 显示小地图和建筑标记
    this.minimapSystem.setVisible(true);
    setBuildingMarkersVisible(this.buildingMarkers, true);

    this.currentBuildingId = null;

    // 淡入
    this.state = SceneState.TransitionIn;
    this.scene.tweens.add({
      targets: this.fadeOverlay,
      alpha: { from: 1, to: 0 },
      duration: TRANSITION_FADE_MS,
      onComplete: () => {
        this.state = SceneState.WorldMap;
      },
    });

    this.eventBus.emit('scene:state-changed', { state: SceneState.WorldMap });
  }

  /** 进入对话模式 */
  startDialogue(): void {
    this.prevSceneState = this.state;
    this.state = SceneState.Dialogue;
  }

  /** 结束对话模式 */
  endDialogue(): void {
    this.state = this.prevSceneState;
  }
}
