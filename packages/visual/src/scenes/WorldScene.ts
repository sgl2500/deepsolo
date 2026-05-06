// ============================================================
// WorldScene.ts — 主游戏场景（协调者）
// ============================================================

import Phaser from 'phaser';
import { SCREEN_WIDTH, SCREEN_HEIGHT, NPC_INTERACT_DIST } from '../config';
import { SceneState, type MapData, type TileMeta, type CharMeta, type Strategy } from '../types';
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
import { VFXSystem } from '../systems/VFXSystem';
import { BattleSystem } from '../systems/BattleSystem';
import { StorySystem } from '../systems/StorySystem';
import { WorldMapEditor } from '../systems/WorldMapEditor';
import { BUILDINGS } from '../data/BuildingData';
import { getNearbyIndoorInteractable } from '../content/IndoorInteractables';
import { createBuildingMarkers, updateBuildingMarkers } from '../systems/BuildingMarkers';
import { PlayerAppearanceOverlay } from '../ui/PlayerAppearanceOverlay';
import { setSelectedPlayerAppearance } from '../systems/player/PlayerAppearanceStore';
import type { IndoorInteractableDef } from '../types';
import type { ChatService, ChatMessage } from '../services/ChatService';

let _eventBus: EventBus;
let _store: GameStore;
let _chatService: ChatService | null = null;

export function setWorldContext(eventBus: EventBus, store: GameStore): void {
  _eventBus = eventBus;
  _store = store;
}

export function setChatService(service: ChatService): void {
  _chatService = service;
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
  private vfxSystem!: VFXSystem;
  private battleSystem!: BattleSystem;
  private storySystem!: StorySystem;
  private worldMapEditor!: WorldMapEditor;
  private playerAppearanceOverlay!: PlayerAppearanceOverlay;
  private buildingMarkers!: Phaser.GameObjects.Container[];

  private mapData!: MapData;
  private tileMeta!: TileMeta;
  private charMeta!: CharMeta;

  /** 当前处于对话/聊天状态 */
  private convOpen = false;
  /** 当前对话 ID */
  private currentConvId: string | null = null;
  /** Agent 聊天相关 */
  private chatAgentId: string | null = null;
  /** 室内交互提示 */
  private interactHintText: Phaser.GameObjects.Text | null = null;

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
    this.entitySystem.setWorldAgentsVisible(false);
    this.interactHintText = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 84, '', {
      fontSize: '14px',
      color: '#fef3c7',
      backgroundColor: 'rgba(15,23,42,0.82)',
      padding: { x: 10, y: 6 },
      fontFamily: 'PingFang SC, Microsoft YaHei, monospace',
    }).setOrigin(0.5).setDepth(20000).setScrollFactor(0).setVisible(false);

    this.minimapSystem = new MinimapSystem(this.mapData);

    this.discussionSystem = new DiscussionSystem(
      this, this.entitySystem, _store, _eventBus,
    );

    this.dayCycleSystem = new DayCycleSystem(
      this, _store, this.entitySystem, _eventBus, this.discussionSystem,
    );

    this.dialogueSystem = new DialogueSystem(this, _eventBus);

    // VFX 特效系统
    this.vfxSystem = new VFXSystem(this);

    // 战斗系统
    this.battleSystem = new BattleSystem(this, _eventBus, _store);

    // 剧情系统
    this.storySystem = new StorySystem(this, _eventBus, _store);

    // 建筑入口标记（必须在 SceneManager 之前创建）
    this.buildingMarkers = createBuildingMarkers(this, this.mapData);

    // 大地图入口/碰撞/新增建筑编辑器。
    this.worldMapEditor = new WorldMapEditor(this, this.buildingMarkers);
    this.playerAppearanceOverlay = new PlayerAppearanceOverlay({
      onSelectAppearance: (id) => {
        const appearance = setSelectedPlayerAppearance(id);
        this.entitySystem.showBubble('player', `已换装：${appearance.name}`);
      },
      onExit: () => this.playerAppearanceOverlay.setActive(false),
    });

    this.sceneManager = new SceneManager(
      this, this.mapRenderer, this.entitySystem,
      this.inputController, this.dialogueSystem,
      this.minimapSystem, this.buildingMarkers, _eventBus, _store,
    );
    this.sceneManager.saveWorldContext(this.mapData, this.tileMeta);

    // ── 初始进入出生小屋（屏幕直接黑屏，无过渡） ──
    this.sceneManager.startInstant('birth_house');

    this.input.keyboard!.on('keydown-F2', () => {
      this.mapRenderer.toggleFurnitureEditor();
    });
    this.input.keyboard!.on('keydown-M', () => {
      this.mapRenderer.toggleFurnitureMaskEditor();
    });
    this.input.keyboard!.on('keydown-BACKSPACE', (event: KeyboardEvent) => {
      event.preventDefault();
      this.mapRenderer.deleteSelectedIndoorEditorItem();
    });
    this.input.keyboard!.on('keydown-DELETE', (event: KeyboardEvent) => {
      if (this.worldMapEditor?.isActive()) {
        event.preventDefault();
        if (event.shiftKey) this.worldMapEditor.deleteSelectedAutomatedBuilding();
        else this.worldMapEditor.clearSelectedCollision();
        return;
      }
      this.mapRenderer.deleteSelectedIndoorEditorItem();
    });
    this.input.keyboard!.on('keydown-C', (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
        event.preventDefault();
        this.mapRenderer.exportIndoorCharacterEditorLayout();
        return;
      }
      this.mapRenderer.clearFurnitureMask();
    });
    this.input.keyboard!.on('keydown-S', (event: KeyboardEvent) => {
      if (!this.mapRenderer.isFurnitureEditorActive() || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      if (event.shiftKey) this.mapRenderer.exportIndoorSceneSnapshot();
      else this.mapRenderer.saveIndoorSceneToSource();
    });
    this.input.keyboard!.on('keydown-Z', (event: KeyboardEvent) => {
      if (!this.mapRenderer.isFurnitureEditorActive() || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      if (event.shiftKey) {
        this.mapRenderer.redoIndoorEditorChange();
      } else {
        this.mapRenderer.undoIndoorEditorChange();
      }
    });
    this.input.keyboard!.on('keydown-Y', (event: KeyboardEvent) => {
      if (!this.mapRenderer.isFurnitureEditorActive() || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      this.mapRenderer.redoIndoorEditorChange();
    });
    this.input.keyboard!.on('keydown-D', (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey) return;
      event.preventDefault();
      this.mapRenderer.duplicateSelectedIndoorEditorItem();
    });
    this.input.keyboard!.on('keydown-Q', (_event: KeyboardEvent) => {
      if (_event.shiftKey) {
        this.mapRenderer.rotateSelectedFurniture(-1);
      } else {
        this.mapRenderer.rotateSelectedFurniture(-15);
      }
    });
    this.input.keyboard!.on('keydown-E', (_event: KeyboardEvent) => {
      if (_event.shiftKey) {
        this.mapRenderer.rotateSelectedFurniture(1);
      } else {
        this.mapRenderer.rotateSelectedFurniture(15);
      }
    });
    this.input.keyboard!.on('keydown-LEFT', (event: KeyboardEvent) => {
      if (event.shiftKey && this.mapRenderer.isFurnitureEditorActive()) {
        event.preventDefault();
        this.mapRenderer.nudgeSelectedFurnitureOrigin(-0.05, 0);
        return;
      }
      if (this.mapRenderer.nudgeSelectedIndoorEditorItem(event.altKey ? -1 : -0.1, 0)) event.preventDefault();
    });
    this.input.keyboard!.on('keydown-RIGHT', (event: KeyboardEvent) => {
      if (event.shiftKey && this.mapRenderer.isFurnitureEditorActive()) {
        event.preventDefault();
        this.mapRenderer.nudgeSelectedFurnitureOrigin(0.05, 0);
        return;
      }
      if (this.mapRenderer.nudgeSelectedIndoorEditorItem(event.altKey ? 1 : 0.1, 0)) event.preventDefault();
    });
    this.input.keyboard!.on('keydown-UP', (event: KeyboardEvent) => {
      if (event.shiftKey && this.mapRenderer.isFurnitureEditorActive()) {
        event.preventDefault();
        this.mapRenderer.nudgeSelectedFurnitureOrigin(0, -0.05);
        return;
      }
      if (this.mapRenderer.nudgeSelectedIndoorEditorItem(0, event.altKey ? -1 : -0.1)) event.preventDefault();
    });
    this.input.keyboard!.on('keydown-DOWN', (event: KeyboardEvent) => {
      if (event.shiftKey && this.mapRenderer.isFurnitureEditorActive()) {
        event.preventDefault();
        this.mapRenderer.nudgeSelectedFurnitureOrigin(0, 0.05);
        return;
      }
      if (this.mapRenderer.nudgeSelectedIndoorEditorItem(0, event.altKey ? 1 : 0.1)) event.preventDefault();
    });
    this.input.keyboard!.on('keydown-R', () => {
      if (this.worldMapEditor?.isActive()) {
        this.worldMapEditor.resetSavedLayout();
        return;
      }
      this.mapRenderer.resetFurnitureEditorSavedLayout();
    });
    this.input.keyboard!.on('keydown-H', () => {
      if (this.worldMapEditor?.isActive()) {
        this.worldMapEditor.toggleGuide();
        return;
      }
      this.mapRenderer.toggleFurnitureEditorGuide();
    });
    this.input.keyboard!.on('keydown-F3', () => {
      if (this.sceneManager?.isIndoor()) return;
      this.worldMapEditor.toggle();
    });
    this.input.keyboard!.on('keydown-F4', () => {
      this.playerAppearanceOverlay.toggle();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.playerAppearanceOverlay.isActive()) {
        this.playerAppearanceOverlay.setActive(false);
      }
    });
    this.input.keyboard!.on('keydown-OPEN_BRACKET', () => {
      this.worldMapEditor.adjustEntryRadius(-0.5);
    });
    this.input.keyboard!.on('keydown-CLOSED_BRACKET', () => {
      this.worldMapEditor.adjustEntryRadius(0.5);
    });
    this.input.keyboard!.on('keydown-MINUS', () => {
      this.worldMapEditor.adjustCollisionRadius(-0.5);
    });
    this.input.keyboard!.on('keydown-PLUS', () => {
      this.worldMapEditor.adjustCollisionRadius(0.5);
    });
    this.input.keyboard!.on('keydown-EQUALS', () => {
      this.worldMapEditor.adjustCollisionRadius(0.5);
    });

    // ── 统一对话事件 ──

    // conv:open → 进入对话状态
    _eventBus.on('conv:open', (conv) => {
      this.convOpen = true;
      this.currentConvId = conv.id;
      // 仅在未被锁定时调用 startDialogue（避免多次调用覆写 prevSceneState）
      if (!this.sceneManager.isPlayerLocked()) {
        this.sceneManager.startDialogue();
      }
    });

    // conv:close → 退出对话状态
    _eventBus.on('conv:close', () => {
      this.convOpen = false;
      this.currentConvId = null;
      this.chatAgentId = null;
      // 强制清理 DialogueSystem（不发事件，避免递归）
      if (this.dialogueSystem.isActive()) {
        this.dialogueSystem.forceEnd();
      }
      // 强制清理 StorySystem
      if (this.storySystem.isActive()) {
        this.storySystem.forceEnd();
      }
      this.sceneManager.endDialogue();
    });

    // conv:choice → 转发给 DialogueSystem（NPC 对话时）
    // 已在 DialogueSystem 构造函数中订阅

    // conv:send → 用户输入文字（Agent 聊天 / Token 弹窗）
    _eventBus.on('conv:send', (text: string) => {
      if (this.chatAgentId) {
        // Agent 聊天：发送到后端
        _eventBus.emit('conv:message', {
          id: 'user_' + Date.now(),
          role: 'user' as const,
          text,
        });
        _chatService?.send(this.chatAgentId, text);
      }
      // Token 弹窗的处理在 TokenCenterUI 中
    });

    // ChatService 回复 → 追加到 Conversation
    if (_chatService) {
      _chatService.onReply((data: { type: string; agent_id: string; text: string; messages?: ChatMessage[] }) => {
        if (data.type === 'history' && data.messages && this.chatAgentId) {
          if (data.messages.length === 0) {
            _eventBus.emit('conv:message', {
              id: 'sys_start',
              role: 'system',
              text: `与「${_store.getStrategy(this.chatAgentId!)?.name || ''}」开始对话`,
            });
          } else {
            data.messages.forEach(m => {
              _eventBus.emit('conv:message', {
                id: 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                text: m.text,
              });
            });
          }
          return;
        }
        if (data.type === 'reply' && data.agent_id === this.chatAgentId) {
          _eventBus.emit('conv:message', {
            id: 'asst_' + Date.now(),
            role: 'assistant' as const,
            text: data.text,
          });
        }
        if (data.type === 'error') {
          _eventBus.emit('conv:message', {
            id: 'err_' + Date.now(),
            role: 'system' as const,
            text: data.text,
          });
        }
      });
    }

    // 监听新策略（衍生 NPC 动态添加）
    _eventBus.on('strategy:loaded', (strategies: Strategy[]) => {
      for (const s of strategies) {
        if (!this.entitySystem.agents.has(s.id)) {
          this.entitySystem.addAgent(this.charMeta, s);
        }
      }
      this.entitySystem.setWorldAgentsVisible(false);
    });

    // ── 天道消灭特效 ──
    _eventBus.on('agent:eliminated', (data: { id: string; name: string; reason: string; detail: string }) => {
      const agent = this.entitySystem.agents.get(data.id);
      if (!agent) {
        this.entitySystem.showBubble('player', `${data.name} 被天道消灭!`);
        _store.addEvent(data.name, `被天道消灭: ${data.detail}`);
        _eventBus.emit('ui:refresh');
        return;
      }

      const screenX = agent.container.x;
      const screenY = agent.container.y;

      this.entitySystem.showBubble(data.id, '天道降罚...');

      this.vfxSystem.playHeavenStrike(screenX, screenY, () => {
        this.tweens.add({
          targets: agent.container,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => {
            this.entitySystem.removeAgent(data.id);
          },
        });
      });

      _store.addEvent(data.name, `被天道消灭: ${data.detail}`);
      _eventBus.emit('ui:refresh');
    });

    // ── 策略诞生特效 ──
    _eventBus.on('agent:born', (data: { id: string; name: string; parents?: string[]; detail: string }) => {
      const agent = this.entitySystem.agents.get(data.id);
      if (!agent) {
        const strategy = _store.strategies.find(s => s.id === data.id);
        if (strategy) {
          this.entitySystem.addAgent(this.charMeta, strategy);
          const newAgent = this.entitySystem.agents.get(data.id);
          if (newAgent) {
            this.playBirthForAgent(newAgent, data.name);
          }
        }
      } else {
        this.playBirthForAgent(agent, data.name);
      }

      _store.addEvent(data.name, `新策略诞生! ${data.detail}`);
      _eventBus.emit('ui:refresh');
    });

    // ── 讨论事件可视化 ──
    _eventBus.on('discussion:event', (data: { agents: string[]; agentNames: string[]; dialogues: Array<{ agent_id: string; text: string }>; complementary: boolean }) => {
      const centerX = 50;
      const centerY = 50;
      data.agents.forEach((agentId, idx) => {
        const agent = this.entitySystem.agents.get(agentId);
        if (agent) {
          const angle = (2 * Math.PI * idx) / data.agents.length;
          agent.enterDiscussion(centerX, centerY, angle);
        }
      });

      data.dialogues.forEach((line, idx) => {
        this.time.delayedCall(3000 * (idx + 1), () => {
          const agent = this.entitySystem.agents.get(line.agent_id);
          if (agent) {
            this.entitySystem.showBubble(line.agent_id, line.text, {
              width: 160,
              height: 40,
              borderColor: data.complementary ? 0xa78bfa : 0x60a5fa,
              borderAlpha: 0.8,
              borderWidth: 2,
              yOffset: -130,
            });
          }
        });
      });

      this.time.delayedCall(3000 * (data.dialogues.length + 1), () => {
        data.agents.forEach(agentId => {
          const agent = this.entitySystem.agents.get(agentId);
          if (agent) {
            agent.exitDiscussion();
          }
        });
      });

      _store.addEvent(
        data.agentNames.join('、'),
        `策略茶馆碰面${data.complementary ? ' ★ 发现互补!' : ''}`,
      );
      _eventBus.emit('ui:refresh');
    });

    _eventBus.emit('ui:refresh');

    // ── 战斗结束事件 ──
    _eventBus.on('battle:end', () => {
      this.sceneManager.endBattle();
    });
  }

  /** Agent 交互距离（地图格） */
  private static readonly AGENT_INTERACT_DIST = 3.0;

  /** 为新诞生的 Agent 播放涌现特效 */
  private playBirthForAgent(agent: import('../entities/Agent').Agent, name: string): void {
    agent.container.setAlpha(0);
    agent.container.setScale(0);

    const screenX = agent.container.x;
    const screenY = agent.container.y;

    this.vfxSystem.playBirthEffect(screenX, screenY, () => {
      this.tweens.add({
        targets: agent.container,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 500,
        ease: 'Back.easeOut',
      });
      this.entitySystem.showBubble(agent.id, '我诞生了!');
    });
  }

  update(time: number, delta: number): void {
    const state = this.sceneManager.getState();

    if (state !== SceneState.WorldMap && this.worldMapEditor?.isActive()) {
      this.worldMapEditor.setActive(false);
    }

    // ── 战斗状态 ──
    if (state === SceneState.Battle) {
      this.battleSystem.update(time, delta);
      return;
    }

    // 对话/聊天面板打开时：只处理关闭和对话推进
    if (this.convOpen) {
      this.updateInteractHint(null);
      if (this.inputController.isCancelPressed()) {
        _eventBus.emit('conv:close');
      }
      // NPC 对话中：空格推进
      if (this.dialogueSystem.isActive() && this.inputController.isInteractPressed()) {
        this.dialogueSystem.advance();
      }
      // 剧情对话中：空格推进
      if (this.storySystem.isActive() && this.inputController.isInteractPressed()) {
        this.storySystem.advance();
      }
      return;
    }

    // 过渡状态：锁定玩家移动
    if (this.sceneManager.isPlayerLocked()) {
      this.updateInteractHint(null);
      return;
    }

    // B 键：大地图靠近 Agent 后发起玩家挑战
    if (this.inputController.isBattlePressed() && !this.battleSystem.isActive()) {
      if (state === SceneState.Indoor) {
        const challenger = this.entitySystem.getNearbyStrategyNPC(
          this.entitySystem.player.mapX,
          this.entitySystem.player.mapY,
          NPC_INTERACT_DIST + 1.2,
        );
        if (!challenger) {
          this.entitySystem.showBubble('player', '靠近一位门派策略 NPC 后，按 B 发起切磋');
          return;
        }
        this.entitySystem.showBubble(challenger.strategy.id, '来切磋一场？');
        this.sceneManager.startBattle();
        this.battleSystem.startPlayerVsAgent(challenger.strategy.id, challenger.strategy.name);
        return;
      }

      if (state === SceneState.WorldMap) {
        const challenger = this.entitySystem.getNearbyAgent(
          this.entitySystem.player.mapX,
          this.entitySystem.player.mapY,
          NPC_INTERACT_DIST + 1.2,
        );
        if (!challenger) {
          this.entitySystem.showBubble('player', '靠近一位策略观察者后，按 B 发起切磋');
          return;
        }
        this.entitySystem.showBubble(challenger.id, '来切磋一场？');
        this.sceneManager.startBattle();
        this.battleSystem.startPlayerVsAgent(challenger.id, challenger.strategy.name);
        return;
      }
    }

    // 正常更新
    this.entitySystem.update(time, delta);

    const px = this.entitySystem.player.mapX;
    const py = this.entitySystem.player.mapY;

    if (!this.sceneManager.isIndoor()) {
      if (this.mapRenderer.shouldRerender(px, py)) {
        this.mapRenderer.renderBuffer(px, py);
      }
      this.mapRenderer.blitToScreen(px, py);
    } else {
      this.mapRenderer.updateIndoorCamera(px, py);
      this.mapRenderer.updateRoofVisibility(px, py);
    }

    // 小地图更新
    this.minimapSystem.update(time, px, py, this.entitySystem.agents);

    // 建筑标记位置更新（仅世界地图）
    if (state === SceneState.WorldMap) {
      updateBuildingMarkers(this.buildingMarkers, px, py);
      this.worldMapEditor.update(px, py);
    }

    // 场景管理更新（检测建筑进出）
    this.sceneManager.update(time, delta, this.entitySystem.player);

    const buildingId = this.sceneManager.getCurrentBuildingId();
    const nearbyIndoorInteractable = this.sceneManager.isIndoor() && buildingId
      ? getNearbyIndoorInteractable(buildingId, px, py, NPC_INTERACT_DIST)
      : null;
    this.updateInteractHint(nearbyIndoorInteractable);

    // 空格键交互检测
    if (this.inputController.isInteractPressed()) {
      // 室内可交互物件优先于 NPC，对后续场景复用同一套交互入口
      if (nearbyIndoorInteractable) {
        this.executeIndoorInteractable(nearbyIndoorInteractable);
        return;
      }

      // 室内策略 NPC：每个策略在所属门派内固定站位，复用 Agent 聊天上下文。
      const strategyNpc = this.entitySystem.getNearbyStrategyNPC(px, py, WorldScene.AGENT_INTERACT_DIST);
      if (strategyNpc) {
        _store.selectStrategy(strategyNpc.strategy);
        this.openAgentChat(strategyNpc.strategy);
        return;
      }

      // 优先检测室内普通 NPC
      const npc = this.entitySystem.getNearbyNPC(px, py, NPC_INTERACT_DIST);
      if (npc) {
        this.sceneManager.startDialogue();
        this.dialogueSystem.startDialogue(npc.dialogueId);
        return;
      } else {
        // 检测附近的策略 Agent → 打开聊天
        const agent = this.entitySystem.getNearbyAgent(px, py, WorldScene.AGENT_INTERACT_DIST);
        if (agent) {
          _store.selectStrategy(agent.strategy);
          if (agent.inDiscussion) {
            const group = this.discussionSystem.getGroupForAgent(agent.id);
            if (group) {
              _eventBus.emit('discussion:view', group);
            }
          } else {
            // 通过 Conversation 模型打开 Agent 聊天
            this.openAgentChat(agent.strategy);
          }
          return;
        }
      }
    }

    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
      const debugVisible = this.worldMapEditor.isActive() || this.mapRenderer.isFurnitureEditorActive();
      debugEl.style.display = debugVisible ? 'block' : 'none';
      if (!debugVisible) {
        debugEl.textContent = '';
        return;
      }

      const sceneLabel = state === SceneState.Indoor ? ' [室内]' : '';
      let exitInfo = '';
      if (state === SceneState.Indoor && this.sceneManager.isIndoor()) {
        const currentBuildingId = this.sceneManager.getCurrentBuildingId();
        const building = BUILDINGS.find(b => b.id === currentBuildingId);
        if (building) {
          const dx = px - building.exitX;
          const dy = py - building.exitY;
          exitInfo = ` 出口距离:${Math.sqrt(dx*dx+dy*dy).toFixed(1)}`;
        }
      }
      const localInfo = state === SceneState.Indoor
        ? ` local:${(px - 3).toFixed(1)},${(py - 3).toFixed(1)}`
        : '';
      debugEl.textContent = `map:${px.toFixed(1)},${py.toFixed(1)}${localInfo}${sceneLabel}${exitInfo}`;
    }
  }

  private updateInteractHint(interactable: IndoorInteractableDef | null): void {
    if (!this.interactHintText) return;
    if (!interactable) {
      this.interactHintText.setVisible(false);
      return;
    }

    this.interactHintText
      .setText(interactable.prompt ?? `空格：互动 ${interactable.name}`)
      .setVisible(true);
  }

  private executeIndoorInteractable(interactable: IndoorInteractableDef): void {
    const action = interactable.action ?? (
      interactable.dialogueId ? { type: 'dialogue' as const, dialogueId: interactable.dialogueId } : null
    );
    if (!action) return;

    if (action.type === 'dialogue') {
      this.startIndoorDialogue(action.dialogueId);
      return;
    }

    if (action.type === 'discover_manual') {
      const added = _store.addManual(action.manualId);
      if (added) {
        _store.setPlayerFlag(action.onceFlag, true);
        this.entitySystem.showBubble('player', `获得秘籍《${action.manualName}》`);
        this.startIndoorDialogue(action.firstDialogueId);
      } else {
        this.startIndoorDialogue(action.repeatDialogueId);
      }
      return;
    }

    if (action.type === 'rest') {
      _store.restPlayer(action.hpRecover, action.mpRecover);
      this.entitySystem.showBubble('player', action.message);
      this.cameras.main.flash(180, 255, 244, 214, false);
    }
  }

  private startIndoorDialogue(dialogueId: string): void {
    this.sceneManager.startDialogue();
    this.dialogueSystem.startDialogue(dialogueId);
  }

  /** 打开 Agent 聊天 (通过 Conversation) */
  private openAgentChat(strategy: Strategy): void {
    this.chatAgentId = strategy.id;
    this.sceneManager.startDialogue();

    const retColor = strategy.returnPct >= 0 ? 'var(--green)' : 'var(--red)';
    const retText = `${strategy.returnPct >= 0 ? '+' : ''}${strategy.returnPct.toFixed(1)}%`;

    _eventBus.emit('conv:open', {
      id: 'chat_' + strategy.id,
      title: `${strategy.name}  ${retText}`,
      messages: [{
        id: 'sys_1',
        role: 'system',
        text: `正在与「${strategy.name}」对话...`,
      }],
      inputMode: 'text',
      inputPlaceholder: '输入消息...',
      inputType: 'text',
    });

    // 请求历史对话
    if (_chatService?.isConnected()) {
      _chatService.requestHistory(strategy.id);
    }
  }
}
