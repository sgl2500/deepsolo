// ============================================================
// HeaderBar.ts — 顶部统计栏
// ============================================================

import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import type { AuthStore } from '../core/AuthStore';

export class HeaderBar {
  private el: HTMLElement;
  private store: GameStore;
  private authStore: AuthStore;
  private countEl!: HTMLElement;
  private winEl!: HTMLElement;
  private loseEl!: HTMLElement;
  private tradesEl!: HTMLElement;
  private hpEl!: HTMLElement;
  private mpEl!: HTMLElement;
  private userEl!: HTMLElement;
  private logoutBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore, authStore: AuthStore) {
    this.store = store;
    this.authStore = authStore;

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
      <span>生命 <span class="v" id="p-hp">0/0</span></span>
      <span>内力 <span class="v" id="p-mp">0/0</span></span>
      <span>账号 <span class="v" id="u-name">-</span></span>
    `;
    this.el.appendChild(stats);

    const actions = document.createElement('div');
    actions.className = 'header-actions';
    actions.innerHTML = `
      <span class="hint">WASD / 方向键移动 · I 玩家面板 · T 查看人物</span>
      <button type="button" class="logout-btn">退出</button>
    `;
    this.el.appendChild(actions);

    container.appendChild(this.el);

    this.countEl = stats.querySelector('#s-cnt')!;
    this.winEl = stats.querySelector('#s-win')!;
    this.loseEl = stats.querySelector('#s-lose')!;
    this.tradesEl = stats.querySelector('#s-trades')!;
    this.hpEl = stats.querySelector('#p-hp')!;
    this.mpEl = stats.querySelector('#p-mp')!;
    this.userEl = stats.querySelector('#u-name')!;
    this.logoutBtn = actions.querySelector('.logout-btn')!;
    this.logoutBtn.addEventListener('click', () => this.authStore.logout());

    eventBus.on('player:progress-changed', () => this.refresh());
    eventBus.on('auth:changed', () => this.refresh());
  }

  refresh(): void {
    const strategies = this.store.strategies;
    this.countEl.textContent = String(strategies.length);
    this.winEl.textContent = String(strategies.filter(s => s.returnPct > 0).length);
    this.loseEl.textContent = String(strategies.filter(s => s.returnPct <= 0).length);
    this.tradesEl.textContent = strategies.reduce((a, s) => a + s.totalTrades, 0).toLocaleString();
    const vitals = this.store.playerProgress.vitals;
    this.hpEl.textContent = `${vitals.hp}/${vitals.maxHp}`;
    this.mpEl.textContent = `${vitals.mp}/${vitals.maxMp}`;
    this.userEl.textContent = this.authStore.session?.username ?? '-';
  }

  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }
}
