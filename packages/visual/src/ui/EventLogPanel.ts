// ============================================================
// EventLogPanel.ts — 事件日志面板
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

export class EventLogPanel {
  private el: HTMLElement;
  private store: GameStore;

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore) {
    this.el = container;
    this.store = store;

    eventBus.on('strategy:state-changed', () => this.refresh());
    eventBus.on('ui:refresh', () => this.refresh());
  }

  refresh(): void {
    this.el.innerHTML = this.store.eventLog.map(entry =>
      `<div><span class="t">${entry.time}</span> <span class="a">[${entry.agentName}]</span> <span class="act">${entry.text}</span></div>`
    ).join('');
  }
}
