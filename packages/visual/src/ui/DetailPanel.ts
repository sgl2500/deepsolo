// ============================================================
// DetailPanel.ts — 策略详情 / 讨论实况面板
// ============================================================

import { STATE_LABELS, TOPIC_LABELS, type Strategy, type DiscussionGroup } from '../types';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

interface TurnRecord {
  agentName: string;
  text: string;
}

export class DetailPanel {
  private el: HTMLElement;
  private store: GameStore;
  private eventBus: EventBus;

  // 讨论实况状态
  private currentGroupId: string | null = null;
  private turns: TurnRecord[] = [];

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore) {
    this.el = container;
    this.store = store;
    this.eventBus = eventBus;

    eventBus.on('strategy:selected', (strategy: Strategy | null) => {
      if (strategy) {
        this.showDetail(strategy);
      } else {
        this.showPlaceholder();
      }
    });

    // 讨论实况
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
      if (data.groupId === this.currentGroupId) {
        this.currentGroupId = null;
        this.turns = [];
        // 恢复到选中策略的详情
        const sel = this.store.getSelectedStrategy();
        if (sel) this.showDetail(sel);
        else this.showPlaceholder();
      }
    });
  }

  /** 切换到讨论实况视图 */
  showDiscussion(group: DiscussionGroup): void {
    this.currentGroupId = group.id;
    this.refreshDiscussion();
  }

  private refreshDiscussion(): void {
    if (!this.currentGroupId) return;

    const group = this.turns.length > 0 ? '' : '<div style="font-size:9px;color:var(--text2);margin-bottom:4px">讨论进行中...</div>';

    const lines = this.turns.map(t =>
      `<div style="margin:2px 0"><b style="color:var(--blue)">${t.agentName}</b>: <span style="color:var(--text2)">${t.text}</span></div>`
    ).join('');

    this.el.innerHTML = `
      <div style="margin-bottom:4px">
        <span class="tag tag-emrg">讨论</span>
        <b style="color:var(--text)">讨论实况</b>
      </div>
      ${group}
      <div style="font-size:9px;max-height:200px;overflow-y:auto">${lines}</div>
    `;
  }

  private showDetail(s: Strategy): void {
    this.currentGroupId = null;
    const tag = this.getTag(s.category);
    const rc = s.returnPct >= 0 ? 'pos' : 'neg';
    const prefix = s.returnPct >= 0 ? '+' : '';

    this.el.innerHTML = `
      <div style="margin-bottom:3px">${tag} <b style="color:var(--text)">${s.name}</b></div>
      <div style="font-size:9px;margin-bottom:3px">${s.description}</div>
      <div class="row"><span>收益率</span><span class="bold ${rc}">${prefix}${s.returnPct}%</span></div>
      <div class="row"><span>回撤</span><span class="bold neg">-${s.maxDrawdownPct}%</span></div>
      <div class="row"><span>交易数</span><span class="bold">${s.totalTrades}</span></div>
      <div class="row"><span>胜率</span><span class="bold">${s.winRate}%</span></div>
      <div class="row"><span>均笔收益</span><span class="bold ${s.avgReturnPct >= 0 ? 'pos' : 'neg'}">${s.avgReturnPct}%</span></div>
      <div class="row"><span>资金</span><span class="bold">¥${s.capital.toLocaleString()}</span></div>
      <div class="row"><span>状态</span><span class="bold">${STATE_LABELS[s.state]}</span></div>
      ${s.parents ? `<div style="margin-top:3px;color:var(--purple);font-size:9px">← ${s.relation}: ${s.parents.join('+')}</div>` : ''}
    `;
  }

  private showPlaceholder(): void {
    this.currentGroupId = null;
    this.el.innerHTML = '<div style="text-align:center;padding:8px;color:var(--text2)">点击角色查看</div>';
  }

  private getTag(category: string): string {
    switch (category) {
      case 'hot': return '<span class="tag tag-hot">热度</span>';
      case 'emerged': return '<span class="tag tag-emrg">涌现</span>';
      default: return '<span class="tag tag-norm">普通</span>';
    }
  }
}
