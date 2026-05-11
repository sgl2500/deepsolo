# 武功总库设计草案

> 状态：讨论稿  
> 日期：2026-05-10  
> 目标：先定义这个世界到底有哪些武功、秘籍和公共特效，再决定代码实现。

## 1. 核心方向

本游戏保留两套战斗模式：

- 战棋战斗：偏站位、范围、回合、数值结算。
- 横版战斗：偏动作表现、节奏、特效、技能菜单。

但武功不是战斗系统的私有数据。武功应该是世界公共层，统一管理：

- 世界里一共有多少门武功。
- 每门武功属于什么分类和阶位。
- 哪些秘籍、剧情、NPC、事件可以解锁它。
- 每门武功对应什么公共特效、动作倾向、音效和浮字。
- 战棋和横版战斗如何引用同一门武功。

因此后续不再允许横版战斗单独硬编码一套技能，也不允许战棋战斗单独维护另一套武功。两者只能从“武功总库”读取武功，再各自做表现适配。

## 2. 当前确定的分类

武功分类先只保留 6 类：

1. 拳法
2. 腿法
3. 剑法
4. 刀法
5. 内功
6. 绝学

暂时不再增加趋势、风控、量价、情绪、推演、链上、奇门、轻功等独立分类。

如果后续仍然要保留策略江湖、交易、AI、行情等特色，它们不作为武功分类，而是作为：

- 武功来源
- 秘籍背景
- NPC 门派设定
- 特效风格
- 剧情解释
- 绝学命名灵感

也就是说，分类保持干净，世界观可以继续混合。

例如：

```text
分类：内功
武功：金钟罩
来源：数字掌门把风控理念炼成护体心法

分类：绝学
武功：泰山压顶
来源：天道事件或宗师传承
```

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
- 武功也可以来自剧情领悟、NPC 传授、宗师传承、天道事件。

## 4. 第一版武功分类清单

当前只按用户明确指定的武功整理，不额外扩展新武功。

| 分类 | 武功 |
| --- | --- |
| 拳法 | 太祖长拳、太极拳 |
| 腿法 | 天残脚、无影脚 |
| 剑法 | 松风剑法、独孤九剑 |
| 刀法 | 狂风刀法、雪饮狂刀 |
| 内功 | 吐纳入门、金钟罩 |
| 绝学 | 泰山压顶 |

> 备注：绝学确定为独立分类，不作为其他分类之上的品质标签。项目里已有的其他武功暂不删除，但不进入本轮武功总库讨论。

## 5. 武功明细草案

| ID | 名称 | 分类 | 阶位草案 | 定位草案 | 解锁方式草案 | 战斗状态 |
| --- | --- | --- | --- | --- | --- | --- |
| taizu_changquan | 太祖长拳 | 拳法 | 1 | 基础拳法 / 主动攻击 | 新手剧情或基础拳谱 | 待定 |
| taiji_quan | 太极拳 | 拳法 | 3 | 高阶拳法 / 攻守兼备 | 门派剧情或太极拳谱 | 已有数据，可迁移 |
| tiancan_leg | 天残脚 | 腿法 | 4 | 高爆发腿法 / 主动攻击 | 江湖奇遇或残卷 | 待定 |
| shadowless_leg | 无影脚 | 腿法 | 2 | 高命中腿法 / 连击倾向 | 腿法秘籍或 NPC 传授 | 待定 |
| songfeng_sword | 松风剑法 | 剑法 | 1 | 入门剑法 / 稳定攻击 | 松风剑谱 | 待定 |
| dugu_jiujian | 独孤九剑 | 剑法 | 4 | 宗师剑法 / 高伤害 | 宗师传承 | 已有数据，可迁移 |
| gale_blade | 狂风刀法 | 刀法 | 2 | 快速刀法 / 多段攻击 | 狂风刀谱 | 待定 |
| xueyin_blade | 雪饮狂刀 | 刀法 | 4 | 高阶刀法 / 重击爆发 | 雪饮刀谱或神兵事件 | 待定 |
| tuna_intro | 吐纳入门 | 内功 | 1 | 基础内功 / 回内或内力上限 | 吐纳入门秘籍 | 已有相关内容，可迁移 |
| golden_bell | 金钟罩 | 内功 | 2 | 护体内功 / 护盾减伤 | 金钟罩秘籍 | 待定 |
| taishan_pressure | 泰山压顶 | 绝学 | 5 | 终极绝学 / 压制伤害 | 天道事件或宗师传承 | 待定 |

## 6. 分类设计说明

### 6.1 拳法

拳法是最基础、最容易被玩家理解的近身武功分类。

当前拳法：

- 太祖长拳：基础拳法，适合新手阶段，低消耗、稳定、易升级。
- 太极拳：高阶拳法，攻守兼备，可以带有减伤、反击或以柔克刚的表现。

建议拳法在战斗中的特点：

- 横版战斗：近身出拳，命中时播放拳劲或圆劲特效。
- 战棋战斗：距离短，伤害稳定，部分拳法可以带小范围震荡。

### 6.2 腿法

腿法强调速度、先手、突进、连击。

当前腿法：

- 天残脚：高阶腿法，爆发强，适合做后期或稀有武功。
- 无影脚：中阶腿法，命中高，适合表现为快速连击。

建议腿法在战斗中的特点：

- 横版战斗：高速突进、残影、踢击连段。
- 战棋战斗：可拥有更远攻击距离，或者附带位移效果。

### 6.3 剑法

剑法强调命中、破招、穿透和高阶单体伤害。

当前剑法：

- 松风剑法：入门剑法，稳定、轻快、适合早期玩家获得。
- 独孤九剑：宗师剑法，高伤害、高命中，可以作为后期核心武功。

建议剑法在战斗中的特点：

- 横版战斗：剑气、斩击弧线、快速出手。
- 战棋战斗：可做直线、单体、穿透型技能。

### 6.4 刀法

刀法强调爆发、重击、压迫感。

当前刀法：

- 狂风刀法：中阶快刀，多段、快速、进攻性强。
- 雪饮狂刀：高阶刀法，重击爆发，适合做强力单体或范围斩击。

建议刀法在战斗中的特点：

- 横版战斗：重斩、刀光、大幅度动作。
- 战棋战斗：伤害高，但命中或内力消耗可以更苛刻。

### 6.5 内功

内功是角色长期成长和战斗资源的核心。

当前内功：

- 吐纳入门：基础内功，可以提升内力上限、恢复内力或提供基础内劲攻击。
- 金钟罩：护体内功，可以提供护盾、减伤、防御提升。

建议内功在战斗中的特点：

- 横版战斗：可以是自我强化，也可以是内劲外放。
- 战棋战斗：可以提供护盾、回复、防御状态或内力类攻击。

### 6.6 绝学

绝学是独立分类，只收录世界级、剧情级或压迫感极强的武功。

当前绝学：

- 泰山压顶：终极压制型武功，适合做大范围、高压迫、强控制或高伤害技能。

## 7. 公共特效池草案

当前只按用户指定的 11 门武功设计公共特效，不额外扩展。

| 特效 ID | 用途 | 代表武功 |
| --- | --- | --- |
| effect_fist_impact | 基础拳劲 | 太祖长拳 |
| effect_taiji_circle | 太极圆劲 | 太极拳 |
| effect_leg_heavy | 重腿压制 | 天残脚 |
| effect_leg_shadow | 腿法残影 | 无影脚 |
| effect_sword_breeze | 松风剑气 | 松风剑法 |
| effect_dugu_sword | 独孤剑意 | 独孤九剑 |
| effect_gale_blade | 狂风刀光 | 狂风刀法 |
| effect_xueyin_blade | 雪饮刀气 | 雪饮狂刀 |
| effect_inner_breath | 内功吐纳 | 吐纳入门 |
| effect_golden_bell | 金钟护体 | 金钟罩 |
| effect_taishan_pressure | 泰山压顶 | 泰山压顶 |

战棋和横版可以引用同一个 `effectId`，但渲染参数可以不同：

- 战棋：格子范围、中心点、覆盖区域、帧动画。
- 横版：角色前方、目标中心、飞行轨迹、冲刺时机。

## 8. 熟练度与特效阶段

每门武功的特效不能只有一种固定表现。武功需要根据熟练度呈现不同状态：熟练度越高，同一门武功的完成度越高，特效越完整、越强、越有压迫感。

这里的 5 档不是 5 个独立技能，而是同一门武功根据熟练度决定“做到什么程度”和“呈现什么效果”。例如太祖长拳低熟练度只是普通拳劲，高熟练度才出现地面震纹和完整拳印。

武功熟练度确定分成 5 个视觉阶段：

| 阶段 | 等级范围 | 名称草案 | 特效表现原则 |
| --- | --- | --- | --- |
| stage_1 | Lv.1-Lv.2 | 初学 | 特效短、小、淡，动作朴素，命中反馈轻 |
| stage_2 | Lv.3-Lv.4 | 小成 | 特效轮廓清晰，范围略增，出现稳定气劲 |
| stage_3 | Lv.5-Lv.6 | 熟练 | 特效亮度、残影、粒子增加，命中反馈明显 |
| stage_4 | Lv.7-Lv.9 | 大成 | 特效更大，加入震屏、拖尾、二段爆发或范围扩散 |
| stage_5 | Lv.10 | 圆满 | 完整终态特效，独立浮字、强命中反馈、可能触发特殊镜头 |

这里的“特效变化”不一定意味着每个阶段都要准备一张全新的素材。优先让熟练度驱动参数和叠加层，必要时再切换高阶资源。可以分两层实现：

1. 参数变化
   - 缩放
   - 透明度
   - 颜色强度
   - 粒子数量
   - 持续时间
   - 命中震屏
   - 残影数量

2. 资源变化
   - 高熟练度使用更完整的 sprite sheet
   - Lv.10 使用专属圆满特效
   - 绝学可以从 Lv.7 开始启用额外特效层

公共规则：

- 每门武功绑定一个基础 `effectId`。
- 熟练度阶段决定这个 `effectId` 的完成度，而不是改变武功本身。
- 每个 `effectId` 可以拥有多个 `variant`，也可以只用同一资源加参数变化。
- 战棋和横版都根据同一个熟练度阶段选择特效状态。
- 战棋可以主要变化范围、格子震动、中心爆点、覆盖层。
- 横版可以主要变化角色残影、命中爆点、镜头震动、特效层数。
- 数值强弱和视觉完成度可以相关，但不能完全绑定；有些武功视觉变强，数值只小幅成长。

建议命名：

```text
effect_fist_impact.stage_1
effect_fist_impact.stage_2
effect_fist_impact.stage_3
effect_fist_impact.stage_4
effect_fist_impact.stage_5
```

或者在代码里拆成：

```ts
interface MartialEffectStageDef {
  stage: 1 | 2 | 3 | 4 | 5;
  minLevel: number;
  scale: number;
  alpha: number;
  durationMs: number;
  particleLevel: number;
  cameraShake: number;
  extraLayer?: string;
  castText?: string;
}
```


### 8.1 五档完成度规则

| 熟练度阶段 | 完成度 | 主要变化 | 是否需要新素材 |
| --- | --- | --- | --- |
| 初学 | 20%-30% | 只出现核心命中特效 | 不需要 |
| 小成 | 40%-50% | 轮廓、颜色、持续时间增强 | 通常不需要 |
| 熟练 | 60%-70% | 增加残影、粒子、二段命中反馈 | 可选 |
| 大成 | 80%-90% | 增加震屏、扩散、拖尾、额外层 | 推荐有额外层 |
| 圆满 | 100% | 完整终态表现、专属浮字或镜头 | 推荐专属资源或组合特效 |

## 9. 11 门武功的阶段化特效方向

以下只描述特效方向，不新增武功。

| 武功 | 初学 | 小成 | 熟练 | 大成 | 圆满 |
| --- | --- | --- | --- | --- | --- |
| 太祖长拳 | 单点拳劲 | 拳风扩散 | 双层拳劲 | 地面震纹 | 金色拳印压出 |
| 太极拳 | 淡色圆弧 | 太极半圆 | 完整圆劲 | 黑白气旋 | 太极图短暂显形 |
| 天残脚 | 重踢尘土 | 下压气浪 | 裂地冲击 | 大范围压迫波 | 巨大脚影压顶 |
| 无影脚 | 一道残影 | 两段残影 | 多段踢影 | 连续残影环绕 | 目标周身残影爆开 |
| 松风剑法 | 细剑弧 | 青色剑风 | 多道剑风 | 风旋剑气 | 松风剑阵一闪 |
| 独孤九剑 | 单道剑意 | 破招剑光 | 多向剑痕 | 剑意裂屏 | 九道剑意齐发 |
| 狂风刀法 | 短刀光 | 快速斩线 | 多段刀风 | 狂风旋斩 | 刀风形成风暴 |
| 雪饮狂刀 | 冷色刀气 | 寒霜斩痕 | 冰裂刀光 | 寒气扩散 | 冰雪重刀斩落 |
| 吐纳入门 | 轻微气息 | 气息环身 | 内息流转 | 气劲外放 | 周身气海成形 |
| 金钟罩 | 淡金护光 | 金色护罩 | 金钟轮廓 | 护罩震荡反光 | 完整金钟显形 |
| 泰山压顶 | 地面阴影 | 石压气浪 | 山影显现 | 大范围震地 | 巨大山岳压顶 |

> 这张表是视觉方向，不代表数值一定增强到同等程度。数值成长仍由武功等级、内力消耗、威力成长单独决定。


## 10. 武功公共定义草案

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
  category: 'fist' | 'leg' | 'sword' | 'blade' | 'inner' | 'ultimate';
  tier: 1 | 2 | 3 | 4 | 5;
  role: 'normal' | 'attack' | 'inner' | 'defense' | 'support' | 'ultimate';
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

## 11. 战棋适配规则

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

## 12. 横版适配规则

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


## 13. 接入战斗系统方案

武功系统接入战斗时分三层：

```text
武功总库 Martial Codex
  ↓
战斗适配层 Martial Battle Adapter
  ↓
战棋战斗 / 横版战斗
```

核心原则：

- 战斗系统不能定义武功。
- 战斗系统只能消费武功。
- 武功定义和特效资源必须解耦。
- 更换某门武功的特效时，不应该改战棋或横版战斗逻辑。

### 13.1 武功公共模块

建议新增统一武功模块：

```text
packages/visual/src/content/martial/
  MartialTypes.ts
  MartialCodex.ts
  MartialEffectCatalog.ts
  MartialEffectBindings.ts
  MartialAdapters.ts
```

各文件职责：

| 文件 | 职责 |
| --- | --- |
| MartialTypes.ts | 定义武功、分类、熟练度阶段、特效阶段、战斗适配类型 |
| MartialCodex.ts | 11 门武功的世界定义：名称、分类、阶位、解锁、基础战斗参数 |
| MartialEffectCatalog.ts | 可复用特效资源定义：资源 key、默认尺寸、时长、挂点、阶段参数 |
| MartialEffectBindings.ts | 武功到特效的绑定关系；后续替换特效主要改这里 |
| MartialAdapters.ts | 把公共武功转换成战棋技能或横版技能 |

这样后续想替换某门武功特效，只改：

```text
MartialEffectBindings.ts
```

不需要改：

```text
BattleSystem.ts
SideBattleSystem.ts
SideBattleRules.ts
```

### 13.2 武功和特效解耦

武功本身只描述“这门武功是什么”：

```ts
interface MartialArtDef {
  id: string;
  name: string;
  category: 'fist' | 'leg' | 'sword' | 'blade' | 'inner' | 'ultimate';
  tier: 1 | 2 | 3 | 4 | 5;
  role: 'attack' | 'inner' | 'defense' | 'support' | 'ultimate';
  combat: MartialCombatDef;
  tactical?: MartialTacticalDef;
  horizontal?: MartialHorizontalDef;
}
```

特效单独定义“有哪些可用表现资源”：

```ts
interface MartialEffectDef {
  effectId: string;
  resourceKey: string;
  anchor: 'attacker' | 'target' | 'self' | 'area';
  stages: MartialEffectStageDef[];
}
```

绑定关系单独定义“这门武功当前用哪个特效”：

```ts
const MARTIAL_EFFECT_BINDINGS = {
  taizu_changquan: 'effect_fist_impact',
  taiji_quan: 'effect_taiji_circle',
  tiancan_leg: 'effect_leg_heavy',
  shadowless_leg: 'effect_leg_shadow',
  songfeng_sword: 'effect_sword_breeze',
  dugu_jiujian: 'effect_dugu_sword',
  gale_blade: 'effect_gale_blade',
  xueyin_blade: 'effect_xueyin_blade',
  tuna_intro: 'effect_inner_breath',
  golden_bell: 'effect_golden_bell',
  taishan_pressure: 'effect_taishan_pressure',
} as const;
```

如果以后想让太祖长拳换成另一套拳法特效，只需要改：

```ts
taizu_changquan: 'effect_new_fist_impact'
```

武功数据、玩家存档、战斗逻辑都不用动。

### 13.3 熟练度驱动特效选择

战斗系统不直接判断特效阶段，只调用公共函数：

```ts
const effect = getMartialEffectForBattle({
  martialId: 'taizu_changquan',
  level: 6,
  mode: 'horizontal',
});
```

这个函数内部做三件事：

```text
martialId -> effectId -> masteryStage -> stage effect config
```

返回结果类似：

```ts
{
  martialId: 'taizu_changquan',
  effectId: 'effect_fist_impact',
  stage: 3,
  variant: 'double_impact',
  resourceKey: 'battle_effect_fist_impact',
  scale: 1.0,
  alpha: 1,
  durationMs: 300,
  cameraShake: 0.05,
}
```

横版和战棋都用同一个选择逻辑，但可以传不同 `mode`，获得不同渲染参数。

### 13.4 战棋战斗适配

战棋战斗需要的不是完整武功定义，而是战棋可执行技能：

```ts
toTacticalSkill(martialId, level)
```

输出字段包括：

- 名称
- 分类
- 内力消耗
- 威力
- 命中率
- 攻击距离
- 范围形状
- 范围大小
- 当前熟练度阶段
- 当前特效配置

战棋流程：

```text
选择武功
  ↓
读取玩家该武功等级
  ↓
通过 MartialAdapters 生成战棋技能
  ↓
播放当前熟练度阶段的特效
  ↓
结算命中和伤害
  ↓
记录武功使用熟练度
```

### 13.5 横版战斗适配

横版战斗需要的是菜单技能和动作表现：

```ts
toSideBattleSkill(martialId, level)
```

输出字段包括：

- 名称
- 分类
- 内力消耗
- 威力
- 命中率
- 近身 / 远程 / 自身释放
- spineAction
- hitDelayMs
- 当前熟练度阶段
- 当前特效配置

横版流程：

```text
读取玩家已学武功
  ↓
通过 MartialAdapters 生成 SideBattleSkill
  ↓
技能菜单展示
  ↓
玩家释放技能
  ↓
播放当前熟练度阶段的动作和特效
  ↓
结算伤害或状态
  ↓
记录武功使用熟练度
```

### 13.6 资源路径规划

武功特效贴图统一放在：

```text
packages/visual/public/assets/battle/shared/effects/martial/codex/
```

当前 11 门武功对应资源：

| 武功 | resourceKey | 文件 |
| --- | --- | --- |
| 太祖长拳 | battle_effect_martial_fist_shadow | fist_shadow.png |
| 太极拳 | battle_effect_martial_taiji_circle | taiji_circle.png |
| 天残脚 | battle_effect_martial_leg_heavy | leg_heavy.png |
| 无影脚 | battle_effect_martial_leg_shadow | leg_shadow.png |
| 松风剑法 | battle_effect_martial_sword_breeze | sword_breeze.png |
| 独孤九剑 | battle_effect_martial_dugu_sword | dugu_sword.png |
| 狂风刀法 | battle_effect_martial_gale_blade | gale_blade.png |
| 雪饮狂刀 | battle_effect_martial_xueyin_blade | xueyin_blade.png |
| 吐纳入门 | battle_effect_martial_inner_breath | inner_breath.png |
| 金钟罩 | battle_effect_martial_golden_bell | golden_bell.png |
| 泰山压顶 | battle_effect_martial_taishan_pressure | taishan_pressure.png |

资源加载入口统一放在：

```text
packages/visual/src/content/BattleAssetCatalog.ts
```

武功到特效的绑定仍然只由 `MartialEffectBindings.ts` 控制，`MartialEffectCatalog.ts` 只负责描述这些 resourceKey 的五档表现参数。

### 13.7 替换特效的目标体验

后续替换特效应该满足：

- 换太祖长拳特效：只改绑定，不改太祖长拳的武功定义。
- 换拳法通用特效：只改 `effect_fist_impact` 的资源和阶段参数。
- 换 Lv.10 圆满表现：只改该 effect 的 stage_5 配置。
- 战棋和横版可以共用同一个 effectId，但有不同渲染参数。
- 没有资源时，可以先用参数模拟；资源到位后，再替换 resourceKey 或 variant。

### 13.8 建议接入顺序

1. 先建武功公共模块，不动战斗逻辑。
2. 把 11 门武功写进 `MartialCodex.ts`。
3. 把 11 个基础特效和五档阶段写进 `MartialEffectCatalog.ts`。
4. 在 `MartialEffectBindings.ts` 建立武功到特效的映射。
5. 写 `MartialAdapters.ts`，提供战棋和横版转换函数。
6. 先接横版战斗，替换硬编码玩家技能来源。
7. 再接战棋战斗，替换玩家武功数据来源。
8. 最后统一特效调用，让两套战斗都从 `getMartialEffectForBattle()` 取特效。

## 14. 待讨论问题

下面这些需要最终确认后再开发：

0. 熟练度特效阶段是否采用 Lv.1-2、Lv.3-4、Lv.5-6、Lv.7-9、Lv.10 这 5 档？

1. “腿法”和“脚法”最终用哪个名字？当前文档统一用“腿法”。
2. 绝学已经确定为独立分类；后续需要继续补充绝学数量。
3. 当前只讨论用户指定的 11 门武功，不额外补充。
4. 项目里已有的其他武功暂不删除，但不进入本轮武功总库讨论。
5. 普通攻击是否作为武功进入总库，还是作为战斗系统默认动作？
6. 每类武功是否需要不同战斗特色，例如拳法稳、腿法快、剑法准、刀法狠、内功守、绝学强？
7. 策略/交易/AI 特色是否完全退出武功命名，还是只进入秘籍和剧情背景？

## 15. 当前建议决策

建议先确认以下决策：

- 分类只保留：拳法、腿法、剑法、刀法、内功、绝学。
- 武功总库先按当前 11 门整理。
- 绝学确定为独立分类，不作为品质标签。
- 当前只按用户指定的 11 门武功整理；已有其他武功暂不删除。
- 策略/交易/AI 不作为武功分类，只作为背景来源。
- 战棋和横版都从同一门武功生成技能。
- 武功和特效解耦，后续替换特效只改绑定配置。

确认后进入下一步：

1. 修订每门武功的名字、描述、定位。
2. 给每门武功补完整字段。
3. 定秘籍名字和解锁关系。
4. 定公共特效 ID。
5. 再写实现计划，开始改代码。

## 16. 已确认表现记录

### 16.1 太祖长拳横版表现

当前表现已确认正确：

```text
主角原地播放 skill1 进攻动作
  ↓
不冲到敌人身前
  ↓
金色拳影从主角手部前方发出
  ↓
拳影飞向敌人身体命中点
  ↓
命中后结算伤害
  ↓
主角收招回 idle
```

关键实现记录：

- 武功：`taizu_changquan`
- 横版动作：`spineAction: 'skill1'`
- 横版表现：`presentation: 'ranged'`
- 特效资源：`battle_effect_martial_fist_shadow`
- 发射点：暂不使用 Spine 的 `attackPoint`，使用横版视觉校准后的手部估算点
- 当前校准值：`x = anchor.x + facing * 86`，`y = anchor.y - 148`

注意：当前角色资源里的 `attackPoint` 不稳定贴合拳头，之前使用后拳影更偏下。因此太祖长拳现阶段不要改回 `attackPoint`，除非后续专门做 Spine 骨骼点可视化校准。

