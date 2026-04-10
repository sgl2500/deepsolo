// ============================================================
// DetailPanel.ts — 策略详情面板
// ============================================================

import { STATE_LABELS, type Strategy } from '../types';
import type { EventBus } from '../core/EventBus';
import type { GameStore } from '../core/GameStore';

export class DetailPanel {
  private el: HTMLElement;
  private store: GameStore;

  constructor(container: HTMLElement, eventBus: EventBus, store: GameStore) {
    this.el = container;
    this.store = store;

    eventBus.on('strategy:selected', (strategy: Strategy | null) => {
      if (strategy) {
        this.showDetail(strategy);
      } else {
        this.showPlaceholder();
      }
    });
  }

  private showDetail(s: Strategy): void {
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
