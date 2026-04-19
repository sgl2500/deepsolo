// ============================================================
// HeaderBar.ts — 顶部统计栏
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

export class HeaderBar {
  private el: HTMLElement;
  private store: GameStore;
  private countEl!: HTMLElement;
  private winEl!: HTMLElement;
  private loseEl!: HTMLElement;
  private tradesEl!: HTMLElement;

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore) {
    this.store = store;

    this.el = document.createElement('div');
    this.el.className = 'header';

    const h1 = document.createElement('h1');
    h1.innerHTML = '⚔️ DeepSolo <span>策略世界 · 金庸群侠传</span>';
    this.el.appendChild(h1);

    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.innerHTML = `
      <span>策略 <span class="v" id="s-cnt">0</span></span>
      <span>盈利 <span class="v" id="s-win">0</span></span>
      <span>亏损 <span class="v" id="s-lose">0</span></span>
      <span>交易 <span class="v" id="s-trades">0</span></span>
    `;
    this.el.appendChild(stats);

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'WASD / 方向键移动 · 点击角色查看详情';
    this.el.appendChild(hint);

    container.appendChild(this.el);

    this.countEl = stats.querySelector('#s-cnt')!;
    this.winEl = stats.querySelector('#s-win')!;
    this.loseEl = stats.querySelector('#s-lose')!;
    this.tradesEl = stats.querySelector('#s-trades')!;
  }

  refresh(): void {
    const strategies = this.store.strategies;
    this.countEl.textContent = String(strategies.length);
    this.winEl.textContent = String(strategies.filter(s => s.returnPct > 0).length);
    this.loseEl.textContent = String(strategies.filter(s => s.returnPct <= 0).length);
    this.tradesEl.textContent = strategies.reduce((a, s) => a + s.totalTrades, 0).toLocaleString();
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }
}
