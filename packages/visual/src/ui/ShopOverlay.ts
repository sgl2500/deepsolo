import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { SHOP_PRODUCTS, type ShopProductDef } from '../content/ShopCatalog';

export class ShopOverlay {
  private dock: HTMLElement;
  private overlay: HTMLElement;
  private list: HTMLElement;
  private detail: HTMLElement;
  private balanceEls: HTMLElement[] = [];
  private visible = false;
  private selectedProductId = SHOP_PRODUCTS[0]?.id ?? '';

  constructor(private root: HTMLElement, private eventBus: EventBus, private store: GameStore) {
    this.dock = document.createElement('div');
    this.dock.className = 'shop-dock';
    this.root.appendChild(this.dock);

    this.overlay = document.createElement('div');
    this.overlay.className = 'shop-overlay';
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = `
      <div class="shop-card" role="dialog" aria-modal="true" aria-label="策略商城">
        <div class="shop-card-head">
          <div>
            <div class="shop-kicker">YUANBAO MARKET</div>
            <h2>策略商城</h2>
            <p>以元宝购买秘籍，立即研读，直接进入角色体系。</p>
          </div>
          <div class="shop-head-side">
            <div class="shop-balance">元宝 <b data-shop-balance>0</b></div>
            <button class="shop-close" type="button" aria-label="关闭商城">×</button>
          </div>
        </div>
        <div class="shop-body">
          <div class="shop-list" aria-label="商品列表"></div>
          <div class="shop-detail" aria-label="商品详情"></div>
        </div>
        <div class="shop-foot">大地图右上角进入 · 第一版购买后直接学会</div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.list = this.overlay.querySelector('.shop-list')!;
    this.detail = this.overlay.querySelector('.shop-detail')!;
    this.balanceEls = Array.from(this.overlay.querySelectorAll('[data-shop-balance]'));

    this.dock.addEventListener('click', () => this.show());
    this.overlay.querySelector<HTMLButtonElement>('.shop-close')!.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.hide();
    });
    this.list.addEventListener('click', (event) => this.handleListClick(event));
    this.detail.addEventListener('click', (event) => this.handleDetailClick(event));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.visible) this.hide();
    });

    this.eventBus.on('player:progress-changed', () => this.refresh());
    this.eventBus.on('player:currency-changed', () => this.refresh());
    this.eventBus.on('scene:state-changed', ({ state }) => {
      const showDock = state !== 'battle';
      this.dock.style.display = showDock ? 'flex' : 'none';
      if (!showDock) this.hide();
    });

    this.refresh();
  }

  show(): void {
    this.visible = true;
    this.refresh();
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  setDockVisible(visible: boolean): void {
    this.dock.style.display = visible ? 'flex' : 'none';
    if (!visible) this.hide();
  }

  private refresh(): void {
    const yuanbao = this.store.getYuanbao();
    this.dock.innerHTML = `
      <div class="shop-dock-coin">元宝 <b>${yuanbao}</b></div>
      <button type="button">策略商城</button>
    `;
    for (const el of this.balanceEls) el.textContent = String(yuanbao);

    const selected = SHOP_PRODUCTS.find((product) => product.id === this.selectedProductId) ?? SHOP_PRODUCTS[0];
    if (selected) this.selectedProductId = selected.id;
    this.renderList();
    this.renderDetail(selected);
  }

  private renderList(): void {
    this.list.innerHTML = SHOP_PRODUCTS.map((product) => {
      const owned = this.store.hasManual(product.manualId);
      const selected = product.id === this.selectedProductId;
      return `
        <button class="shop-product ${selected ? 'is-selected' : ''} rarity-${product.rarity}" type="button" data-shop-product="${escapeHtml(product.id)}">
          <span class="shop-product-mark">${owned ? '已得' : product.price}</span>
          <strong>${escapeHtml(product.name)}</strong>
          <em>${escapeHtml(product.subtitle)}</em>
          <small>${product.tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join('')}</small>
        </button>
      `;
    }).join('');
  }

  private renderDetail(product: ShopProductDef | undefined): void {
    if (!product) {
      this.detail.innerHTML = '<div class="shop-empty">暂无商品</div>';
      return;
    }

    const owned = this.store.hasManual(product.manualId);
    const affordable = this.store.getYuanbao() >= product.price;
    const buttonText = owned ? '已拥有' : affordable ? `花费 ${product.price} 元宝购买` : '元宝不足';
    this.detail.innerHTML = `
      <div class="shop-detail-art rarity-${product.rarity}">
        <div class="shop-manual-icon">秘</div>
        <div>
          <span>${escapeHtml(product.subtitle)}</span>
          <h3>${escapeHtml(product.name)}</h3>
        </div>
      </div>
      <p class="shop-detail-copy">${escapeHtml(product.description)}</p>
      <div class="shop-effect">
        <b>研读效果</b>
        <span>${escapeHtml(product.effect)}</span>
      </div>
      <div class="shop-tags">${product.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <button class="shop-buy" type="button" data-buy-product="${escapeHtml(product.id)}" ${owned || !affordable ? 'disabled' : ''}>
        ${escapeHtml(buttonText)}
      </button>
      <div class="shop-message" data-shop-message></div>
    `;
  }

  private handleListClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-shop-product]');
    if (!button) return;
    this.selectedProductId = button.dataset.shopProduct ?? this.selectedProductId;
    this.refresh();
  }

  private handleDetailClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('[data-buy-product]');
    if (!button || button.disabled) return;
    const product = SHOP_PRODUCTS.find((item) => item.id === button.dataset.buyProduct);
    if (!product) return;

    const result = this.store.purchaseManualWithYuanbao(product.id, product.manualId, product.price, true);
    this.refresh();
    const message = this.detail.querySelector<HTMLElement>('[data-shop-message]');
    if (message) {
      message.textContent = result.ok ? `购买成功：${product.name} 已学会` : result.message;
      message.className = `shop-message ${result.ok ? 'is-ok' : 'is-error'}`;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
