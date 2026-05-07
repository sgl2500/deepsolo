// ============================================================
// StoryScripts.ts — 声明式故事脚本数据
// ============================================================
//
// 添加新剧情只需在此文件追加脚本对象，无需改代码。
// ============================================================

import type { StoryScript } from '../types';

/** 传功剧情（首次）—— 在策略茶馆遇见高收益策略传授心法 */
const teahouseSkillTransfer: StoryScript = {
  id: 'teahouse_skill_transfer',
  trigger: {
    sceneState: 'indoor',
    buildingId: 'teahouse',
    conditions: [
      { type: 'strategy_exists', params: { strategyId: 'hv4' } },
      { type: 'strategy_return_gt', params: { strategyId: 'hv4', threshold: 50 } },
      { type: 'never_completed', params: { storyId: 'teahouse_skill_transfer' } },
    ],
  },
  priority: 10,
  firstNode: 'start',
  nodes: {
    start: {
      id: 'start',
      speaker: '陈掌柜',
      portraitKey: '10',
      text: '今天来了位高手，说是有一套分时大票追涨心法，想找个有缘人传授。你要不要过去看看？',
      choices: [
        { text: '过去看看', next: 'approach' },
        { text: '下次再说', next: 'decline_early', onSelect: [{ type: 'add_event_log', params: { agentName: '观察者', text: '婉拒了传功高人' } }] },
      ],
    },
    approach: {
      id: 'approach',
      speaker: '传功高人',
      portraitKey: '1',
      text: '年轻人，我看你骨骼精奇，是块做量化交易的好料子。我有一套分时大票追涨心法，累积盈利超过百分之七十，想传授于你。',
      choices: [
        {
          text: '请前辈赐教',
          next: 'accept',
          onSelect: [{ type: 'set_flag', params: { flag: 'learning_hv4' } }],
        },
        { text: '容我考虑考虑', next: 'polite_decline' },
      ],
    },
    accept: {
      id: 'accept',
      speaker: '传功高人',
      portraitKey: '1',
      text: '好！这套心法讲究三个要点：第一，竞价阶段就要有敏锐的嗅觉，捕捉大资金的动向；第二，分时图上要观察量价配合，确认主力意图；第三，纪律严明，次日无论盈亏果断出场。',
      next: 'accept_2',
    },
    accept_2: {
      id: 'accept_2',
      speaker: '传功高人',
      portraitKey: '1',
      text: '记住，知行合一才是最高境界。策略再好，执行不到位也是白费。控制仓位，敬畏市场，方能长存。',
      next: 'accept_3',
    },
    accept_3: {
      id: 'accept_3',
      speaker: '陈掌柜',
      portraitKey: '10',
      text: '恭喜你获得分时大票追涨心法！好好修炼，日后必成大器。',
    },
    polite_decline: {
      id: 'polite_decline',
      speaker: '传功高人',
      portraitKey: '1',
      text: '不急，等你准备好了再来找我。修心也是修行的一部分。',
    },
    decline_early: {
      id: 'decline_early',
      speaker: '陈掌柜',
      portraitKey: '10',
      text: '也好，不勉强。那位高人应该会在茶馆待一段时间。',
    },
  },
  onComplete: [
    { type: 'set_flag', params: { flag: 'learned_hv4_transfer' } },
    { type: 'mark_completed', params: { storyId: 'teahouse_skill_transfer' } },
    { type: 'add_event_log', params: { agentName: '观察者', text: '在策略茶馆习得分时大票追涨心法' } },
  ],
};

/** 传功后续——再次遇见传功高人 */
const teahouseTransferFollowup: StoryScript = {
  id: 'teahouse_transfer_followup',
  trigger: {
    sceneState: 'indoor',
    buildingId: 'teahouse',
    conditions: [
      { type: 'flag_is', params: { flag: 'learned_hv4_transfer', value: true } },
    ],
    oncePerVisit: true,
  },
  priority: 5,
  firstNode: 'greeting',
  nodes: {
    greeting: {
      id: 'greeting',
      speaker: '传功高人',
      portraitKey: '1',
      text: '上次教你的心法领悟得如何？有没有什么心得？',
      choices: [
        { text: '收益不错', next: 'good_report' },
        { text: '还在研究', next: 'encourage' },
      ],
    },
    good_report: {
      id: 'good_report',
      speaker: '传功高人',
      portraitKey: '1',
      text: '不错不错！不过记住，策略要与时俱进。市场在变，你的心法也要不断精进。',
    },
    encourage: {
      id: 'encourage',
      speaker: '传功高人',
      portraitKey: '1',
      text: '不急，先做好风控。能活下来的策略，才是好策略。有什么不明白的随时来找我。',
    },
  },
};

/** 好感传功——陈掌柜收下元宝后传授吐纳入门 */
const masterChenFavorGiftTuna: StoryScript = {
  id: 'master_chen_favor_gift_tuna',
  trigger: {
    event: 'npc_favor_changed',
    npcId: 'master_chen',
    conditions: [
      { type: 'npc_favor_gte', params: { npcId: 'master_chen', favor: 80 } },
      { type: 'manual_not_owned', params: { manualId: 'manual_tuna_intro' } },
      { type: 'flag_not_set', params: { flag: 'master_chen_gave_tuna' } },
    ],
  },
  priority: 20,
  firstNode: 'start',
  nodes: {
    start: {
      id: 'start',
      speaker: '陈掌柜',
      portraitKey: '10',
      text: '客官这些日子的心意，我都记下了。江湖讲缘分，也讲诚意。你既然愿意常来坐坐，我也不能只收你的茶钱。',
      next: 'teach',
    },
    teach: {
      id: 'teach',
      speaker: '陈掌柜',
      portraitKey: '10',
      text: '这本《吐纳入门》你拿去。它不是什么惊天动地的神功，却能帮你稳住内息。做策略也一样，先学会活得久，再谈赢得多。',
    },
  },
  onComplete: [
    { type: 'grant_manual', params: { manualId: 'manual_tuna_intro', manualName: '吐纳入门', agentName: '陈掌柜' } },
    { type: 'set_flag', params: { flag: 'master_chen_gave_tuna', value: true } },
    { type: 'mark_completed', params: { storyId: 'master_chen_favor_gift_tuna' } },
    { type: 'add_event_log', params: { agentName: '陈掌柜', text: '因好感深厚传授《吐纳入门》' } },
  ],
};

/** 数字门派掌门好感传功 */
const digitalMasterFavorGiftFumo: StoryScript = {
  id: 'digital_master_favor_gift_fumo',
  trigger: {
    event: 'npc_favor_changed',
    npcId: 'digital_master',
    conditions: [
      { type: 'npc_favor_gte', params: { npcId: 'digital_master', favor: 80 } },
      { type: 'manual_not_owned', params: { manualId: 'manual_digital_fumo_intro' } },
      { type: 'flag_not_set', params: { flag: 'digital_master_gave_fumo' } },
    ],
  },
  priority: 30,
  firstNode: 'start',
  nodes: {
    start: {
      id: 'start',
      speaker: '数字掌门',
      portraitKey: '1',
      text: '你多次以元宝供养本门运行，我已看见。数字门不重虚礼，只看长期投入与真实回撤。你的诚意，够了。',
      next: 'teach',
    },
    teach: {
      id: 'teach',
      speaker: '数字掌门',
      portraitKey: '1',
      text: '这本《金刚伏魔入门》给你。记住，实盘里的第一神功不是暴利，而是护住本金。心不乱，仓不乱，回撤自然不乱。',
    },
  },
  onComplete: [
    { type: 'grant_manual', params: { manualId: 'manual_digital_fumo_intro', manualName: '金刚伏魔入门', agentName: '数字掌门' } },
    { type: 'set_flag', params: { flag: 'digital_master_gave_fumo', value: true } },
    { type: 'mark_completed', params: { storyId: 'digital_master_favor_gift_fumo' } },
    { type: 'add_event_log', params: { agentName: '数字掌门', text: '因好感深厚传授《金刚伏魔入门》' } },
  ],
};

/** 所有故事脚本（按 priority 降序排列） */
const TEAHOUSE_ENTRY_STORIES_ENABLED = false;

export const STORY_SCRIPTS: StoryScript[] = [
  digitalMasterFavorGiftFumo,
  masterChenFavorGiftTuna,
  // 策略茶馆搭建阶段先关闭“进门自动剧情”，保留靠近 NPC 按空格的手动对话。
  ...(TEAHOUSE_ENTRY_STORIES_ENABLED ? [teahouseSkillTransfer, teahouseTransferFollowup] : []),
].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
