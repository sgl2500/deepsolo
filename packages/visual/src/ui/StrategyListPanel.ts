// ============================================================
// StrategyListPanel.ts — 策略排行列表
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

export class StrategyListPanel {
  private el: HTMLElement;
  private eventBus: EventBus;
  private store: GameStore;

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore) {
    this.el = container;
    this.eventBus = eventBus;
    this.store = store;

    // 使用事件委托而非 inline onclick
    this.el.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-sid]');
      if (target) {
        const id = (target as HTMLElement).dataset.sid!;
        const strategy = this.store.getStrategy(id);
        if (strategy) {
          this.store.selectStrategy(strategy);
        }
      }
    });
  }

  refresh(): void {
    const sorted = [...this.store.strategies].sort((a, b) => b.returnPct - a.returnPct);
    const selectedId = this.store.selectedStrategyId;

    this.el.innerHTML = sorted.map(s => {
      const tag = this.getTag(s.category);
      const rc = s.returnPct >= 0 ? 'pos' : 'neg';
      const sel = s.id === selectedId ? 'sel' : '';
      const prefix = s.returnPct >= 0 ? '+' : '';
      return `<div class="s-item ${sel}" data-sid="${s.id}">
        ${tag} ${s.name} <span class="bold ${rc}">${prefix}${s.returnPct}%</span>
      </div>`;
    }).join('');
  }

  private getTag(category: string): string {
    switch (category) {
      case 'hot': return '<span class="tag tag-hot">热度</span>';
      case 'emerged': return '<span class="tag tag-emrg">涌现</span>';
      default: return '<span class="tag tag-norm">普通</span>';
    }
  }
}
