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
import { setBuildingMarkersVisible, updateBuildingMarkers } from './BuildingMarkers';

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

  // 退出建筑后的重入保护（玩家必须先离开入口区域才能再次进入）
  private reentryBlocked = false;
  // 启动保护：前 2 秒不检测建筑入口，防止出生在建筑位置立刻进入
  private startupBlocked = true;
  private lastBirthHouseExitHintAt = 0;

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

    // 启动保护：2 秒后允许检测建筑入口
    scene.time.delayedCall(2000, () => { this.startupBlocked = false; });
  }

  /** 初始进入建筑：屏幕已黑，直接切换到室内再淡入 */
  startInstant(buildingId: string): void {
    // 遮罩设为全黑
    this.fadeOverlay.setAlpha(1);
    this.forceEnterBuildingInstant(buildingId);
  }

  /** 恢复到上次退出前所在的世界地图坐标 */
  restoreWorldAt(x: number, y: number): void {
    const player = this.entitySystem.getPlayer();
    this.state = SceneState.WorldMap;
    this.currentBuildingId = null;
    this.savedPlayerX = x;
    this.savedPlayerY = y;
    this.fadeOverlay.setAlpha(0);

    player.setMapPosition(x, y);
    player.setIndoorMode(false, 0, 0);
    if (this.savedWorldMap) {
      player.switchMapData(this.savedWorldMap);
    }
    if (this.savedWorldMap && this.worldTileMeta) {
      this.mapRenderer.renderBuffer(x, y);
      this.mapRenderer.blitToScreen(x, y);
    }

    this.entitySystem.clearNPCs();
    this.entitySystem.clearStrategyNPCs();
    this.entitySystem.setWorldAgentsVisible(false);
    this.worldAgentsVisible = false;
    this.entitySystem.syncEntityScreenPositions(x, y);
    this.minimapSystem.setVisible(true);
    updateBuildingMarkers(this.buildingMarkers, x, y);
    setBuildingMarkersVisible(this.buildingMarkers, true);
    this.reentryBlocked = true;

    this.store.saveWorldPlayerLocation(x, y);
    this.eventBus.emit('scene:state-changed', { state: SceneState.WorldMap });
  }

  /** 恢复到上次退出前所在的室内坐标 */
  restoreIndoorAt(buildingId: string, x: number, y: number, worldX?: number, worldY?: number): boolean {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return false;

    this.fadeOverlay.setAlpha(1);
    this.state = SceneState.TransitionOut;
    this.currentBuildingId = building.id;
    this.savedPlayerX = Number.isFinite(worldX) ? worldX! : building.returnX;
    this.savedPlayerY = Number.isFinite(worldY) ? worldY! : building.returnY;
    this.onEnterMidpoint(building, false, { x, y });
    return true;
  }

  /** 保存世界地图引用，在 init 之后调用一次 */
  saveWorldContext(mapData: MapData, tileMeta: TileMeta): void {
    this.savedWorldMap = mapData;
    this.worldTileMeta = tileMeta;
  }

  getState(): SceneState {
    return this.state;
  }

  getCurrentBuildingId(): string | null {
    return this.currentBuildingId;
  }

  getSavedWorldPosition(): { x: number; y: number } {
    return { x: this.savedPlayerX, y: this.savedPlayerY };
  }

  isIndoor(): boolean {
    return this.state === SceneState.Indoor;
  }

  isPlayerLocked(): boolean {
    return this.state === SceneState.TransitionOut
      || this.state === SceneState.TransitionIn
      || this.state === SceneState.Dialogue
      || this.state === SceneState.Battle;
  }

  /** 每帧更新 */
  update(time: number, delta: number, player: Player): void {
    if (this.state === SceneState.WorldMap) {
      if (this.reentryBlocked) {
        // 玩家离开所有入口区域后解除重入保护
        let nearAny = false;
        for (const b of BUILDINGS) {
          const dx = player.mapX - b.entryX;
          const dy = player.mapY - b.entryY;
          if (Math.sqrt(dx * dx + dy * dy) <= b.entryRadius + 1) {
            nearAny = true;
            break;
          }
        }
        if (!nearAny) this.reentryBlocked = false;
      }
      if (!this.reentryBlocked && !this.startupBlocked) {
        this.checkBuildingEntry(player);
      }
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
      if (building.id === 'birth_house' && !this.store.storyFlags['story.observer_awake']) {
        const now = this.scene.time.now;
        if (now - this.lastBirthHouseExitHintAt > 1800) {
          this.entitySystem.showBubble('player', '门外雾气很重。我连这里是哪都不知道，还是先问问屋里那个人。');
          this.lastBirthHouseExitHintAt = now;
        }
        return;
      }
      this.exitBuilding(building);
    }
  }

  /** 进入建筑 */
  private enterBuilding(building: typeof BUILDINGS[0]): void {
    if (this.state !== SceneState.WorldMap) return;
    this.doEnterBuilding(building);
  }

  /** 强制进入建筑（跳过状态检查，用于新手教程等） */
  forceEnterBuilding(buildingId: string): void {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (building) this.doEnterBuilding(building);
  }

  /** 初始直接进入建筑（无淡出，屏幕已黑，仅淡入） */
  forceEnterBuildingInstant(buildingId: string): void {
    const building = BUILDINGS.find(b => b.id === buildingId);
    if (!building) return;

    // 直接跳到切换室内场景逻辑
    this.state = SceneState.TransitionOut;
    this.currentBuildingId = building.id;

    const player = this.entitySystem.getPlayer();
    this.savedPlayerX = player.mapX;
    this.savedPlayerY = player.mapY;

    // 跳过淡出，直接进入室内（初始出生 → 房间中心）
    this.onEnterMidpoint(building, false);
  }

  /** 进入建筑的实际逻辑 */
  private doEnterBuilding(building: typeof BUILDINGS[0]): void {

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
        this.onEnterMidpoint(building, true);
      },
    });
  }

  /** 进入建筑 — 中间点（切换地图）
   *  @param fromOutside true=从外部重新进入(门口出生), false=初始出生(中心)
   */
  private onEnterMidpoint(
    building: typeof BUILDINGS[0],
    fromOutside: boolean,
    spawnOverride?: { x: number; y: number },
  ): void {
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
    if (spawnOverride) {
      player.setMapPosition(spawnOverride.x, spawnOverride.y);
    } else if (fromOutside) {
      // 从外部重新进入 → 门口出生点
      const dx = building.doorSpawnX ?? building.exitX;
      const dy = building.doorSpawnY ?? building.exitY - 3;
      player.setMapPosition(dx, dy);
    } else {
      // 初始出生 → 房间中心
      player.setMapPosition(building.spawnX, building.spawnY);
    }
    player.switchMapData(indoorMap);
    player.setIndoorMode(true, indoorMap.cx, indoorMap.cy, building.id);

    this.mapRenderer.ensureIndoorAssets(indoorMap).then(() => {
      // 切换地图渲染
      this.mapRenderer.switchToIndoor(indoorMap, building.id);

      // 隐藏世界 Agent
      this.entitySystem.setWorldAgentsVisible(false);
      this.worldAgentsVisible = false;

      // 将玩家容器加入室内容器，使其与墙壁正确深度排序
      this.mapRenderer.addIndoorChild(player.container);

      // 创建室内 NPC（设置室内模式）
      this.entitySystem.createNPCs(building.id, indoorMap.cx, indoorMap.cy);
      this.entitySystem.createStrategyNPCs(building.id, this.store.strategies, indoorMap.cx, indoorMap.cy);
      this.entitySystem.setStrategyNpcsVisible(false);

      // 将 NPC 容器加入室内容器，使其跟随房间滚动
      for (const npc of this.entitySystem.npcs.values()) {
        this.mapRenderer.addIndoorChild(npc.container);
      }
      for (const npc of this.entitySystem.strategyNpcs.values()) {
        this.mapRenderer.addIndoorChild(npc.container);
      }

      // 立即对齐所有实体的屏幕位置（避免过渡结束后闪现）
      const px = player.mapX;
      const py = player.mapY;
      this.entitySystem.syncEntityScreenPositions(px, py);
      this.entitySystem.setStrategyNpcsVisible(true);

      // 立即更新室内容器位置，防止首帧显示在中心再闪到门口
      this.mapRenderer.updateIndoorCamera(px, py);

      // 立即应用室内视觉状态（sprite.y、depth、朝向帧），防止淡入期间显示世界模式外观
      player.applyIndoorVisual(this.scene.time.now);

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
          this.store.saveIndoorPlayerLocation(
            building.id,
            player.mapX,
            player.mapY,
            this.savedPlayerX,
            this.savedPlayerY,
          );
        },
      });

      this.eventBus.emit('scene:state-changed', { state: SceneState.Indoor, buildingId: building.id });
    }).catch((error) => {
      console.error('Failed to load indoor assets:', error);
      this.state = SceneState.WorldMap;
      this.currentBuildingId = null;
      this.fadeOverlay.setAlpha(0);
    });
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
    this.entitySystem.clearStrategyNPCs();

    // 恢复到进入前的位置（不是硬编码 returnX/Y）
    const rx = this.savedPlayerX;
    const ry = this.savedPlayerY;

    const player = this.entitySystem.getPlayer();
    player.setMapPosition(rx, ry);
    player.setIndoorMode(false, 0, 0);

    // 恢复世界地图数据（碰撞检测用）
    if (this.savedWorldMap) {
      player.switchMapData(this.savedWorldMap);
    }

    // 恢复世界地图渲染
    if (this.savedWorldMap && this.worldTileMeta) {
      this.mapRenderer.switchToWorld(this.savedWorldMap, this.worldTileMeta);
      this.mapRenderer.renderBuffer(rx, ry);
      this.mapRenderer.blitToScreen(rx, ry);
    }

    // 恢复世界 Agent
    this.entitySystem.setWorldAgentsVisible(false);
    this.worldAgentsVisible = false;

    // 立即同步所有实体的屏幕位置
    this.entitySystem.syncEntityScreenPositions(rx, ry);

    // 先把建筑标记同步到世界坐标，再显示；否则首次从小屋回大地图时会等到 WorldMap 状态下一帧才出现。
    updateBuildingMarkers(this.buildingMarkers, rx, ry);

    // 显示小地图和建筑标记
    this.minimapSystem.setVisible(true);
    setBuildingMarkersVisible(this.buildingMarkers, true);

    this.currentBuildingId = null;

    // 启用重入保护
    this.reentryBlocked = true;

    // 淡入
    this.state = SceneState.TransitionIn;
    this.scene.tweens.add({
      targets: this.fadeOverlay,
      alpha: { from: 1, to: 0 },
      duration: TRANSITION_FADE_MS,
      onComplete: () => {
        this.state = SceneState.WorldMap;
        this.store.saveWorldPlayerLocation(rx, ry);
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

  /** 进入战斗模式 */
  startBattle(): void {
    this.prevSceneState = this.state;
    this.state = SceneState.Battle;

    // 隐藏世界元素
    this.entitySystem.setWorldAgentsVisible(false);
    this.entitySystem.getPlayer().container.setVisible(false);
    this.entitySystem.npcs.forEach(npc => npc.container.setVisible(false));
    this.entitySystem.strategyNpcs.forEach(npc => npc.container.setVisible(false));
    this.mapRenderer.scrImage.setVisible(false);
    this.minimapSystem.setVisible(false);
    setBuildingMarkersVisible(this.buildingMarkers, false);

    this.eventBus.emit('scene:state-changed', { state: SceneState.Battle });
  }

  /** 结束战斗模式 */
  endBattle(): void {
    // 恢复世界元素
    this.entitySystem.setWorldAgentsVisible(false);
    this.entitySystem.getPlayer().container.setVisible(true);
    const returningToWorld = this.prevSceneState === SceneState.WorldMap;
    const returningToIndoor = this.prevSceneState === SceneState.Indoor;
    this.entitySystem.npcs.forEach(npc => npc.container.setVisible(returningToIndoor));
    this.entitySystem.strategyNpcs.forEach(npc => npc.container.setVisible(returningToIndoor));
    this.mapRenderer.scrImage.setVisible(returningToWorld);
    this.minimapSystem.setVisible(returningToWorld);
    setBuildingMarkersVisible(this.buildingMarkers, returningToWorld);

    this.state = this.prevSceneState;
    this.eventBus.emit('scene:state-changed', { state: this.state });
  }
}
