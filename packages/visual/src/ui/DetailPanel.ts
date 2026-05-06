// ============================================================
// DetailPanel.ts — 讨论实况面板 / 实时状态渲染工具
// ============================================================

import type { DiscussionGroup } from '../types';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

interface TurnRecord {
  agentName: string;
  text: string;
}

export interface StrategyLiveState {
  mode?: string;
  strategyName?: string;
  strategyVersion?: string;
  symbol?: string;
  timeframe?: string;
  capital?: number;
  equity?: number;
  realizedPnl?: number;
  positionsCount?: number;
  positionSummary?: string;
  updatedAt?: string;
  lastDecision?: {
    action?: string;
    confidence?: string;
    reason?: string;
    source?: string;
  };
}

export function renderStrategyLiveState(
  state: StrategyLiveState | null,
  loading = false,
  variant: 'compact' | 'modal' = 'compact',
): string {
  const rootClass = variant === 'modal' ? 'strategy-live strategy-live-modal' : 'strategy-live strategy-live-compact';
  if (loading) {
    return `<div class="${rootClass}"><div class="strategy-live-empty">正在读取门派实时状态...</div></div>`;
  }
  if (!state) {
    return `<div class="${rootClass}"><div class="strategy-live-empty">暂未同步到门派实时状态</div></div>`;
  }

  const pnl = safeNumber(state.realizedPnl);
  const pnlClass = pnl >= 0 ? 'pos' : 'neg';
  const pnlPrefix = pnl >= 0 ? '+' : '';
  const decision = state.lastDecision ?? {};

  return `
    <div class="${rootClass}">
      <div class="strategy-live-title">门派实时状态</div>
      <div class="row"><span>模式</span><span class="bold">${escapeHtml(state.mode ?? 'unknown')}</span></div>
      <div class="row"><span>标的</span><span class="bold">${escapeHtml(state.symbol ?? '未配置')}</span></div>
      <div class="row"><span>版本</span><span class="bold">${escapeHtml(state.strategyVersion ?? 'unknown')}</span></div>
      <div class="row"><span>权益</span><span class="bold">¥${safeNumber(state.equity).toLocaleString()}</span></div>
      <div class="row"><span>已实现盈亏</span><span class="bold ${pnlClass}">${pnlPrefix}${pnl.toLocaleString()}</span></div>
      <div class="row"><span>持仓数</span><span class="bold">${safeNumber(state.positionsCount, 0)}</span></div>
      <div class="strategy-live-note">持仓: ${escapeHtml(state.positionSummary ?? '空仓')}</div>
      <div class="strategy-live-note">最近决策: ${escapeHtml(decision.action ?? 'observe')} / ${escapeHtml(decision.reason ?? '等待信号')}</div>
      ${decision.confidence ? `<div class="strategy-live-note">决策置信度: ${escapeHtml(decision.confidence)}</div>` : ''}
      ${state.updatedAt ? `<div class="strategy-live-foot">同步时间: ${escapeHtml(state.updatedAt)}</div>` : ''}
    </div>
  `;
}

export class DetailPanel {
  private el: HTMLElement;
  private currentGroupId: string | null = null;
  private turns: TurnRecord[] = [];

  constructor(container: HTMLElement, eventBus: EventBus, _store: GameStore) {
    this.el = container;
    this.showPlaceholder();

    eventBus.on('discussion:view', (group: DiscussionGroup) => {
      this.showDiscussion(group);
    });

    eventBus.on('discussion:started', () => {
      this.turns = [];
      this.refreshDiscussion();
    });

    eventBus.on('discussion:turn', (data: { groupId: string; agentName: string; text: string }) => {
      if (data.groupId === this.currentGroupId) {
        this.turns.push({ agentName: data.agentName, text: data.text });
        this.refreshDiscussion();
      }
    });

    eventBus.on('discussion:ended', (data: { groupId: string }) => {
      if (data.groupId !== this.currentGroupId) return;
      this.currentGroupId = null;
      this.turns = [];
      this.showPlaceholder();
    });
  }

  showDiscussion(group: DiscussionGroup): void {
    this.currentGroupId = group.id;
    this.refreshDiscussion();
  }

  private refreshDiscussion(): void {
    if (!this.currentGroupId) {
      this.showPlaceholder();
      return;
    }

    const status = this.turns.length > 0
      ? '<div class="detail-note">讨论进行中，新的推演会实时追加。</div>'
      : '<div class="detail-note">讨论进行中...</div>';

    const lines = this.turns.map((turn) => `
      <div class="detail-turn">
        <b>${escapeHtml(turn.agentName)}</b>
        <span>${escapeHtml(turn.text)}</span>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="detail-discussion-head">
        <span class="tag tag-emrg">讨论</span>
        <b>讨论实况</b>
      </div>
      ${status}
      <div class="detail-turns">${lines}</div>
    `;
  }

  private showPlaceholder(): void {
    this.el.innerHTML = `
      <div class="detail-placeholder">
        人物查看已改为弹窗<br />
        讨论开始后会在这里显示实况
      </div>
    `;
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
