import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { getPlayerItemDef } from '../content/PlayerItems';
import { getPlayerManualDef } from '../content/PlayerManuals';
import {
  MARTIAL_LEVEL_MAX,
  PLAYER_MARTIAL_ARTS,
  getMartialCategoryLabel,
  getMartialPowerMultiplier,
  getMartialRequiredExp,
} from '../content/PlayerMartialArts';

type PlayerPanelTab = 'attributes' | 'martial' | 'items';

const ITEM_FALLBACK_ICON = 'assets/jy-assets/08_thing/0079.png';

const ATTRIBUTE_LABELS = {
  attack: '攻击',
  defense: '防御',
  speed: '身法',
  understanding: '悟性',
  fortune: '福缘',
} as const;

const TAB_LABELS: Record<PlayerPanelTab, { title: string; desc: string }> = {
  attributes: { title: '个人属性', desc: '生命、内力、基础属性与装备' },
  martial: { title: '武功', desc: '查看可学习与已掌握的武功' },
  items: { title: '物品', desc: '背包、秘籍和后续道具' },
};

export class PlayerPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private store: GameStore;
  private visible = false;
  private activeTab: PlayerPanelTab = 'attributes';

  constructor(eventBus: EventBus, store: GameStore) {
    this.store = store;

    this.overlay = document.createElement('div');
    this.overlay.className = 'player-overlay';
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = `
      <div class="player-card">
        <div class="player-card-head">
          <div>
            <div class="player-card-kicker">玩家档案</div>
            <h2>个人体系</h2>
          </div>
          <button class="player-close" type="button" aria-label="关闭玩家面板">×</button>
        </div>
        <div class="player-card-body"></div>
        <div class="player-card-foot">I 键打开/关闭 · 左侧切换属性 / 武功 / 物品</div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.body = this.overlay.querySelector('.player-card-body')!;
    this.overlay.querySelector<HTMLButtonElement>('.player-close')!.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.hide();
    });
    this.body.addEventListener('click', (event) => this.handleBodyClick(event));
    window.addEventListener('keydown', (event) => this.handleKeyDown(event));

    eventBus.on('player:progress-changed', () => {
      if (this.visible) this.refresh();
    });
    eventBus.on('scene:state-changed', ({ state }) => {
      if (state === 'battle') this.hide();
    });
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
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

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'i') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
    this.toggle();
  }

  private handleBodyClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const tabButton = target?.closest<HTMLElement>('[data-player-tab]');
    if (tabButton) {
      this.activeTab = tabButton.dataset.playerTab as PlayerPanelTab;
      this.refresh();
      return;
    }

    const learnButton = target?.closest<HTMLButtonElement>('[data-learn-manual]');
    if (learnButton) {
      if (learnButton.disabled) return;
      const manualId = learnButton.dataset.learnManual;
      if (!manualId) return;
      const learned = this.store.learnManual(manualId);
      if (!learned) this.refresh();
      return;
    }

    const forgetButton = target?.closest<HTMLButtonElement>('[data-forget-manual]');
    if (forgetButton) {
      const forgetManualId = forgetButton.dataset.forgetManual;
      if (forgetManualId) this.store.forgetManual(forgetManualId);
      return;
    }

    const abandonButton = target?.closest<HTMLButtonElement>('[data-abandon-item]');
    if (abandonButton) {
      const itemId = abandonButton.dataset.abandonItem;
      if (itemId) this.store.abandonItem(itemId);
    }
  }

  private refresh(): void {
    this.body.innerHTML = `
      <div class="player-layout">
        <aside class="player-tabs">
          ${this.renderTabButton('attributes')}
          ${this.renderTabButton('martial')}
          ${this.renderTabButton('items')}
        </aside>
        <main class="player-tab-content">
          ${this.renderActiveTab()}
        </main>
      </div>
    `;
  }

  private renderTabButton(tab: PlayerPanelTab): string {
    const meta = TAB_LABELS[tab];
    return `
      <button class="${this.activeTab === tab ? 'active' : ''}" type="button" data-player-tab="${tab}">
        <strong>${meta.title}</strong>
        <span>${meta.desc}</span>
      </button>
    `;
  }

  private renderActiveTab(): string {
    switch (this.activeTab) {
      case 'martial': return this.renderMartialTab();
      case 'items': return this.renderItemsTab();
      case 'attributes':
      default: return this.renderAttributesTab();
    }
  }

  private renderAttributesTab(): string {
    const progress = this.store.playerProgress;
    const vitals = progress.vitals;
    const equipment = progress.equipment;
    return `
      <section class="player-profile">
        <div class="player-avatar">侠</div>
        <div>
          <h3>${this.escapeHtml(progress.identity.name)}</h3>
          <p>${this.escapeHtml(progress.identity.title ?? '江湖新人')}</p>
        </div>
      </section>

      <section class="player-section">
        <h4>状态</h4>
        <div class="player-vitals">
          ${this.renderVital('生命', vitals.hp, vitals.maxHp, '#f87171')}
          ${this.renderVital('内力', vitals.mp, vitals.maxMp, '#60a5fa')}
        </div>
      </section>

      <section class="player-section">
        <h4>基础属性</h4>
        <div class="player-attrs">
          ${Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => `
            <div><span>${label}</span><b>${progress.attributes[key as keyof typeof ATTRIBUTE_LABELS]}</b></div>
          `).join('')}
        </div>
      </section>

      <section class="player-section">
        <h4>装备</h4>
        <div class="player-equipment">
          ${this.renderEquipmentSlot('武器', equipment.weapon)}
          ${this.renderEquipmentSlot('护具', equipment.armor)}
          ${this.renderEquipmentSlot('饰品', equipment.accessory)}
        </div>
      </section>
    `;
  }

  private renderMartialTab(): string {
    const progress = this.store.playerProgress;
    return `
      <section class="player-section martial-head">
        <h4>武功列表</h4>
        <p>秘籍在背包里时可研读；研读会消耗秘籍并增加属性。已掌握的武功可以遗忘，遗忘后可再去书架重新获取秘籍。</p>
      </section>
      <div class="martial-list">
        ${PLAYER_MARTIAL_ARTS.map((art) => {
          const manual = art.requiredManualId ? getPlayerManualDef(art.requiredManualId) : undefined;
          const manualProgress = art.requiredManualId
            ? progress.manuals.find(item => item.manualId === art.requiredManualId)
            : undefined;
          const hasManual = !!manualProgress;
          const learned = art.innate || !!manualProgress?.learned;
          const canLearn = !!art.requiredManualId && hasManual && !learned && this.meetsAttributeRequirement(art.requiredAttributes);
          const state = art.innate ? '基础武功' : learned ? '已掌握' : canLearn ? '可研读' : hasManual ? '条件不足' : '缺少秘籍';
          const sourceText = art.innate ? '来源：默认掌握' : `来源：${this.escapeHtml(manual?.name ?? art.requiredManualId ?? '未知秘籍')}`;
          const martialProgress = progress.martials.find(item => item.martialId === art.id);
          const progressHtml = martialProgress && learned
            ? this.renderMartialProgress(martialProgress.level, martialProgress.exp, martialProgress.totalUses, martialProgress.hitCount, martialProgress.whiffCount, martialProgress.stack)
            : '';
          const actionButton = art.innate
            ? '<button type="button" disabled>常驻</button>'
            : learned && art.requiredManualId
              ? `<button class="danger" type="button" data-forget-manual="${this.escapeHtml(art.requiredManualId)}">遗忘</button>`
              : `<button type="button" data-learn-manual="${this.escapeHtml(art.requiredManualId ?? '')}" ${canLearn ? '' : 'disabled'}>研读</button>`;
          return `
            <article class="martial-card ${learned ? 'learned' : canLearn ? 'can-learn' : ''}">
              <div>
                <div class="martial-title">
                  <strong>${this.escapeHtml(art.name)}</strong>
                  <span>${this.escapeHtml(getMartialCategoryLabel(art.category))}</span>
                </div>
                <p>${this.escapeHtml(art.description)}</p>
                <small>${sourceText} · ${this.escapeHtml(art.effectText)}</small>
                ${progressHtml}
              </div>
              <div class="martial-action">
                <b>${state}</b>
                ${actionButton}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderMartialProgress(
    level: number,
    exp: number,
    totalUses: number,
    hitCount: number,
    whiffCount: number,
    stack: number,
  ): string {
    const required = getMartialRequiredExp(level);
    const isMax = level >= MARTIAL_LEVEL_MAX;
    const pct = isMax || required <= 0 ? 100 : Math.max(0, Math.min(100, exp / required * 100));
    const power = Math.round(getMartialPowerMultiplier(level, stack) * 100);
    return `
      <div class="martial-progress">
        <div class="martial-progress-top">
          <b>Lv.${level}${isMax ? ' 满级' : ''}</b>
          <span>熟练度 ${isMax ? 'MAX' : `${exp}/${required}`} · 威力 ${power}%</span>
        </div>
        <i><em style="width:${pct}%"></em></i>
        <div class="martial-stats">
          <span>使用 ${totalUses}</span>
          <span>命中 ${hitCount}</span>
          <span>空挥 ${whiffCount}</span>
        </div>
      </div>
    `;
  }

  private renderItemsTab(): string {
    const progress = this.store.playerProgress;
    const inventoryHtml = progress.inventory.length > 0
      ? progress.inventory.map((stack) => {
        const item = getPlayerItemDef(stack.itemId);
        const typeLabel = item ? this.getItemTypeLabel(item.type) : '未知';
        const iconPath = item?.iconPath ?? ITEM_FALLBACK_ICON;
        return `
          <div class="player-list-item item-row">
            <img src="${this.escapeHtml(iconPath)}" alt="" draggable="false">
            <div>
              <strong>${this.escapeHtml(item?.name ?? stack.itemId)}</strong>
              <span>${this.escapeHtml(typeLabel)}</span>
              <p>${this.escapeHtml(item?.description ?? stack.itemId)}</p>
            </div>
            <div class="item-actions">
              <b>×${stack.count}</b>
              <button type="button" data-abandon-item="${this.escapeHtml(stack.itemId)}">放弃</button>
            </div>
          </div>
        `;
      }).join('')
      : '<div class="player-empty">背包还是空的。</div>';

    const manualsHtml = progress.manuals.length > 0
      ? progress.manuals.map((manualProgress) => {
        const manual = getPlayerManualDef(manualProgress.manualId);
        const state = manualProgress.learned ? '已研读' : '已获得';
        return `
          <div class="player-list-item manual">
            <img src="${ITEM_FALLBACK_ICON}" alt="" draggable="false">
            <div>
              <strong>${this.escapeHtml(manual?.name ?? manualProgress.manualId)}</strong>
              <span>${state} · ${Math.round(manualProgress.progress)}%</span>
              <p>${this.escapeHtml(manual?.description ?? manualProgress.manualId)}</p>
            </div>
          </div>
        `;
      }).join('')
      : '<div class="player-empty">还没有获得秘籍。</div>';

    return `
      <section class="player-section">
        <h4>背包物品</h4>
        <div class="player-list">${inventoryHtml}</div>
      </section>
      <section class="player-section">
        <h4>已获秘籍</h4>
        <div class="player-list">${manualsHtml}</div>
      </section>
    `;
  }

  private renderVital(label: string, current: number, max: number, color: string): string {
    const pct = max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
    return `
      <div class="player-vital">
        <div><span>${label}</span><b>${current}/${max}</b></div>
        <i><em style="width:${pct}%;background:${color}"></em></i>
      </div>
    `;
  }

  private renderEquipmentSlot(label: string, itemId?: string): string {
    const item = itemId ? getPlayerItemDef(itemId) : undefined;
    return `<div><span>${label}</span><b>${this.escapeHtml(item?.name ?? '未装备')}</b></div>`;
  }

  private meetsAttributeRequirement(required?: Partial<Record<keyof typeof ATTRIBUTE_LABELS, number>>): boolean {
    if (!required) return true;
    return Object.entries(required).every(([key, value]) => {
      const attr = key as keyof typeof ATTRIBUTE_LABELS;
      return this.store.playerProgress.attributes[attr] >= (value ?? 0);
    });
  }

  private getItemTypeLabel(type: string): string {
    switch (type) {
      case 'manual': return '秘籍';
      case 'consumable': return '消耗品';
      case 'quest': return '任务';
      case 'material': return '材料';
      case 'equipment': return '装备';
      default: return '物品';
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
