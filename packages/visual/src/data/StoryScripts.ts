// ============================================================
// StoryScripts.ts — 声明式故事脚本数据
// ============================================================
//
// 添加新剧情只需在此文件追加脚本对象，无需改代码。
// ============================================================

import type { StoryScript } from '../types';

/** 小屋出生提示——只播放主角自言自语，结束后交还控制权 */
const observerHouseArrivalPrompt: StoryScript = {
  id: 'observer_house_arrival_prompt',
  trigger: {
    sceneState: 'indoor',
    buildingId: 'birth_house',
    conditions: [
      { type: 'flag_not_set', params: { flag: 'story.observer_intro_prompt_seen' } },
      { type: 'flag_not_set', params: { flag: 'story.observer_awake' } },
    ],
  },
  priority: 110,
  firstNode: 'where_am_i',
  nodes: {
    where_am_i: {
      id: 'where_am_i',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '我怎么在这？',
      next: 'notice_person',
    },
    notice_person: {
      id: 'notice_person',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '旁边有个人……我过去问问。',
    },
  },
  onComplete: [
    { type: 'set_flag', params: { flag: 'story.observer_intro_prompt_seen', value: true } },
  ],
};

/** 小屋出生剧情——首次与股神对话 */
const observerHouseIntroWakeup: StoryScript = {
  id: 'observer_house_intro_wakeup',
  trigger: {
    event: 'manual',
    conditions: [
      { type: 'flag_is', params: { flag: 'story.observer_intro_prompt_seen', value: true } },
      { type: 'flag_not_set', params: { flag: 'story.observer_awake' } },
    ],
  },
  priority: 100,
  firstNode: 'wake',
  nodes: {
    wake: {
      id: 'wake',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '这是哪？',
      next: 'wake_market',
    },
    wake_market: {
      id: 'wake_market',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '我刚才不是还在看盘吗？',
      next: 'wake_blackout',
    },
    wake_blackout: {
      id: 'wake_blackout',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '指数突然跳水，我正准备撤单……然后眼前一黑。',
      next: 'wake_notice',
    },
    wake_notice: {
      id: 'wake_notice',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '那边有人。先问问他。',
      next: 'gushen_wake',
    },
    gushen_wake: {
      id: 'gushen_wake',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '醒了？',
      next: 'ask_identity',
    },
    ask_identity: {
      id: 'ask_identity',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '你是谁？这里是哪？',
      next: 'gushen_name',
    },
    gushen_name: {
      id: 'gushen_name',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '我叫股神。',
      next: 'player_doubt',
    },
    player_doubt: {
      id: 'player_doubt',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '……股神？',
      next: 'player_doubt_2',
    },
    player_doubt_2: {
      id: 'player_doubt_2',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '一般真正的股神，不会站在这种屋子里等人醒来。',
      next: 'gushen_jab',
    },
    gushen_jab: {
      id: 'gushen_jab',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '一般真正的交易者，也不会一根阴线就被送到这里。',
      next: 'not_dream',
    },
    not_dream: {
      id: 'not_dream',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '所以我真的不是在做梦？',
      next: 'drawdown',
    },
    drawdown: {
      id: 'drawdown',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '梦里不会有回撤。这里有。',
      next: 'market_memory',
    },
    market_memory: {
      id: 'market_memory',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '我刚才明明在交易。',
      next: 'gushen_knows',
    },
    gushen_knows: {
      id: 'gushen_knows',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '我知道。你盯着那根线的时候，心里只有一个念头。',
      next: 'what_thought',
    },
    what_thought: {
      id: 'what_thought',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '什么？',
      next: 'almost_understand',
    },
    almost_understand: {
      id: 'almost_understand',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '如果这次能看对，我就真的懂市场了。',
      next: 'silence',
    },
    silence: {
      id: 'silence',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '……',
      next: 'every_observer',
    },
    every_observer: {
      id: 'every_observer',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '别紧张。每个来到这里的人，都以为自己差一点就看懂了。',
      next: 'where',
    },
    where: {
      id: 'where',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '这里到底是什么地方？',
      next: 'digital_jianghu',
    },
    digital_jianghu: {
      id: 'digital_jianghu',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '数字江湖。',
      next: 'plain_words',
    },
    plain_words: {
      id: 'plain_words',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '能不能说人话？',
      next: 'strategy_people',
    },
    strategy_people: {
      id: 'strategy_people',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '这里住着很多策略。它们像人一样说话，也像人一样犯错。',
      next: 'strategy_people_2',
    },
    strategy_people_2: {
      id: 'strategy_people_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '有些追涨，有些防守；有些看起来战无不胜，只是还没遇到真正的行情。',
      next: 'why_me',
    },
    why_me: {
      id: 'why_me',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '那我为什么在这里？',
      next: 'observer',
    },
    observer: {
      id: 'observer',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '因为你被选成了观察者。',
      next: 'no_agree',
    },
    no_agree: {
      id: 'no_agree',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '我没同意。',
      next: 'market_agree',
    },
    market_agree: {
      id: 'market_agree',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '市场也没问过你同不同意。',
      next: 'how_return',
    },
    how_return: {
      id: 'how_return',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '我要怎么回去？',
      next: 'learn_observe',
    },
    learn_observe: {
      id: 'learn_observe',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '先学会观察。',
      next: 'observe_what',
    },
    observe_what: {
      id: 'observe_what',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '观察什么？',
      next: 'observe_answer',
    },
    observe_answer: {
      id: 'observe_answer',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '观察那些自称能赢的人，为什么赢。',
      next: 'observe_answer_2',
    },
    observe_answer_2: {
      id: 'observe_answer_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '也观察那些一直亏的人，为什么还没死。',
      next: 'observe_answer_3',
    },
    observe_answer_3: {
      id: 'observe_answer_3',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '桌上那本手札，拿着。',
      next: 'journal_question',
    },
    journal_question: {
      id: 'journal_question',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '这东西能让我回去？',
      next: 'journal_answer',
    },
    journal_answer: {
      id: 'journal_answer',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '不能。',
      next: 'journal_answer_2',
    },
    journal_answer_2: {
      id: 'journal_answer_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '但它能让你不至于第二天就把自己看糊涂。',
      next: 'ask_next',
    },
    ask_next: {
      id: 'ask_next',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '……接下来呢？',
      next: 'hub_unlock',
    },
    hub_unlock: {
      id: 'hub_unlock',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '出门以后，你会看到茶馆、门派、战场，还有一些熟悉又陌生的东西。',
      next: 'hub_unlock_2',
    },
    hub_unlock_2: {
      id: 'hub_unlock_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '想去哪，不急。先问我。',
      next: 'trust_me',
    },
    trust_me: {
      id: 'trust_me',
      speaker: '我',
      portraitKey: 'assets/portraits/player3_observer.png',
      text: '问你？',
      next: 'finish',
    },
    finish: {
      id: 'finish',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '至少在你弄明白这里之前，我比门口那块石头靠谱一点。',
    },
  },
  onComplete: [
    { type: 'set_flag', params: { flag: 'story.observer_awake', value: true } },
    { type: 'set_flag', params: { flag: 'story.has_observer_journal', value: true } },
    { type: 'set_flag', params: { flag: 'story.gushen_hub_unlocked', value: true } },
    { type: 'mark_completed', params: { storyId: 'observer_house_intro_wakeup' } },
    { type: 'add_event_log', params: { agentName: '观察者', text: '我在陌生小屋醒来，见到一个自称股神的人。' } },
  ],
};

/** 股神 Hub ——出生后的小屋剧情分发 */
const gushenHubDefault: StoryScript = {
  id: 'gushen_hub_default',
  trigger: {
    event: 'manual',
    conditions: [
      { type: 'flag_is', params: { flag: 'story.gushen_hub_unlocked', value: true } },
    ],
  },
  priority: 90,
  firstNode: 'start',
  nodes: {
    start: {
      id: 'start',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '想清楚下一步去哪了吗？',
      choices: [
        { text: '去茶馆看看', next: 'teahouse', onSelect: [{ type: 'set_flag', params: { flag: 'objective.visit_teahouse', value: true } }] },
        { text: '去门派看看', next: 'sect', onSelect: [{ type: 'set_flag', params: { flag: 'objective.visit_sect', value: true } }] },
        { text: '这里到底是什么地方？', next: 'world_explain' },
        { text: '我现在该做什么？', next: 'hint' },
        { text: '没事，我再看看', next: 'leave' },
      ],
    },
    teahouse: {
      id: 'teahouse',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '茶馆是吵架的地方。说好听点，叫论道。',
      next: 'teahouse_2',
    },
    teahouse_2: {
      id: 'teahouse_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '策略们会在那里讲自己的逻辑，挑别人的毛病。',
      next: 'teahouse_3',
    },
    teahouse_3: {
      id: 'teahouse_3',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '你先听。别急着信，也别急着骂。最贵的学费，通常都交给了“我觉得”。',
    },
    sect: {
      id: 'sect',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '门派，就是同一种执念聚在一起。',
      next: 'sect_2',
    },
    sect_2: {
      id: 'sect_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '有人信趋势，有人信均值，有人信消息，也有人只信昨晚复盘到三点的幻觉。',
      next: 'sect_3',
    },
    sect_3: {
      id: 'sect_3',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '江湖从来不是靠可靠热闹起来的。',
    },
    world_explain: {
      id: 'world_explain',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '如果用你的话说，这里是策略的影子投出来的世界。',
      next: 'world_explain_2',
    },
    world_explain_2: {
      id: 'world_explain_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '每个策略背后都有一个人。人的贪婪、恐惧、侥幸、纪律，都会留下影子。',
      next: 'world_explain_3',
    },
    world_explain_3: {
      id: 'world_explain_3',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '这里的人，就是那些影子活过来的样子。',
    },
    hint: {
      id: 'hint',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '先出去看一眼这个江湖。',
      next: 'hint_2',
    },
    hint_2: {
      id: 'hint_2',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '想听热闹，去茶馆。想看规矩，去门派。',
      next: 'hint_3',
    },
    hint_3: {
      id: 'hint_3',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '想知道谁在吹牛，迟早要去战场。',
    },
    leave: {
      id: 'leave',
      speaker: '股神',
      portraitKey: 'assets/portraits/gushen.png',
      text: '行。屋子不大，别迷路。',
    },
  },
};

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
  observerHouseArrivalPrompt,
  observerHouseIntroWakeup,
  gushenHubDefault,
  digitalMasterFavorGiftFumo,
  masterChenFavorGiftTuna,
  // 策略茶馆搭建阶段先关闭“进门自动剧情”，保留靠近 NPC 按空格的手动对话。
  ...(TEAHOUSE_ENTRY_STORIES_ENABLED ? [teahouseSkillTransfer, teahouseTransferFollowup] : []),
].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
