# 策略江湖武功总库设计草案

> 状态：讨论稿  
> 日期：2026-05-10  
> 目标：先定义这个世界到底有哪些武功、秘籍和公共特效，再决定代码实现。

## 1. 核心方向

本游戏保留两套战斗模式：

- 战棋战斗：偏站位、范围、回合、数值结算。
- 横版战斗：偏动作表现、节奏、特效、技能菜单。

但武功不是战斗系统的私有数据。武功应该是世界公共层，统一管理：

- 世界里一共有多少门武功。
- 每门武功属于什么源流、类别、阶位。
- 哪些秘籍、剧情、NPC、策略觉醒可以解锁它。
- 每门武功对应什么公共特效、动作倾向、音效和浮字。
- 战棋和横版战斗如何引用同一门武功。

因此后续不再允许横版战斗单独硬编码一套技能，也不允许战棋战斗单独维护另一套武功。两者只能从“江湖武库”读取武功，再各自做表现适配。

## 2. 世界观原则

本作采用“策略江湖”气质：传统武侠和交易/策略/AI 概念各占一半。

世界里有两套力量源流：

1. 传统江湖源流
   - 内功
   - 拳掌
   - 剑法
   - 刀法
   - 轻功
   - 奇门

2. 策略江湖源流
   - 趋势
   - 风控
   - 量价
   - 情绪
   - 推演
   - 链上

玩家修炼武功，不只是学会打架招式，也是在修炼“看懂世界运行规律”的能力。传统武功体现江湖身手，策略武学体现对行情、风险、信号、AI 推演的掌控。

## 3. 概念关系

```text
秘籍 Manual
  解锁 / 触发
武功 Martial Art
  引用
公共特效 Martial Effect
  适配
战棋技能 / 横版技能
```

关键规则：

- 秘籍是学习入口，不等于武功本身。
- 武功是世界定义，不等于战斗技能。
- 特效是表现资产，不等于武功本身。
- 战棋技能和横版技能是武功在不同战斗模式下的适配结果。
- 一本秘籍可以解锁一门武功，也可以解锁一组武功。
- 武功也可以来自剧情领悟、NPC 传授、策略觉醒、天道事件。

## 4. 第一版规模

建议 V1 世界武库先定义 36 门武功：

- 传统江湖武功：18 门
- 策略江湖武功：18 门
- 秘籍：约 24 本
- 公共特效：约 12-16 套
- 首批真正接入战斗：16-20 门
- 其余先进入图鉴、剧情、NPC 或后续版本

武功阶位：

| 阶位 | 名称 | 定位 |
| --- | --- | --- |
| 1 | 入门武学 | 新手阶段、低消耗、容易获得 |
| 2 | 江湖武学 | 中前期主力技能 |
| 3 | 门派绝学 | 中期核心构筑 |
| 4 | 宗师武学 | 后期强力武功 |
| 5 | 天命绝学 | 世界级/剧情级绝学 |

武功战斗定位：

| 定位 | 说明 |
| --- | --- |
| normal | 普通攻击或默认出手 |
| attack | 主动伤害武功 |
| inner | 内功，可伤害、护体、恢复或强化 |
| lightness | 轻功，影响速度、闪避、先手或位移 |
| defense | 防御、护盾、减伤、保命 |
| support | 命中、暴击、回内、增益、辅助 |
| ultimate | 高阶绝学或剧情级武功 |

## 5. V1 传统江湖武功 18 门

| ID | 名称 | 类别 | 阶位 | 定位 | 解锁方式草案 | 战斗状态 |
| --- | --- | --- | --- | --- | --- | --- |
| basic_attack | 普通攻击 | 拳掌 | 1 | normal | 默认掌握 | 首批实装 |
| tuna_qigong | 吐纳功 | 内功 | 1 | inner/support | 《吐纳入门》 | 首批实装 |
| broken_sword_intro | 破剑入门 | 剑法 | 1 | attack | 《破剑残页》 | 图鉴预留 |
| gale_blade | 狂风快刀 | 刀法 | 1 | attack | 《狂风刀谱》 | 图鉴预留 |
| wind_step | 踏风步 | 轻功 | 1 | lightness | 轻功师傅传授 | 图鉴预留 |
| iron_cloth | 铁布衫 | 内功 | 1 | defense | 《铁布衫》 | 图鉴预留 |
| flame_palm | 火焰掌 | 拳掌 | 2 | attack | 《火焰掌谱》或剧情领悟 | 首批实装 |
| zhuihun_jian | 追魂剑法 | 剑法 | 2 | attack | 《追魂剑谱》 | 首批实装 |
| blood_blade_intro | 血刀残式 | 刀法 | 2 | attack | 《血刀残卷》 | 图鉴预留 |
| fengmo_zhang | 疯魔杖法 | 奇门 | 2 | attack | NPC 传授或奇门秘籍 | 首批实装 |
| digital_fumo_intro | 金刚伏魔入门 | 内功 | 2 | inner/defense | 《金刚伏魔入门》 | 首批实装 |
| luoying_shenjian | 落英神剑掌 | 拳掌 | 2 | attack | 《落英神剑掌》 | 二批实装 |
| taiji_quan | 太极拳 | 拳掌 | 3 | inner/attack | 门派剧情 | 首批实装 |
| jingang_fumo | 金刚伏魔功 | 内功 | 3 | inner/defense | 金刚伏魔入门进阶 | 二批实装 |
| dagou_bang | 打狗棒法 | 奇门 | 3 | attack | 江湖奇遇 | 图鉴预留 |
| lingbo_step | 凌波微步 | 轻功 | 3 | lightness | 高阶轻功秘籍 | 图鉴预留 |
| dugu_jiujian | 独孤九剑 | 剑法 | 4 | ultimate/attack | 宗师传承 | 首批实装 |
| heavenly_flying_sword | 天外飞仙 | 剑法 | 5 | ultimate | 天命剧情 | 图鉴预留 |

## 6. V1 策略江湖武功 18 门

| ID | 名称 | 类别 | 阶位 | 定位 | 解锁方式草案 | 战斗状态 |
| --- | --- | --- | --- | --- | --- | --- |
| orderbook_listen | 盘口听风 | 量价 | 1 | support/attack | 《盘口听风录》 | 首批实装 |
| volume_return | 量能归元 | 量价 | 1 | support/inner | 《量能归元篇》 | 首批实装 |
| stoploss_heart_guard | 止损护心诀 | 风控 | 1 | defense | 《止损护心诀》 | 首批实装 |
| trend_read_intro | 趋势初判 | 趋势 | 1 | support | 策略入门任务 | 图鉴预留 |
| kline_shadow | K线照影 | 推演 | 1 | support/attack | 《K线照影图》 | 图鉴预留 |
| position_breathing | 仓位吐纳 | 风控 | 1 | inner/support | 《仓位吐纳法》 | 图鉴预留 |
| live_strategy_deduction | 实盘推演 | 推演 | 2 | attack/support | 数字掌门剧情 | 首批实装 |
| btc_heartbeat | BTC心跳 | 链上 | 2 | attack | BTC 策略觉醒 | 首批实装 |
| drawdown_shield | 回撤护体 | 风控 | 2 | defense | 实盘回撤事件 | 首批实装 |
| intraday_dragon | 分时游龙 | 趋势 | 2 | attack/lightness | 《分时游龙图》 | 图鉴预留 |
| sentiment_lamp | 情绪燃灯 | 情绪 | 2 | support/attack | 情绪事件 | 图鉴预留 |
| signal_chain | 信号连环 | 推演 | 2 | attack | 多信号 NPC 传授 | 图鉴预留 |
| trend_breaker | 趋势破阵 | 趋势 | 3 | attack | 《趋势破阵图》 | 首批实装 |
| volume_price_unity | 量价合一 | 量价 | 3 | inner/attack | 量价任务线 | 二批实装 |
| multifactor_return | 多因子归宗 | 推演 | 3 | support/ultimate | 多因子策略觉醒 | 二批实装 |
| black_swan_step | 黑天鹅身法 | 风控 | 3 | lightness/defense | 黑天鹅事件幸存 | 图鉴预留 |
| backtest_heaven_record | 天机回测录 | 推演 | 4 | ultimate/support | 高阶回测系统 | 二批实装 |
| heaven_judgement | 天道裁决 | 推演 | 5 | ultimate | 天道审判剧情 | 首批或剧情实装 |

## 7. 首批建议实装 16 门

第一批开发不需要把 36 门全部接入战斗。建议先做 16 门，形成完整闭环：

| 源流 | 武功 |
| --- | --- |
| 传统 | 普通攻击、吐纳功、火焰掌、追魂剑法、疯魔杖法、金刚伏魔入门、太极拳、独孤九剑 |
| 策略 | 盘口听风、量能归元、止损护心诀、实盘推演、BTC心跳、回撤护体、趋势破阵、天道裁决 |

首批必须覆盖：

- 默认攻击
- 低阶内功
- 拳掌伤害
- 剑法伤害
- 奇门伤害
- 防御/护盾
- 策略攻击
- 高阶绝学

## 8. 公共特效池草案

公共特效不需要每门武功一套。V1 可以用 12-16 套特效复用，再给关键武功定制。

| 特效 ID | 用途 | 代表武功 |
| --- | --- | --- |
| effect_normal_hit | 普通命中 | 普通攻击 |
| effect_inner_breath | 内功气息 | 吐纳功、仓位吐纳 |
| effect_flame_palm | 火焰掌劲 | 火焰掌 |
| effect_sword_arc | 剑气弧光 | 追魂剑法、破剑入门 |
| effect_blade_slash | 刀光斩击 | 狂风快刀、血刀残式 |
| effect_staff_burst | 奇门爆震 | 疯魔杖法、打狗棒法 |
| effect_golden_guard | 金色护体 | 金刚伏魔入门、金刚伏魔功 |
| effect_taiji_circle | 太极圆劲 | 太极拳 |
| effect_ultimate_sword | 宗师剑意 | 独孤九剑、天外飞仙 |
| effect_market_signal | 策略信号 | 实盘推演、信号连环 |
| effect_btc_pulse | 链上心跳 | BTC心跳 |
| effect_drawdown_shield | 回撤护盾 | 止损护心诀、回撤护体 |
| effect_trend_break | 趋势破阵 | 趋势破阵 |
| effect_volume_wave | 量能波纹 | 量能归元、量价合一 |
| effect_heaven_judgement | 天道裁决 | 天道裁决 |

战棋和横版可以引用同一个 `effectId`，但渲染参数可以不同：

- 战棋：格子范围、中心点、覆盖区域、帧动画。
- 横版：角色前方、目标中心、飞行轨迹、冲刺时机。

## 9. 武功公共定义草案

未来建议建立统一文件夹：

```text
packages/visual/src/content/martial/
  MartialTypes.ts
  MartialCodex.ts
  ManualCodex.ts
  MartialEffectCatalog.ts
  MartialBattleAdapters.ts
```

公共武功定义建议长这样：

```ts
export interface MartialArtDef {
  id: string;
  name: string;
  source: 'traditional' | 'strategy';
  category:
    | 'inner'
    | 'fist'
    | 'sword'
    | 'blade'
    | 'lightness'
    | 'special'
    | 'trend'
    | 'risk'
    | 'volume_price'
    | 'sentiment'
    | 'deduction'
    | 'onchain';
  tier: 1 | 2 | 3 | 4 | 5;
  role: 'normal' | 'attack' | 'inner' | 'lightness' | 'defense' | 'support' | 'ultimate';
  description: string;
  flavor: string;

  unlock?: {
    manualIds?: string[];
    storyFlags?: string[];
    npcIds?: string[];
    requiredMartials?: Array<{ martialId: string; level: number }>;
    requiredAttributes?: Partial<PlayerAttributes>;
  };

  progression?: {
    maxLevel: number;
    expCurve: 'linear' | 'rare' | 'ultimate';
    hitExp: number;
    missExp: number;
  };

  combat?: {
    mpCost: number;
    basePower: number;
    powerGrowth: number;
    hitRate: number;
    target: 'enemy' | 'self';
    statusEffects?: string[];
  };

  presentation?: {
    effectId: string;
    castTextColor?: string;
    horizontal?: {
      presentation: 'melee' | 'ranged' | 'self';
      spineAction?: string;
      hitDelayMs?: number;
    };
    tactical?: {
      range: number;
      aoeSize: number;
      shape: 'single' | 'cross' | 'line' | 'diamond' | 'circle';
    };
  };
}
```

## 10. 战棋适配规则

战棋战斗不直接写死武功。它从 `MartialArtDef` 转成战棋用技能：

```text
MartialArtDef
  -> tactical.range
  -> tactical.aoeSize
  -> tactical.shape
  -> combat.basePower + level growth
  -> effectId
  -> WugongDef 或新的 TacticalSkillDef
```

战棋重点字段：

- 施法距离
- 攻击范围
- 范围形状
- 消耗内力
- 命中率
- 伤害威力
- 特效 ID

## 11. 横版适配规则

横版战斗也不直接写死武功。它从 `MartialArtDef` 转成横版用技能：

```text
MartialArtDef
  -> horizontal.presentation
  -> horizontal.spineAction
  -> horizontal.hitDelayMs
  -> combat.basePower + level growth
  -> effectId
  -> SideBattleSkill
```

横版重点字段：

- 近身、远程、自身三种表现
- 角色动作
- 命中延迟
- 特效挂点
- 技能菜单展示
- 浮字和日志文案

## 12. 待讨论问题

下面这些需要最终确认后再开发：

1. V1 是否确定为 36 门武功，还是先压缩到 24 门？
2. 策略武学名字是否要更武侠，还是保留更多交易语义？
3. “天道裁决”是否作为武功，还是作为剧情/系统事件？
4. 玩家是否需要“装备武功槽”，还是已学武功全部进战斗菜单？
5. 战棋和横版是否都允许同一门武功可用，还是部分武功只适配一种模式？
6. 策略 NPC 的专属技能是否也必须进入武库，还是允许 NPC 有少量私有技能？
7. 武功升级是否只靠使用，还是允许消耗秘籍残页/元宝/事件奖励提升？

## 13. 当前建议决策

建议先确认以下决策：

- 采用 36 门世界武功池。
- 第一批只实装 16 门。
- 武功公共层优先于战斗系统改造。
- 秘籍、武功、特效、战斗适配分离。
- 战棋和横版都从同一门武功生成技能。
- 策略武学保留交易/AI 语义，但命名尽量武侠化。

确认后进入下一步：

1. 修订本武功清单。
2. 给 36 门武功补完整字段。
3. 给 24 本秘籍定名字和解锁关系。
4. 给 12-16 个公共特效定资源 ID。
5. 再写实现计划，开始改代码。
