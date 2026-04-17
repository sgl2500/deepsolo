// ============================================================
// TokenCenterUI.ts — Token 中心面板（3 Tab）
// ============================================================

import { EventBus } from '../core/EventBus';
import { TokenStore } from '../core/TokenStore';
import { RARITY_COLORS, RARITY_LABELS } from '../config';
import type { Token, TokenListing } from '../types';

type TabId = 'tokens' | 'listings' | 'account';

export class TokenCenterUI {
  private el: HTMLElement;
  private tabButtons: Record<TabId, HTMLButtonElement> = {} as any;
  private contentEl: HTMLElement;
  private currentTab: TabId = 'tokens';

  private eventBus: EventBus;
  private store: TokenStore;

  constructor(container: HTMLElement, eventBus: EventBus, store: TokenStore) {
    this.eventBus = eventBus;
    this.store = store;

    // 外壳
    this.el = document.createElement('div');
    this.el.className = 'token-center-panel';
    this.el.style.display = 'none';
    container.appendChild(this.el);

    // 标题
    const header = document.createElement('div');
    header.className = 'tc-header';
    header.innerHTML = '<span class="tc-title">Token 中心</span>';
    this.el.appendChild(header);

    // Tab 栏
    const tabBar = document.createElement('div');
    tabBar.className = 'tc-tabs';
    const tabs: { id: TabId; label: string }[] = [
      { id: 'tokens', label: '我的 Token' },
      { id: 'listings', label: '我的挂单' },
      { id: 'account', label: '账户中心' },
    ];
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tc-tab';
      btn.textContent = t.label;
      btn.addEventListener('click', () => this.switchTab(t.id));
      tabBar.appendChild(btn);
      this.tabButtons[t.id] = btn;
    });
    this.el.appendChild(tabBar);

    // 内容区
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'tc-content';
    this.el.appendChild(this.contentEl);

    // 事件监听
    this.eventBus.on('account:updated', () => {
      if (this.el.style.display !== 'none') this.render();
    });
    this.eventBus.on('token:listed', () => {
      if (this.el.style.display !== 'none') this.render();
    });
    this.eventBus.on('token:cancel', () => {
      if (this.el.style.display !== 'none') this.render();
    });

    this.switchTab('tokens');
  }

  // ── 显示/隐藏 ──

  show(): void {
    this.el.style.display = 'block';
    this.render();
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  // ── Tab 切换 ──

  private switchTab(tab: TabId): void {
    this.currentTab = tab;
    Object.entries(this.tabButtons).forEach(([id, btn]) => {
      btn.classList.toggle('active', id === tab);
    });
    this.render();
  }

  // ── 渲染 ──

  private render(): void {
    this.contentEl.innerHTML = '';
    switch (this.currentTab) {
      case 'tokens': this.renderTokens(); break;
      case 'listings': this.renderListings(); break;
      case 'account': this.renderAccount(); break;
    }
  }

  // ── Tab: 我的 Token ──

  private renderTokens(): void {
    const account = this.store.account;
    if (!account) return;

    // 余额
    const balanceEl = document.createElement('div');
    balanceEl.className = 'tc-balance';
    balanceEl.innerHTML = `余额: <span class="tc-gold">${account.balance.toLocaleString()}</span> 金币`;
    this.contentEl.appendChild(balanceEl);

    const tokens = this.store.getHeldTokens();
    if (tokens.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tc-empty';
      empty.textContent = '暂无可用 Token（可能都已上架）';
      this.contentEl.appendChild(empty);
      return;
    }

    tokens.forEach(token => {
      this.contentEl.appendChild(this.createTokenCard(token));
    });
  }

  private createTokenCard(token: Token): HTMLElement {
    const card = document.createElement('div');
    card.className = 'tc-token-card';

    const rarityColor = RARITY_COLORS[token.rarity] || '#9ca3af';
    const rarityLabel = RARITY_LABELS[token.rarity] || token.rarity;

    card.innerHTML = `
      <div class="tc-token-name" style="color:${rarityColor}">${token.name}</div>
      <div class="tc-token-meta">${rarityLabel} · ${token.description}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'tc-btn tc-btn-sell';
    btn.textContent = '上架售卖';
    btn.addEventListener('click', () => this.showListDialog(token));
    card.appendChild(btn);

    return card;
  }

  // ── Tab: 我的挂单 ──

  private renderListings(): void {
    const listings = this.store.getActiveListings();

    const countEl = document.createElement('div');
    countEl.className = 'tc-balance';
    countEl.innerHTML = `活跃挂单: <span class="tc-gold">${listings.length}</span>`;
    this.contentEl.appendChild(countEl);

    if (listings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tc-empty';
      empty.textContent = '暂无活跃挂单';
      this.contentEl.appendChild(empty);
      return;
    }

    listings.forEach(listing => {
      this.contentEl.appendChild(this.createListingCard(listing));
    });
  }

  private createListingCard(listing: TokenListing): HTMLElement {
    const card = document.createElement('div');
    card.className = 'tc-token-card';

    const rarityColor = RARITY_COLORS[listing.tokenRarity] || '#9ca3af';

    card.innerHTML = `
      <div class="tc-token-name" style="color:${rarityColor}">${listing.tokenName}</div>
      <div class="tc-token-meta">价格: ${listing.price.toLocaleString()} 金币 · 上架: ${listing.listedAt}</div>
    `;

    const btn = document.createElement('button');
    btn.className = 'tc-btn tc-btn-cancel';
    btn.textContent = '取消挂单';
    btn.addEventListener('click', () => {
      if (confirm(`确认取消 "${listing.tokenName}" 的挂单？`)) {
        this.store.cancelListing(listing.id);
      }
    });
    card.appendChild(btn);

    return card;
  }

  // ── Tab: 账户中心 ──

  private renderAccount(): void {
    const account = this.store.account;
    if (!account) return;

    const activeCount = this.store.getActiveListings().length;
    const heldCount = this.store.getHeldTokens().length;

    const infoEl = document.createElement('div');
    infoEl.className = 'tc-account-info';
    infoEl.innerHTML = `
      <div class="tc-account-row"><span>名称</span><span>${account.name}</span></div>
      <div class="tc-account-row"><span>余额</span><span class="tc-gold">${account.balance.toLocaleString()} 金币</span></div>
      <div class="tc-account-row"><span>持有 Token</span><span>${heldCount} 个</span></div>
      <div class="tc-account-row"><span>活跃挂单</span><span>${activeCount} 个</span></div>
      <div class="tc-account-row"><span>注册时间</span><span>${account.createdAt}</span></div>
    `;
    this.contentEl.appendChild(infoEl);

    // 个人简介
    const bioLabel = document.createElement('div');
    bioLabel.className = 'tc-section-label';
    bioLabel.textContent = '个人简介';
    this.contentEl.appendChild(bioLabel);

    const bioEl = document.createElement('div');
    bioEl.className = 'tc-bio';
    bioEl.textContent = account.bio || '暂无简介';
    this.contentEl.appendChild(bioEl);

    // 操作记录
    const txLabel = document.createElement('div');
    txLabel.className = 'tc-section-label';
    txLabel.textContent = '操作记录';
    this.contentEl.appendChild(txLabel);

    const txList = document.createElement('div');
    txList.className = 'tc-tx-list';

    const recentTx = [...this.store.transactions].reverse().slice(0, 10);
    if (recentTx.length === 0) {
      txList.innerHTML = '<div class="tc-empty">暂无记录</div>';
    } else {
      recentTx.forEach(tx => {
        const row = document.createElement('div');
        row.className = 'tc-tx-row';
        const icon = tx.type === 'list' ? '↑' : '↓';
        const action = tx.type === 'list' ? '上架' : '取消';
        const color = tx.type === 'list' ? 'var(--blue)' : 'var(--text2)';
        row.innerHTML = `<span style="color:${color}">${icon} ${action} "${tx.tokenName}" ${tx.price.toLocaleString()}金币</span><span class="tc-tx-time">${tx.timestamp}</span>`;
        txList.appendChild(row);
      });
    }
    this.contentEl.appendChild(txList);

    // 重置按钮
    const resetBtn = document.createElement('button');
    resetBtn.className = 'tc-btn tc-btn-reset';
    resetBtn.textContent = '重置数据';
    resetBtn.addEventListener('click', () => {
      if (confirm('确认重置所有 Token 数据？将恢复初始状态。')) {
        this.store.reset();
        this.render();
      }
    });
    this.contentEl.appendChild(resetBtn);
  }

  // ── 弹窗: 上架售卖 ──

  private showListDialog(token: Token): void {
    const overlay = document.createElement('div');
    overlay.className = 'tc-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'tc-dialog';

    const rarityColor = RARITY_COLORS[token.rarity] || '#9ca3af';
    dialog.innerHTML = `
      <div class="tc-dialog-title">上架售卖</div>
      <div class="tc-dialog-token" style="color:${rarityColor}">${token.name}</div>
      <div class="tc-dialog-desc">${token.description}</div>
      <div class="tc-dialog-label">设定价格 (金币):</div>
    `;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'tc-dialog-input';
    input.placeholder = '输入价格';
    input.min = '1';
    dialog.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.className = 'tc-dialog-btns';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'tc-btn tc-btn-confirm';
    confirmBtn.textContent = '确认上架';
    confirmBtn.addEventListener('click', () => {
      const price = parseInt(input.value, 10);
      if (!price || price <= 0) {
        input.style.borderColor = 'var(--red)';
        return;
      }
      this.store.listToken(token.id, price);
      overlay.remove();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tc-btn tc-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    input.focus();
  }
}
