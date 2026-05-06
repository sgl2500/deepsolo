import type { DialogueTree } from '../types';

/**
 * 对话脚本 — NPC 对话内容定义
 *
 * 每个对话是一个树结构，节点间通过 next/choices 连接
 * 无 next 且无 choices 的节点为终端节点（对话结束）
 */
export const DIALOGUE_SCRIPTS: Record<string, DialogueTree> = {
  birth_guide: {
    id: 'birth_guide',
    firstNode: 'welcome',
    nodes: {
      welcome: {
        id: 'welcome',
        speaker: '引路人',
        portraitKey: '1',
        text: '欢迎来到策略世界，新人。\n我是这里的引路人——说白了，我就是那个收益最低的策略。\n正因为亏过，所以我最清楚什么不该做。\n在这个世界里，每个角色都是一个交易策略。',
        next: 'what_to_do',
      },
      what_to_do: {
        id: 'what_to_do',
        speaker: '引路人',
        portraitKey: '1',
        text: '在这个世界，你可以做这些事：\n· 走近 NPC 按空格键对话，了解他们的策略思路\n· 走进建筑探索，比如策略茶馆、证券交易所\n· 按 B 键可以触发策略之间的切磋战斗\n· 观察地图上策略的收益变化，理解什么策略有效',
        choices: [
          { text: '懂了，我准备好了', next: 'go_out' },
          { text: '再说一遍', next: 'what_to_do' },
        ],
      },
      go_out: {
        id: 'go_out',
        speaker: '引路人',
        portraitKey: '1',
        text: '好，出门往南走，就是策略世界的全貌。\n记住，观察是最好的老师。\n有空回来找我，我会告诉你我踩过的坑。',
      },
    },
  },

  broker_wang_intro: {
    id: 'broker_wang_intro',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '王经纪',
        portraitKey: '0',
        text: '欢迎来到证券交易所。\n有什么想了解的吗？',
        choices: [
          { text: '目前市场怎么样？', next: 'market' },
          { text: '给我推荐个策略', next: 'recommend' },
          { text: '我先走了', next: 'bye' },
        ],
      },
      market: {
        id: 'market',
        speaker: '王经纪',
        portraitKey: '0',
        text: '今天大盘偏强，追涨策略表现突出。\n人气追涨收益率达到了 28.8%！',
        next: 'market2',
      },
      market2: {
        id: 'market2',
        speaker: '王经纪',
        portraitKey: '0',
        text: '不过要注意风险，妖股追涨最近亏了 5.5%。\n建议控制仓位，严格止损。',
        next: 'bye',
      },
      recommend: {
        id: 'recommend',
        speaker: '王经纪',
        portraitKey: '0',
        text: '分时大票追涨这个策略不错，\n收益 73.7%，最大回撤才 17.6%。\n是当前表现最好的策略之一。',
        next: 'bye',
      },
      bye: {
        id: 'bye',
        speaker: '王经纪',
        portraitKey: '0',
        text: '祝你交易顺利！有需要随时来找我。',
      },
    },
  },

  analyst_li_intro: {
    id: 'analyst_li_intro',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '李分析师',
        portraitKey: '1',
        text: '你好，我是李分析师，专门研究策略进化。\n有什么想探讨的？',
        choices: [
          { text: '什么是策略进化？', next: 'explain' },
          { text: '最近有新策略吗？', next: 'new_strategy' },
          { text: '不需要了', next: 'bye' },
        ],
      },
      explain: {
        id: 'explain',
        speaker: '李分析师',
        portraitKey: '1',
        text: '策略进化就是通过杂交和变异来产生新策略。\n融合一号就是"人气追涨"和"分时大票追涨"的杂交产物。\n收益达到了 35.2%！',
        next: 'bye',
      },
      new_strategy: {
        id: 'new_strategy',
        speaker: '李分析师',
        portraitKey: '1',
        text: '变异二号刚完成参数优化，\n基于上影线追涨改良而来。\n目前收益 8.4%，回撤控制得不错。',
        next: 'bye',
      },
      bye: {
        id: 'bye',
        speaker: '李分析师',
        portraitKey: '1',
        text: '研究不息，进化不止。回见！',
      },
    },
  },

  master_chen_intro: {
    id: 'master_chen_intro',
    firstNode: 'start',
    nodes: {
      start: {
        id: 'start',
        speaker: '陈掌柜',
        portraitKey: '10',
        text: '客官请坐，来杯策略茶？\n这里可是各路策略高手切磋的地方。',
        choices: [
          { text: '给我来一杯', next: 'tea' },
          { text: '这里都在讨论什么？', next: 'discuss' },
          { text: '下次再来', next: 'bye' },
        ],
      },
      tea: {
        id: 'tea',
        speaker: '陈掌柜',
        portraitKey: '10',
        text: '好嘞！这杯是"夏普比率特调"。\n喝了能看穿一切策略的风险收益比。\n不过别喝太多，小心过度拟合！',
        next: 'bye',
      },
      discuss: {
        id: 'discuss',
        speaker: '陈掌柜',
        portraitKey: '10',
        text: '最近大家都在讨论银行板块值不值得关注。\n有人说大盘放量了，也有人觉得科技股更有机会。\n你可以在地图上找讨论中的策略，听听他们的看法。',
        next: 'bye',
      },
      bye: {
        id: 'bye',
        speaker: '陈掌柜',
        portraitKey: '10',
        text: '慢走啊客官，欢迎下次再来！',
      },
    },
  },
};
