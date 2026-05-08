import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { getPlayerItemDef } from '../content/PlayerItems';
import { getPlayerManualDef } from '../content/PlayerManuals';
import { NPC_DEFS } from '../data/NPCData';
import {
  MARTIAL_LEVEL_MAX,
  PLAYER_MARTIAL_ARTS,
  getMartialCategoryLabel,
  getMartialPowerMultiplier,
  getMartialRequiredExp,
} from '../content/PlayerMartialArts';
import { buildPlayerCombatDisplayModel, renderCombatCardGrid, renderCombatNotes } from './CombatDisplay';

type PlayerPanelTab = 'attributes' | 'martial' | 'items';

const ITEM_FALLBACK_ICON = 'assets/jy-runtime/08_thing/0079.png';

const ATTRIBUTE_LABELS = {
  attack: '攻击',
  defense: '防御',
  speed: '身法',
  understanding: '悟性',
  fortune: '福缘',
} as const;

const TAB_LABELS: Record<PlayerPanelTab, { title: string; desc: string }> = {
  attributes: { title: '属性', desc: '生命、内力、基础属性与装备' },
  martial: { title: '武学', desc: '查看可学习与已掌握的武功' },
  items: { title: '背包', desc: '背包、秘籍和后续道具' },
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
    this.overlay.className = 'player-overlay player-status-overlay';
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = `
      <div class="player-card player-status-card">
        <button class="player-close player-status-close" type="button" aria-label="关闭玩家面板">×</button>
        <div class="player-status-head">
          <span class="player-status-cloud left"></span>
          <div class="player-status-title">个人状态</div>
          <span class="player-status-cloud right"></span>
        </div>
        <div class="player-card-body"></div>
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
    const editNameButton = target?.closest<HTMLButtonElement>('[data-edit-player-name]');
    if (editNameButton) {
      this.editPlayerName();
      return;
    }

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
    this.body.innerHTML = this.renderJianghuDashboard();
  }

  private renderTabButton(tab: PlayerPanelTab): string {
    const meta = TAB_LABELS[tab];
    return `
      <button class="${this.activeTab === tab ? 'active' : ''}" type="button" data-player-tab="${tab}">
        ${meta.title}
      </button>
    `;
  }

  private renderJianghuDashboard(): string {
    return `
      <div class="jianghu-dashboard">
        ${this.renderStatusColumn()}
        ${this.renderInventoryColumn()}
        ${this.renderMartialColumn()}
      </div>
    `;
  }

  private renderStatusColumn(): string {
    const progress = this.store.playerProgress;
    const combat = buildPlayerCombatDisplayModel(progress);
    const vitals = progress.vitals;
    const factionName = this.getFactionName();
    const learnedCount = progress.manuals.filter(manual => manual.learned).length;
    const martialScore = progress.martials.reduce((sum, martial) => sum + martial.level, 0);
    const level = Math.max(1, learnedCount * 4 + martialScore + Math.floor(progress.attributes.attack / 10));
    const statRows = [
      { icon: '◆', label: '力量', value: combat.attributeCards.find(card => card.label === '力量')?.value ?? String(progress.attributes.attack) },
      { icon: '盾', label: '防御', value: combat.battleCards.find(card => card.label === '防御力')?.value ?? String(progress.attributes.defense) },
      { icon: '悟', label: '悟性', value: combat.attributeCards.find(card => card.label === '智力')?.value ?? String(progress.attributes.understanding) },
      { icon: '身', label: '身法', value: combat.attributeCards.find(card => card.label === '敏捷')?.value ?? String(progress.attributes.speed) },
      { icon: '命', label: '命中', value: combat.battleCards.find(card => card.label === '命中率')?.value ?? '100%' },
      { icon: '闪', label: '闪避', value: combat.battleCards.find(card => card.label === '闪避率')?.value ?? '0%' },
      { icon: '缘', label: '福缘', value: String(progress.attributes.fortune) },
    ];

    return `
      <section class="jianghu-column jianghu-identity">
        <div class="jianghu-section-title"><span></span>人物属性<span></span></div>
        <div class="jianghu-hero-card">
          <div class="jianghu-name-ribbon">${this.escapeHtml(factionName)}</div>
          <img class="jianghu-portrait" src="assets/battle/characters/player/cutout/idle.png" alt="${this.escapeHtml(progress.identity.name)}" draggable="false">
          <div class="jianghu-id-lines">
            <p class="jianghu-name-line"><span>姓名：</span><b>${this.escapeHtml(progress.identity.name)}</b><button type="button" data-edit-player-name aria-label="修改姓名">改名</button></p>
            <p><span>门派：</span><b>${this.escapeHtml(factionName)}</b></p>
            <p><span>等级：</span><b>${level}级</b></p>
          </div>
          <div class="jianghu-top-attrs">
            <div><span>力量</span><b>${this.escapeHtml(statRows[0].value)}</b></div>
            <div><span>防御</span><b>${this.escapeHtml(statRows[1].value)}</b></div>
            <div><span>悟性</span><b>${this.escapeHtml(statRows[2].value)}</b></div>
            <div><span>身法</span><b>${this.escapeHtml(statRows[3].value)}</b></div>
            <div><span>福缘</span><b>${this.escapeHtml(statRows[6].value)}</b></div>
          </div>
          ${this.renderVital('生命', vitals.hp, vitals.maxHp, '#d8574f')}
          ${this.renderVital('内力', vitals.mp, vitals.maxMp, '#4c9fd8')}
        </div>
        <div class="jianghu-derived-attrs">
          <div><span>命中</span><b>${this.escapeHtml(statRows[4].value)}</b></div>
          <div><span>闪避</span><b>${this.escapeHtml(statRows[5].value)}</b></div>
          <div><span>元宝</span><b>${progress.currencies.yuanbao}</b></div>
        </div>
      </section>
    `;
  }

  private renderInventoryColumn(): string {
    const progress = this.store.playerProgress;
    const manualItemIds = new Set(
      progress.manuals
        .map(manual => getPlayerManualDef(manual.manualId)?.itemId)
        .filter((itemId): itemId is string => Boolean(itemId)),
    );
    const itemCells = [
      ...progress.manuals.map(manual => ({ kind: 'manual' as const, id: manual.manualId, count: 1 })),
      ...progress.inventory
        .filter(stack => !manualItemIds.has(stack.itemId))
        .map(stack => ({ kind: 'item' as const, id: stack.itemId, count: stack.count })),
    ];
    const firstItem = itemCells[0];
    const detail = firstItem ? this.renderInventoryDetail(firstItem) : '<p>背包还是空的。先在小屋或江湖中寻找物品。</p>';
    const cells = Array.from({ length: Math.max(20, itemCells.length) }, (_, index) => itemCells[index]);

    return `
      <section class="jianghu-column jianghu-bag">
        <div class="jianghu-section-title"><span></span>物品背包<span></span></div>
        <div class="jianghu-filter-row"><button class="active">全部</button><button>装备</button><button>消耗</button><button>材料</button><button>任务</button><button>其他</button></div>
        <div class="jianghu-bag-grid">
          ${cells.map(cell => cell ? this.renderBagCell(cell) : '<div class="jianghu-bag-cell empty"></div>').join('')}
        </div>
        <div class="jianghu-item-detail">
          ${detail}
        </div>
        <div class="jianghu-bag-foot"><span>背包容量：${itemCells.length}/60</span><button class="jianghu-primary" type="button">整理背包</button></div>
      </section>
    `;
  }

  private renderBagCell(cell: { kind: 'item' | 'manual'; id: string; count: number }): string {
    if (cell.kind === 'manual') {
      const manual = getPlayerManualDef(cell.id);
      const learned = this.store.playerProgress.manuals.find(item => item.manualId === cell.id)?.learned ?? false;
      const displayName = manual?.name ?? cell.id;
      return `
        <div class="jianghu-bag-cell manual" title="${this.escapeHtml(manual?.name ?? cell.id)}">
          ${learned ? '<em class="jianghu-learned-tag">已学</em>' : ''}
          <img src="${ITEM_FALLBACK_ICON}" alt="" draggable="false">
          <small>${this.escapeHtml(displayName)}</small>
          <b>${cell.count}</b>
        </div>
      `;
    }
    const item = getPlayerItemDef(cell.id);
    const displayName = item?.name ?? cell.id;
    return `
      <div class="jianghu-bag-cell" title="${this.escapeHtml(item?.name ?? cell.id)}">
        <img src="${this.escapeHtml(item?.iconPath ?? ITEM_FALLBACK_ICON)}" alt="" draggable="false">
        <small>${this.escapeHtml(displayName)}</small>
        <b>${cell.count}</b>
      </div>
    `;
  }

  private renderInventoryDetail(cell: { kind: 'item' | 'manual'; id: string; count: number }): string {
    if (cell.kind === 'manual') {
      const manual = getPlayerManualDef(cell.id);
      const progress = this.store.playerProgress.manuals.find(item => item.manualId === cell.id);
      return `
        <img src="${ITEM_FALLBACK_ICON}" alt="" draggable="false">
        <div>
          <strong>${this.escapeHtml(manual?.name ?? cell.id)}</strong>
          <span>类型：武功秘籍 · ${progress?.learned ? '已研读' : '已获得'}</span>
          <p>${this.escapeHtml(manual?.description ?? cell.id)}</p>
        </div>
      `;
    }
    const item = getPlayerItemDef(cell.id);
    return `
      <img src="${this.escapeHtml(item?.iconPath ?? ITEM_FALLBACK_ICON)}" alt="" draggable="false">
      <div>
        <strong>${this.escapeHtml(item?.name ?? cell.id)}</strong>
        <span>类型：${this.escapeHtml(item ? this.getItemTypeLabel(item.type) : '未知')} · 数量 ${cell.count}</span>
        <p>${this.escapeHtml(item?.description ?? cell.id)}</p>
      </div>
      <button class="jianghu-abandon" type="button" data-abandon-item="${this.escapeHtml(cell.id)}">放弃</button>
    `;
  }

  private renderMartialColumn(): string {
    const progress = this.store.playerProgress;
    const learnedArts = PLAYER_MARTIAL_ARTS.filter(art => {
      const manualProgress = art.requiredManualId ? progress.manuals.find(item => item.manualId === art.requiredManualId) : undefined;
      const martialProgress = progress.martials.find(item => item.martialId === art.id);
      return art.innate || manualProgress?.learned || !!martialProgress;
    });

    return `
      <section class="jianghu-column jianghu-martial">
        <div class="jianghu-section-title"><span></span>所会武学<span></span></div>
        <div class="jianghu-martial-list">
          ${learnedArts.length > 0
            ? learnedArts.map(art => this.renderJianghuMartialRow(art)).join('')
            : '<div class="player-empty">尚未掌握武学。</div>'}
        </div>
      </section>
    `;
  }

  private renderJianghuMartialRow(art: typeof PLAYER_MARTIAL_ARTS[number]): string {
    const progress = this.store.playerProgress;
    const martialProgress = progress.martials.find(item => item.martialId === art.id);
    const level = martialProgress?.level ?? 1;
    const expText = level >= MARTIAL_LEVEL_MAX
      ? '满级'
      : `${martialProgress?.exp ?? 0}/${getMartialRequiredExp(level)}`;
    return `
      <article class="jianghu-martial-row learned">
        <div class="jianghu-book-icon">${this.escapeHtml(art.name.slice(0, 1))}</div>
        <div>
          <strong>${this.escapeHtml(art.name)}</strong>
          <p>熟练度 ${this.escapeHtml(expText)}</p>
        </div>
        <span class="jianghu-martial-level">第${level}重</span>
        <small>${art.innate ? '常驻' : '已掌握'}</small>
      </article>
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
    const combat = buildPlayerCombatDisplayModel(progress);
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
        <h4>资源</h4>
        <div class="player-attrs">
          <div><span>元宝</span><b>${progress.currencies.yuanbao}</b></div>
        </div>
      </section>

      <section class="player-section">
        <h4>规则锚点</h4>
        ${renderCombatCardGrid(combat.anchorCards, 'is-compact')}
        ${renderCombatNotes(combat.notes)}
      </section>

      <section class="player-section">
        <h4>人物四维</h4>
        ${renderCombatCardGrid(combat.attributeCards, 'is-compact')}
      </section>

      <section class="player-section">
        <h4>统一战斗属性</h4>
        ${renderCombatCardGrid(combat.battleCards, 'is-wide')}
      </section>

      <section class="player-section">
        <h4>成长底盘</h4>
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

      <section class="player-section">
        <h4>江湖关系</h4>
        ${this.renderNpcAffinities()}
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

  private renderNpcAffinities(): string {
    const affinities = Object.values(this.store.playerProgress.npcAffinities);
    if (affinities.length === 0) {
      return '<div class="player-empty">还没有建立明显关系。靠近 NPC 按 G 赠送元宝可提升好感。</div>';
    }

    return `
      <div class="player-list">
        ${affinities.map((affinity) => {
          const npc = NPC_DEFS.find(item => item.id === affinity.npcId);
          const strategy = this.store.getStrategy(affinity.npcId);
          return `
            <div class="player-list-item">
              <div>
                <strong>${this.escapeHtml(npc?.name ?? strategy?.name ?? affinity.npcId)}</strong>
                <span>${this.escapeHtml(this.getFavorStageLabel(affinity.favor))} · 已赠 ${affinity.giftedYuanbaoTotal} 元宝</span>
                <p>好感度 ${affinity.favor} · 赠礼 ${affinity.giftCount} 次</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private getFavorStageLabel(favor: number): string {
    if (favor >= 100) return '传功之交';
    if (favor >= 80) return '信任';
    if (favor >= 50) return '赏识';
    if (favor >= 20) return '点头之交';
    return '陌生';
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

  private editPlayerName(): void {
    const current = this.store.playerProgress.identity.name;
    const next = window.prompt('请输入主角姓名（最多 12 个字）', current);
    if (next === null) return;
    const changed = this.store.setPlayerName(next);
    if (!changed) this.refresh();
  }

  private getFactionName(): string {
    const title = this.store.playerProgress.identity.title?.trim();
    if (!title || title === '观察者') return '无门派';
    return title;
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
