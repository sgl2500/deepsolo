// ============================================================
// EventLogPanel.ts — 事件日志面板（含天道/诞生特殊样式）
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
    this.el.innerHTML = this.store.eventLog.map(entry => {
      const cls = this.getEventClass(entry.text);
      const icon = this.getEventIcon(entry.text);
      return `<div class="evt ${cls}"><span class="t">${entry.time}</span> ${icon} <span class="a">[${entry.agentName}]</span> <span class="act">${entry.text}</span></div>`;
    }).join('');
  }

  private getEventClass(text: string): string {
    if (text.includes('天道消灭') || text.includes('被天')) return 'evt-heaven';
    if (text.includes('诞生') || text.includes('新生')) return 'evt-born';
    if (text.includes('碰面') || text.includes('互补')) return 'evt-discuss';
    return '';
  }

  private getEventIcon(text: string): string {
    if (text.includes('天道消灭') || text.includes('被天')) return '<span class="evt-icon heaven">⚡</span>';
    if (text.includes('诞生') || text.includes('新生')) return '<span class="evt-icon born">✨</span>';
    if (text.includes('碰面') || text.includes('互补')) return '<span class="evt-icon discuss">💬</span>';
    return '';
  }
}
