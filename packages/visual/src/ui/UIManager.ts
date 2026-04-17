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
import type { ChatService } from '../services/ChatService';
import './styles.css';

export class UIManager {
  private headerBar: HeaderBar;
  private strategyList: StrategyListPanel;
  private eventLog: EventLogPanel;
  private detailPanel: DetailPanel;
  conversationPanel: ConversationPanel;
  tokenCenterUI: TokenCenterUI;

  private panel: HTMLElement;
  private tokenPanel: HTMLElement;

  constructor(eventBus: EventBus, store: GameStore, chatService: ChatService) {
    const app = document.getElementById('app')!;

    // Token Store
    const tokenStore = new TokenStore(eventBus);

    // Header
    this.headerBar = new HeaderBar(app, eventBus, store);

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
    detailSection.innerHTML = '<h3>📋 详情</h3>';
    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail';
    detailContainer.appendChild(this.createPlaceholder());
    detailSection.appendChild(detailContainer);
    this.panel.appendChild(detailSection);

    // Initialize panels
    this.strategyList = new StrategyListPanel(listContainer, eventBus, store);
    this.eventLog = new EventLogPanel(eventContainer, eventBus, store);
    this.detailPanel = new DetailPanel(detailContainer, eventBus, store);
    this.conversationPanel = new ConversationPanel(eventBus);
    this.tokenCenterUI = new TokenCenterUI(this.tokenPanel, eventBus, tokenStore);
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
      if (state === 'indoor' && buildingId === 'token_center') {
        this.panel.style.display = 'none';
        this.tokenPanel.style.display = 'block';
        this.tokenCenterUI.show();
      } else {
        this.panel.style.display = 'block';
        this.tokenPanel.style.display = 'none';
        this.tokenCenterUI.hide();
      }
    });
  }

  private createPlaceholder(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'text-align:center;padding:8px;color:var(--text2)';
    el.textContent = '点击角色查看';
    return el;
  }

  getGameContainer(): HTMLElement {
    return document.getElementById('game-container')!;
  }
}
