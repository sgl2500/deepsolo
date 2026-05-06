import { STATE_LABELS, type EventEntry, type Strategy } from '../types';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';
import { renderStrategyLiveState, type StrategyLiveState } from './DetailPanel';

type StrategyProfileTab = 'profile' | 'strategy' | 'history';

const TAB_LABELS: Record<StrategyProfileTab, { title: string; desc: string }> = {
  profile: { title: '人物档案', desc: '身份、关系与门内定位' },
  strategy: { title: '策略', desc: '指标、运行状态与解释' },
  history: { title: '历史事件', desc: '该 NPC 的个人时间线' },
};

export class StrategyProfileOverlay {
  private root: HTMLDivElement;
  private currentStrategyId: string | null = null;
  private liveStateCache = new Map<string, StrategyLiveState | null>();
  private detailRequestToken = 0;
  private activeTab: StrategyProfileTab = 'profile';

  constructor(private eventBus: EventBus, private store: GameStore) {
    this.root = document.createElement('div');
    this.root.className = 'player-overlay strategy-profile-overlay';
    this.root.style.display = 'none';
    document.body.appendChild(this.root);

    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.eventBus.on('strategy:selected', (strategy: Strategy | null) => {
      if (strategy) {
        void this.show(strategy);
      } else {
        this.hide();
      }
    });

    this.eventBus.on('strategy:loaded', () => {
      this.refreshCurrent();
    });

    this.eventBus.on('strategy:state-changed', ({ id }) => {
      if (id === this.currentStrategyId) this.refreshCurrent();
    });

    this.eventBus.on('ui:refresh', () => {
      this.refreshCurrent();
    });

    this.eventBus.on('conv:open', () => {
      if (this.currentStrategyId) this.store.selectStrategy(null);
    });

    this.eventBus.on('scene:state-changed', ({ state }) => {
      if (state === 'battle' && this.currentStrategyId) {
        this.store.selectStrategy(null);
      }
    });

    window.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target === this.root) {
      this.store.selectStrategy(null);
      return;
    }

    const closeButton = target.closest<HTMLElement>('[data-action="close"]');
    if (closeButton) {
      this.store.selectStrategy(null);
      return;
    }

    const tabButton = target.closest<HTMLElement>('[data-tab]');
    if (!tabButton) return;
    const tab = tabButton.dataset.tab as StrategyProfileTab | undefined;
    if (!tab || tab === this.activeTab) return;
    this.activeTab = tab;
    this.refreshCurrent();
  }

  private refreshCurrent(): void {
    if (!this.currentStrategyId) return;
    const strategy = this.store.getStrategy(this.currentStrategyId);
    if (!strategy) {
      this.hide();
      return;
    }
    void this.show(strategy);
  }

  private async show(strategy: Strategy): Promise<void> {
    if (this.currentStrategyId !== strategy.id) {
      this.activeTab = 'profile';
    }
    this.currentStrategyId = strategy.id;

    const cached = this.liveStateCache.get(strategy.id) ?? null;
    const hasWorkspaceState = Boolean(strategy.sourceWorkspace);
    this.render(strategy, cached, hasWorkspaceState && !this.liveStateCache.has(strategy.id));

    if (!hasWorkspaceState) return;

    const requestToken = ++this.detailRequestToken;
    const liveState = await this.fetchLiveState(strategy.id);
    this.liveStateCache.set(strategy.id, liveState);

    if (this.currentStrategyId !== strategy.id || this.detailRequestToken !== requestToken) return;
    this.render(strategy, liveState, false);
  }

  private hide(): void {
    this.currentStrategyId = null;
    this.activeTab = 'profile';
    this.root.style.display = 'none';
    this.root.innerHTML = '';
  }

  private render(strategy: Strategy, liveState: StrategyLiveState | null, loading: boolean): void {
    const history = this.getStrategyHistory(strategy);
    this.root.style.display = 'flex';
    this.root.innerHTML = `
      <div class="player-card strategy-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(strategy.name)}人物档案">
        <div class="player-card-head">
          <div>
            <div class="player-card-kicker">NPC 档案</div>
            <h2>${escapeHtml(strategy.name)}</h2>
          </div>
          <button class="player-close" type="button" data-action="close" aria-label="关闭人物面板">×</button>
        </div>
        <div class="player-card-body">
          <div class="player-layout">
            <aside class="player-tabs strategy-tabs" role="tablist" aria-label="人物档案页签">
              ${this.renderTabButton('profile')}
              ${this.renderTabButton('strategy')}
              ${this.renderTabButton('history')}
            </aside>
            <main class="player-tab-content">
              ${this.renderActiveTab(strategy, liveState, loading, history)}
            </main>
          </div>
        </div>
        <div class="player-card-foot strategy-card-foot">
          <span>T 查看人物档案</span>
          <span>空格仍可与该人物对话</span>
          <span>Esc 关闭档案</span>
        </div>
      </div>
    `;
  }

  private renderTabButton(tab: StrategyProfileTab): string {
    const meta = TAB_LABELS[tab];
    return `
      <button class="${this.activeTab === tab ? 'active' : ''}" type="button" data-tab="${tab}" role="tab" aria-selected="${this.activeTab === tab ? 'true' : 'false'}">
        <strong>${escapeHtml(meta.title)}</strong>
        <span>${escapeHtml(meta.desc)}</span>
      </button>
    `;
  }

  private renderActiveTab(
    strategy: Strategy,
    liveState: StrategyLiveState | null,
    loading: boolean,
    history: EventEntry[],
  ): string {
    switch (this.activeTab) {
      case 'strategy':
        return this.renderStrategyTab(strategy, liveState, loading);
      case 'history':
        return this.renderHistoryTab(history);
      case 'profile':
      default:
        return this.renderProfileTab(strategy);
    }
  }

  private renderProfileTab(strategy: Strategy): string {
    return `
      <section class="player-profile">
        <div class="player-avatar strategy-avatar">${escapeHtml(getSealText(strategy))}</div>
        <div>
          <h3>${escapeHtml(strategy.name)}</h3>
          <p>${escapeHtml(strategy.role ?? '门内成员')} · ${escapeHtml(STATE_LABELS[strategy.state])}${strategy.mode ? ` · ${escapeHtml(strategy.mode)}` : ''}</p>
        </div>
      </section>

      <section class="player-section">
        <h4>人物档案</h4>
        <p class="strategy-panel-copy">${escapeHtml(strategy.description)}</p>
      </section>

      <section class="player-section">
        <h4>身份索引</h4>
        <div class="strategy-meta-grid">
          ${renderMetaCard('门内身份', strategy.role ?? '未设定')}
          ${renderMetaCard('策略类别', getCategoryLabel(strategy.category))}
          ${renderMetaCard('当前状态', STATE_LABELS[strategy.state])}
          ${renderMetaCard('驻扎地点', strategy.buildingId ?? '未配置')}
          ${strategy.sourceWorkspace ? renderMetaCard('策略源', strategy.sourceWorkspace) : ''}
          ${strategy.mode ? renderMetaCard('运行模式', strategy.mode) : ''}
        </div>
      </section>

      ${strategy.parents?.length ? `
        <section class="player-section">
          <h4>传承关系</h4>
          <p class="strategy-panel-copy">${escapeHtml(strategy.relation ?? '承袭')}: ${escapeHtml(strategy.parents.join(' + '))}</p>
        </section>
      ` : ''}

      <section class="player-section">
        <h4>观察建议</h4>
        <p class="strategy-panel-copy">${escapeHtml(getObservation(strategy))}</p>
      </section>

      <section class="player-section">
        <h4>人物定位</h4>
        <p class="strategy-panel-copy">${escapeHtml(getRoleSummary(strategy))}</p>
      </section>
    `;
  }

  private renderStrategyTab(strategy: Strategy, liveState: StrategyLiveState | null, loading: boolean): string {
    return `
      <section class="player-profile">
        <div class="player-avatar strategy-avatar">${escapeHtml(getSealText(strategy))}</div>
        <div>
          <h3>${escapeHtml(strategy.name)}</h3>
          <p>${escapeHtml(strategy.role ?? '门内成员')} · 当前查看策略运行状态</p>
        </div>
      </section>

      <section class="player-section">
        <h4>核心指标</h4>
        <div class="strategy-stat-grid">
          ${renderStatCard('收益率', formatSignedPercent(strategy.returnPct), strategy.returnPct >= 0 ? 'is-pos' : 'is-neg')}
          ${renderStatCard('最大回撤', `-${strategy.maxDrawdownPct}%`, 'is-neg')}
          ${renderStatCard('胜率', `${strategy.winRate}%`)}
          ${renderStatCard('交易数', `${strategy.totalTrades}`)}
          ${renderStatCard('均笔收益', `${strategy.avgReturnPct}%`, strategy.avgReturnPct >= 0 ? 'is-pos' : 'is-neg')}
          ${renderStatCard('资金规模', `¥${strategy.capital.toLocaleString()}`)}
        </div>
      </section>

      <section class="player-section">
        <h4>运行状态</h4>
        ${renderStrategyLiveState(liveState, loading, 'modal')}
      </section>

      <section class="player-section">
        <h4>策略说明</h4>
        <p class="strategy-panel-copy">${escapeHtml(getStrategySummary(strategy))}</p>
      </section>
    `;
  }

  private renderHistoryTab(history: EventEntry[]): string {
    const historyHtml = history.length > 0
      ? history.map((entry) => renderHistoryEntry(entry)).join('')
      : '<div class="player-empty">该人物目前还没有记录到独立事件。</div>';

    return `
      <section class="player-section">
        <h4>个人事件时间线</h4>
        <div class="player-list strategy-history-list">${historyHtml}</div>
      </section>
    `;
  }

  private getStrategyHistory(strategy: Strategy): EventEntry[] {
    return this.store.eventLog.filter((entry) => entry.agentName === strategy.name);
  }

  private async fetchLiveState(agentId: string): Promise<StrategyLiveState | null> {
    try {
      const resp = await fetch(`./data/agents/${agentId}/live_state.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) return null;
      const payload = await resp.json();
      return payload && typeof payload === 'object' ? payload as StrategyLiveState : null;
    } catch {
      return null;
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.currentStrategyId) return;
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.store.selectStrategy(null);
  };
}

function renderMetaCard(label: string, value: string): string {
  return `
    <div class="strategy-meta-card">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function renderStatCard(label: string, value: string, extraClass = ''): string {
  return `
    <div class="strategy-stat-card ${extraClass}">
      <span>${escapeHtml(label)}</span>
      <b>${escapeHtml(value)}</b>
    </div>
  `;
}

function renderHistoryEntry(entry: EventEntry): string {
  return `
    <article class="player-list-item strategy-history-item">
      <div class="strategy-history-meta">
        <strong>${escapeHtml(entry.time)}</strong>
        <span>${escapeHtml(getHistoryLabel(entry.text))}</span>
      </div>
      <div class="strategy-history-body">
        <p>${escapeHtml(entry.text)}</p>
      </div>
    </article>
  `;
}

function getSealText(strategy: Strategy): string {
  if (strategy.role?.trim()) return strategy.role.trim().slice(0, 1);
  if (strategy.name.trim()) return strategy.name.trim().slice(0, 1);
  return '策';
}

function getCategoryLabel(category: Strategy['category']): string {
  switch (category) {
    case 'hot':
      return '热度';
    case 'emerged':
      return '涌现';
    default:
      return '普通';
  }
}

function getHistoryLabel(text: string): string {
  if (text.includes('天道')) return '审查';
  if (text.includes('诞生') || text.includes('新生')) return '诞生';
  if (text.includes('碰面') || text.includes('互补')) return '讨论';
  return '记录';
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

function getObservation(strategy: Strategy): string {
  if (strategy.sourceWorkspace) {
    return '该人物绑定独立策略工作区，角色状态与门派外部运行时同步，可作为长期观察对象。';
  }
  if (strategy.returnPct >= 20) {
    return '该人物当前表现强势，适合优先查看其收益结构与状态变化。';
  }
  if (strategy.maxDrawdownPct >= 20) {
    return '该人物回撤偏大，建议重点关注风险控制与最近的行为变化。';
  }
  return '该人物暂无外部运行时接入，主要展示当前游戏内策略表现。';
}

function getRoleSummary(strategy: Strategy): string {
  if (strategy.role?.includes('掌门')) {
    return '门派核心决策者，人物状态可以理解为该策略体系的对外化身。';
  }
  if (strategy.role?.includes('弟子')) {
    return '门内执行成员，更适合观察其成长曲线、稳定性与是否形成独立风格。';
  }
  return '该人物作为门内策略实体存在，适合结合事件和运行状态做持续观察。';
}

function getStrategySummary(strategy: Strategy): string {
  if (strategy.sourceWorkspace) {
    return '该策略与外部 workspace 同步，面板展示的实时状态、决策与持仓均来自独立运行时投影。';
  }
  return '该策略当前仍以游戏内数据为主，核心指标反映其在当前模拟环境中的整体表现。';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
