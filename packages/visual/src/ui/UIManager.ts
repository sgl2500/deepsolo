// ============================================================
// UIManager.ts — UI 面板管理
// ============================================================

import { EventBus } from '../core/EventBus';
import { GameStore } from '../core/GameStore';
import { TokenStore } from '../core/TokenStore';
import { StrategyListPanel } from './StrategyListPanel';
import { EventLogPanel } from './EventLogPanel';
import { DetailPanel } from './DetailPanel';
import { HeaderBar } from './HeaderBar';
import { ConversationPanel } from './ConversationPanel';
import { TokenCenterUI } from './TokenCenterUI';
import { PlayerPanel } from './PlayerPanel';
import { ShopOverlay } from './ShopOverlay';
import { StrategyProfileOverlay } from './StrategyProfileOverlay';
import type { AuthStore } from '../core/AuthStore';
import type { ChatService } from '../services/ChatService';
import './styles.css';

export class UIManager {
  private headerBar: HeaderBar;
  private strategyList: StrategyListPanel;
  private eventLog: EventLogPanel;
  private detailPanel: DetailPanel;
  private strategyProfileOverlay: StrategyProfileOverlay;
  private playerPanel: PlayerPanel;
  private shopOverlay: ShopOverlay;
  conversationPanel: ConversationPanel;
  tokenCenterUI: TokenCenterUI;

  private panel: HTMLElement;
  private tokenPanel: HTMLElement;

  constructor(eventBus: EventBus, store: GameStore, chatService: ChatService, authStore: AuthStore) {
    const app = document.getElementById('app')!;

    // Token Store
    const tokenStore = new TokenStore(eventBus, authStore.session?.username ?? null);

    // Header
    this.headerBar = new HeaderBar(app, eventBus, store, authStore);

    // Game container
    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    app.appendChild(gameContainer);

    // Side panel (原策略面板)
    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    gameContainer.appendChild(this.panel);

    // Token 中心面板 (进入建筑时切换)
    this.tokenPanel = document.createElement('div');
    this.tokenPanel.className = 'panel';
    this.tokenPanel.style.display = 'none';
    gameContainer.appendChild(this.tokenPanel);

    // Minimap canvas
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.id = 'minimap-canvas';
    minimapCanvas.width = 120;
    minimapCanvas.height = 120;
    gameContainer.appendChild(minimapCanvas);

    // Debug info
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    gameContainer.appendChild(debugInfo);

    // Panel sections
    const listSection = document.createElement('div');
    listSection.innerHTML = '<h3>📊 策略排行</h3>';
    const listContainer = document.createElement('div');
    listSection.appendChild(listContainer);
    this.panel.appendChild(listSection);

    const eventSection = document.createElement('div');
    eventSection.innerHTML = '<h3>🧬 事件</h3>';
    const eventContainer = document.createElement('div');
    eventContainer.className = 'events';
    eventSection.appendChild(eventContainer);
    this.panel.appendChild(eventSection);

    const detailSection = document.createElement('div');
    detailSection.innerHTML = '<h3>🗣️ 实况</h3>';
    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail';
    detailContainer.appendChild(this.createPlaceholder());
    detailSection.appendChild(detailContainer);
    this.panel.appendChild(detailSection);

    // Initialize panels
    this.strategyList = new StrategyListPanel(listContainer, eventBus, store);
    this.eventLog = new EventLogPanel(eventContainer, eventBus, store);
    this.detailPanel = new DetailPanel(detailContainer, eventBus, store);
    this.strategyProfileOverlay = new StrategyProfileOverlay(eventBus, store);
    this.conversationPanel = new ConversationPanel(eventBus);
    this.tokenCenterUI = new TokenCenterUI(this.tokenPanel, eventBus, tokenStore);
    this.playerPanel = new PlayerPanel(eventBus, store);
    this.shopOverlay = new ShopOverlay(gameContainer, eventBus, store);
    this.headerBar.refresh();

    // Subscribe to refresh events
    eventBus.on('strategy:state-changed', () => {
      this.strategyList.refresh();
      this.headerBar.refresh();
    });
    eventBus.on('strategy:selected', () => {
      this.strategyList.refresh();
    });
    eventBus.on('ui:refresh', () => {
      this.strategyList.refresh();
      this.headerBar.refresh();
    });

    // 场景切换 → 面板切换
    eventBus.on('scene:state-changed', ({ state, buildingId }) => {
      if (state === 'battle') {
        // 战斗时隐藏所有世界地图 UI
        this.panel.style.display = 'none';
        this.tokenPanel.style.display = 'none';
        this.headerBar.setVisible(false);
        this.hideGameContainerOverlays(true);
        this.shopOverlay.setDockVisible(false);
      } else if (state === 'indoor' && buildingId === 'token_center') {
        this.panel.style.display = 'none';
        this.tokenPanel.style.display = 'block';
        this.tokenCenterUI.show();
        this.headerBar.setVisible(true);
        this.hideGameContainerOverlays(true);
        this.shopOverlay.setDockVisible(false);
      } else if (state === 'indoor' && buildingId === 'digital_sect') {
        this.panel.style.display = 'block';
        this.tokenPanel.style.display = 'none';
        this.tokenCenterUI.hide();
        this.headerBar.setVisible(true);
        this.hideGameContainerOverlays(true);
        this.shopOverlay.setDockVisible(false);
        store.selectStrategy(null);
      } else if (state === 'indoor') {
        this.panel.style.display = 'none';
        this.tokenPanel.style.display = 'none';
        this.tokenCenterUI.hide();
        this.headerBar.setVisible(true);
        this.hideGameContainerOverlays(true);
        this.shopOverlay.setDockVisible(false);
      } else {
        this.panel.style.display = 'block';
        this.tokenPanel.style.display = 'none';
        this.tokenCenterUI.hide();
        this.headerBar.setVisible(true);
        this.hideGameContainerOverlays(false);
        this.shopOverlay.setDockVisible(true);
      }
    });
  }

  private createPlaceholder(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'text-align:center;padding:8px;color:var(--text2)';
    el.textContent = '讨论开始后会在这里显示实况';
    return el;
  }

  getGameContainer(): HTMLElement {
    return document.getElementById('game-container')!;
  }

  /** 战斗时隐藏小地图、调试信息等 DOM 覆盖层 */
  private hideGameContainerOverlays(hide: boolean): void {
    const gc = document.getElementById('game-container');
    if (!gc) return;
    const minimap = gc.querySelector('#minimap-canvas') as HTMLElement | null;
    const debug = gc.querySelector('#debug-info') as HTMLElement | null;
    if (minimap) minimap.style.display = hide ? 'none' : '';
    if (debug) debug.style.display = hide ? 'none' : '';
  }
}
