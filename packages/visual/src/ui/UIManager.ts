// ============================================================
// UIManager.ts — UI 面板管理
// ============================================================

import { EventBus } from '../core/EventBus';
import { GameStore } from '../core/GameStore';
import { StrategyListPanel } from './StrategyListPanel';
import { EventLogPanel } from './EventLogPanel';
import { DetailPanel } from './DetailPanel';
import { HeaderBar } from './HeaderBar';
import { DialoguePanel } from './DialoguePanel';
import './styles.css';

export class UIManager {
  private headerBar: HeaderBar;
  private strategyList: StrategyListPanel;
  private eventLog: EventLogPanel;
  private detailPanel: DetailPanel;
  dialoguePanel: DialoguePanel;

  constructor(eventBus: EventBus, store: GameStore) {
    const app = document.getElementById('app')!;

    // Header
    this.headerBar = new HeaderBar(app, eventBus, store);

    // Game container
    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    app.appendChild(gameContainer);

    // Side panel
    const panel = document.createElement('div');
    panel.className = 'panel';
    gameContainer.appendChild(panel);

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
    panel.appendChild(listSection);

    const eventSection = document.createElement('div');
    eventSection.innerHTML = '<h3>🧬 事件</h3>';
    const eventContainer = document.createElement('div');
    eventContainer.className = 'events';
    eventSection.appendChild(eventContainer);
    panel.appendChild(eventSection);

    const detailSection = document.createElement('div');
    detailSection.innerHTML = '<h3>📋 详情</h3>';
    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail';
    detailContainer.appendChild(this.createPlaceholder());
    detailSection.appendChild(detailContainer);
    panel.appendChild(detailSection);

    // Initialize panels
    this.strategyList = new StrategyListPanel(listContainer, eventBus, store);
    this.eventLog = new EventLogPanel(eventContainer, eventBus, store);
    this.detailPanel = new DetailPanel(detailContainer, eventBus, store);
    this.dialoguePanel = new DialoguePanel(eventBus);
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
