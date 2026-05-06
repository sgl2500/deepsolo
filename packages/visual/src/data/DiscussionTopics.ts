// ============================================================
// DiscussionTopics.ts — 话题库和对话模板
// ============================================================

import { DiscussionTopic, type DialogueLine, type Strategy } from '../types';

/** 对话模板行（发言前需要填充变量） */
interface TemplateLine {
  role: 'winner' | 'loser' | 'neutral';
  template: string;
}

/** 一组对话模板 */
interface DialogueTemplate {
  topic: DiscussionTopic;
  lines: TemplateLine[];
}

/** 变量替换：{name}, {returnPct}, {winRate}, {strategy} */
function fill(template: string, strategy: Strategy): string {
  return template
    .replace(/\{name\}/g, strategy.name)
    .replace(/\{returnPct\}/g, `${strategy.returnPct >= 0 ? '+' : ''}${strategy.returnPct.toFixed(1)}%`)
    .replace(/\{winRate\}/g, `${strategy.winRate.toFixed(1)}%`)
    .replace(/\{strategy\}/g, strategy.description.slice(0, 20));
}

/** 判断策略角色 */
function getRole(s: Strategy): 'winner' | 'loser' | 'neutral' {
  if (s.returnPct > 10) return 'winner';
  if (s.returnPct < 0) return 'loser';
  return 'neutral';
}

// ============================================================
// 话题模板库
// ============================================================

const TEMPLATES: DialogueTemplate[] = [
  // --- 大盘趋势 ---
  {
    topic: DiscussionTopic.MarketTrend,
    lines: [
      { role: 'winner', template: '最近大盘持续放量，我{name}的竞价选股信号变多了' },
      { role: 'loser', template: '是啊，但我{name}追进去总是被套，胜率才{winRate}' },
      { role: 'winner', template: '关键要看相对竞价强度，低于1.5%的不碰' },
      { role: 'neutral', template: '我觉得大盘趋势还行，但板块轮动太快了' },
      { role: 'winner', template: '同意，控制仓位比追热点更重要' },
    ],
  },
  {
    topic: DiscussionTopic.MarketTrend,
    lines: [
      { role: 'loser', template: '今天又亏了，{name}的信号在大盘弱势时不太灵' },
      { role: 'winner', template: '弱势行情确实难做，我也降低了开仓频率' },
      { role: 'neutral', template: '可以考虑加个大盘过滤条件，比如均线之上才操作' },
      { role: 'winner', template: '好建议！我回测一下加上均线过滤的效果' },
    ],
  },
  {
    topic: DiscussionTopic.MarketTrend,
    lines: [
      { role: 'neutral', template: '你们觉得下周大盘会怎么走？' },
      { role: 'winner', template: '从资金面看，北向资金连续流入，偏乐观' },
      { role: 'loser', template: '我比较谨慎，{name}的回撤{returnPct}让我不敢太激进' },
      { role: 'winner', template: '控制风险没错，保留实力等确定性机会' },
    ],
  },

  // --- 策略复盘 ---
  {
    topic: DiscussionTopic.StrategyReview,
    lines: [
      { role: 'winner', template: '我{name}最近表现不错，收益率{returnPct}' },
      { role: 'loser', template: '厉害！你主要靠什么指标选股的？' },
      { role: 'winner', template: '核心是竞价阶段的相对强度，配合分时确认' },
      { role: 'neutral', template: '我的综合版策略可以尝试融合你的竞价筛选' },
      { role: 'loser', template: '我也想试试，但我的止损规则可能需要先优化' },
    ],
  },
  {
    topic: DiscussionTopic.StrategyReview,
    lines: [
      { role: 'loser', template: '{name}这个月亏了不少，主要是追高被套' },
      { role: 'winner', template: '追高确实风险大，你可以试试等回调再进场' },
      { role: 'loser', template: '但回调进场容易错过行情啊，怎么平衡？' },
      { role: 'neutral', template: '可以用分时确认，突破前高再追也不迟' },
    ],
  },
  {
    topic: DiscussionTopic.StrategyReview,
    lines: [
      { role: 'winner', template: '我回顾了一下，胜率{winRate}的关键在于严格止损' },
      { role: 'neutral', template: '止损位设多少合适？' },
      { role: 'winner', template: '我设的是5%，到了就走，不犹豫' },
      { role: 'loser', template: '我之前总是舍不得割，结果越亏越多...' },
      { role: 'winner', template: '交易纪律比策略本身更重要' },
    ],
  },

  // --- 风控讨论 ---
  {
    topic: DiscussionTopic.RiskControl,
    lines: [
      { role: 'neutral', template: '大家最近回撤控制得怎么样？' },
      { role: 'winner', template: '我的最大回撤控制在合理范围，主要靠分散持仓' },
      { role: 'loser', template: '我{name}回撤太大了，经常单票重仓被套' },
      { role: 'winner', template: '建议单票不超过总仓位的20%' },
      { role: 'neutral', template: '对，仓位管理比选股更重要' },
    ],
  },
  {
    topic: DiscussionTopic.RiskControl,
    lines: [
      { role: 'loser', template: '连续亏损时怎么调整心态？' },
      { role: 'winner', template: '我会暂停交易一天，重新审视市场环境' },
      { role: 'neutral', template: '机械执行信号比较好，不要被情绪左右' },
      { role: 'loser', template: '说起来容易，做到很难啊' },
    ],
  },

  // --- 机会发现 ---
  {
    topic: DiscussionTopic.Opportunity,
    lines: [
      { role: 'winner', template: '我注意到科技板块最近异动明显' },
      { role: 'neutral', template: '对，尤其是半导体和AI方向，量能放大' },
      { role: 'winner', template: '{name}在这个板块的信号胜率比较高' },
      { role: 'loser', template: '那我关注一下科技方向的竞价机会' },
    ],
  },
  {
    topic: DiscussionTopic.Opportunity,
    lines: [
      { role: 'neutral', template: '最近次新股表现活跃，值得关注' },
      { role: 'winner', template: '是的，我{name}选出的次新股收益不错' },
      { role: 'loser', template: '次新股波动太大，我不太敢碰' },
      { role: 'winner', template: '控制好仓位就行，关键是竞价时的强势信号' },
      { role: 'neutral', template: '可以交叉验证，用多个信号同时确认' },
    ],
  },
  {
    topic: DiscussionTopic.Opportunity,
    lines: [
      { role: 'winner', template: '银行板块估值低，可能有修复行情' },
      { role: 'loser', template: '银行股涨太慢了，我的追涨策略不适合' },
      { role: 'neutral', template: '但防御性好，适合做底仓' },
      { role: 'winner', template: '策略要和行情匹配，不能一刀切' },
    ],
  },
];

// ============================================================
// 公共 API
// ============================================================

/**
 * 为讨论小组生成对话内容
 * @param topic 话题
 * @param strategies 参与者的策略数据
 * @returns 填充后的对话行
 */
export function generateDialogue(
  topic: DiscussionTopic,
  strategies: Strategy[],
): DialogueLine[] {
  // 筛选匹配话题的模板
  const candidates = TEMPLATES.filter(t => t.topic === topic);
  if (!candidates.length) return [];

  const template = candidates[Math.floor(Math.random() * candidates.length)];

  // 为每行模板选择一个策略来填充
  return template.lines.map(line => {
    // 优先选匹配角色的策略，否则随机
    let pool = strategies.filter(s => getRole(s) === line.role);
    if (!pool.length) pool = strategies;
    const s = pool[Math.floor(Math.random() * pool.length)];

    return {
      agentId: s.id,
      role: line.role,
      text: fill(line.template, s),
    };
  });
}

/** 随机选择一个话题 */
export function randomTopic(): DiscussionTopic {
  const topics = Object.values(DiscussionTopic);
  return topics[Math.floor(Math.random() * topics.length)];
}
