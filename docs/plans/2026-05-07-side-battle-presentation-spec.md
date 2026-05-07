# 横版战斗表现系统需求文档

**日期：** 2026-05-07  
**状态：** 设计确认中  
**适用范围：** `packages/visual/src/systems/sidebattle`

## 1. 目标

横版战斗不再只是数值结算动画，而要形成一套可长期扩展的“人物动作 + 武功特效 + 战斗状态”表现规则。

核心目标：

- 普通攻击、武功攻击、策略攻击、防御要有明确不同的表现。
- 玩家、数字掌门、普通 NPC、后续门派弟子都走同一套公共逻辑。
- 每个角色可以有自己的动作贴图，但没有专属贴图时必须能 fallback 到通用动作。
- 每个武功可以绑定公共特效池里的特效，而不是把特效写死在角色身上。
- 防御不是一次性闪一下，而是进入防御姿态，并持续到对手攻击结算后再恢复待机姿态。

## 2. 战斗动作类型

### 2.1 普通攻击

普通攻击代表最基础的拳脚试探。

表现要求：

1. 攻击者从原位冲到目标身前。
2. 攻击者切换到 `attack` 姿态。
3. 不播放大型武功特效。
4. 命中时只播放小型通用命中爆点。
5. 伤害数字出现在目标身体前侧。
6. 攻击者退回原位。
7. 攻击者恢复 `idle` 姿态。

普通攻击不绑定武功特效，只绑定通用命中特效：

```text
normal_attack -> battle_effect_hit_burst
```

### 2.2 武功攻击

武功攻击是玩家和 NPC 释放武学的主要表现。

表现要求：

1. 攻击者从原位冲到目标身前。
2. 攻击者切换到对应武功动作，优先使用角色自己的 `attack` 姿态。
3. 到达目标身前后，在攻击者手前或目标身前播放武功特效。
4. 武功特效来自公共武功特效池，由武功 ID 决定。
5. 命中时播放通用命中爆点，强度可以比普通攻击更大。
6. 伤害数字出现在目标身体前侧。
7. 攻击者退回原位。
8. 攻击者恢复 `idle` 姿态。

关键点：

- 武功攻击不是站桩远程飞弹。
- 武功特效是“人物冲过去出手后释放”的叠加表现。
- 武功特效和人物动作分离，方便后续新增角色或新增武功。

示例：

```text
吐纳功:
  人物冲到目标身前
  播放淡金气流/内劲特效
  命中爆点

金刚伏魔入门:
  人物冲到目标身前
  播放金色掌印/伏魔劲特效
  命中爆点
```

### 2.3 策略攻击

策略攻击主要用于数字掌门、实盘策略 NPC、后续策略化角色。

表现要求：

1. 攻击者原地或小幅前移，不贴身冲到目标前。
2. 攻击者切换到 `attack` 姿态。
3. 从攻击者手前发射策略飞弹、数据流、阵法光束等远程特效。
4. 飞行特效命中目标身体前侧。
5. 命中时播放通用命中爆点或策略专属命中爆点。
6. 攻击者恢复 `idle` 姿态。

关键点：

- 策略攻击强调“推演、数据、实盘心跳”，不应表现成普通人贴身拳脚。
- 数字掌门的 `实盘推演`、`BTC 心跳` 走这个逻辑。

### 2.4 防御

防御是一个持续状态，不是一次性动画。

表现要求：

1. 角色选择防御后，立即切换到 `defense` 姿态。
2. 防御姿态持续保留。
3. 如果有护盾或防御特效，特效可以短暂播放，但人物姿态不能马上回到 `idle`。
4. 对手下一次攻击结算时，防御减伤生效。
5. 对手攻击表现、伤害结算、受击反馈完成后，防御者才恢复 `idle` 姿态。

关键点：

- 防御姿态的生命周期应绑定到 `defending = true`。
- 当前回合开始时清空防御是不够的，因为视觉上需要等到“挡完对手这一下”再恢复。
- 后续可以把防御拓展成架势、护体、策略护盾、格挡等多种表现。

## 3. 角色姿态资源

### 3.1 基础姿态

每个可战斗角色推荐提供四张基础姿态：

```text
idle.png      待机姿态
attack.png    攻击姿态
hit.png       受击姿态
defense.png   防御姿态
```

目录规范：

```text
packages/visual/public/assets/battle/characters/{characterId}/cutout/
  idle.png
  attack.png
  hit.png
  defense.png
```

示例：

```text
packages/visual/public/assets/battle/characters/player/cutout/idle.png
packages/visual/public/assets/battle/characters/digital_master/cutout/idle.png
```

### 3.2 姿态 fallback

不是所有 NPC 一开始都有完整贴图，因此必须支持 fallback：

```text
角色 attack 缺失 -> 使用角色 idle + 位移动画
角色 hit 缺失 -> 使用角色 idle + 闪白/震动
角色 defense 缺失 -> 使用角色 idle + 防御光效
角色全部缺失 -> 使用当前地图/旧战斗贴图
```

### 3.3 角色动作不绑定武功

角色动作只表达“这个人在攻击/防御/受击”，不直接表达某一个武功。

武功差异通过公共武功特效池表现：

```text
同一个 player attack 姿态
  + 吐纳功特效
  + 金刚伏魔入门特效
  + 后续剑法特效
```

这样避免每个角色为每个武功都生成一套动作，降低素材成本。

## 4. 公共武功特效池

### 4.1 特效池目标

武功特效池负责保存所有公共武功、策略、命中特效。

目标：

- 武功根据 `wugongId` 或 `skill.id` 选择特效。
- 多个角色可以复用同一个武功特效。
- 后续新增武功时，只需要添加特效资源和映射配置。
- 特效可以有不同播放方式：近身释放、飞行、护盾、范围爆发。

### 4.2 目录规范

```text
packages/visual/public/assets/battle/effects/
  common/
    cutout/
      hit_burst.png
  martial/
    cutout/
      palm.png
      tuna_qigong.png
      digital_fumo_intro.png
  strategy/
    cutout/
      projectile.png
      shield.png
      evolution.png
```

### 4.3 特效定义

建议新增一个配置表，描述每个技能使用什么特效：

```ts
type BattleEffectMode =
  | 'none'
  | 'melee_burst'
  | 'melee_wugong'
  | 'projectile'
  | 'shield'
  | 'self_aura';

interface BattleSkillEffectDef {
  skillId: string;
  textureKey: string;
  mode: BattleEffectMode;
  width: number;
  height: number;
  anchor: 'attacker_front' | 'target_front' | 'target_center' | 'self_center';
  durationMs: number;
  hitBurstScale: number;
}
```

示例映射：

```ts
normal_attack -> {
  textureKey: 'battle_effect_hit_burst',
  mode: 'melee_burst',
}

tuna_qigong -> {
  textureKey: 'battle_effect_martial_palm',
  mode: 'melee_wugong',
}

digital_fumo_intro -> {
  textureKey: 'battle_effect_martial_palm',
  mode: 'melee_wugong',
}

live_strategy_deduction -> {
  textureKey: 'battle_effect_strategy_projectile',
  mode: 'projectile',
}

btc_heartbeat -> {
  textureKey: 'battle_effect_strategy_projectile',
  mode: 'projectile',
}
```

## 5. 推荐动画流程

### 5.1 普通攻击流程

```text
player_select / enemy_turn
  -> phase = animating
  -> setActorStance(attacker, attack)
  -> move attacker to target front
  -> play hit_burst at target front
  -> resolve damage
  -> setActorStance(target, hit)
  -> show damage number
  -> move attacker back
  -> setActorStance(attacker, idle)
  -> maybe clear target hit stance
  -> nextTurn()
```

### 5.2 武功攻击流程

```text
player_select / enemy_turn
  -> phase = animating
  -> setActorStance(attacker, attack)
  -> move attacker to target front
  -> play wugong effect from effect pool
  -> resolve damage when effect reaches hit frame
  -> setActorStance(target, hit)
  -> play hit_burst at target front
  -> show damage number
  -> move attacker back
  -> setActorStance(attacker, idle)
  -> maybe clear target hit stance
  -> nextTurn()
```

### 5.3 策略攻击流程

```text
player_select / enemy_turn
  -> phase = animating
  -> setActorStance(attacker, attack)
  -> small forward step or no movement
  -> launch projectile from attacker front
  -> projectile flies to target front
  -> resolve damage on projectile hit
  -> setActorStance(target, hit)
  -> play hit_burst / strategy burst
  -> show damage number
  -> attacker returns if moved
  -> setActorStance(attacker, idle)
  -> nextTurn()
```

### 5.4 防御流程

```text
actor chooses defense
  -> phase = animating
  -> applyDefense(actor)
  -> setActorStance(actor, defense)
  -> play short shield/aura effect
  -> actor.defending = true
  -> nextTurn()

opponent attacks defender
  -> damage formula sees defender.defending = true
  -> defender stays defense until hit resolution
  -> after damage / block / shield text is shown
  -> clear defender.defending
  -> setActorStance(defender, idle)
```

## 6. 状态机要求

### 6.1 战斗阶段

当前阶段可以继续沿用：

```ts
type Phase =
  | 'idle'
  | 'intro'
  | 'player_select'
  | 'animating'
  | 'enemy_turn'
  | 'ended';
```

但角色自身需要有独立视觉状态：

```ts
type ActorVisualState =
  | 'idle'
  | 'attack'
  | 'hit'
  | 'defense'
  | 'dead';
```

### 6.2 防御状态和视觉状态分离

数值状态：

```ts
actor.defending = true
```

视觉状态：

```ts
actor.visualState = 'defense'
```

二者不能完全混在一起。原因：

- `defending` 决定减伤。
- `visualState` 决定贴图。
- 有些角色可能处于防御姿态但没有减伤，比如剧情演出。
- 有些角色可能有减伤 buff 但不一定显示防御姿态。

## 7. 战斗素材命名规范

### 7.1 角色 ID

角色目录使用逻辑 ID：

```text
player
digital_master
hv1
hv2
nv1
```

### 7.2 技能 ID

技能特效映射使用稳定技能 ID：

```text
normal_attack
tuna_qigong
digital_fumo_intro
live_strategy_deduction
btc_heartbeat
```

### 7.3 文件要求

角色图：

- PNG
- 透明背景优先
- 如果生成图是白底或绿底，需要处理成 `cutout`
- 全身居中，不裁切
- 不自带地面阴影，脚底阴影由代码统一画

特效图：

- PNG
- 透明背景
- 主体居中
- 不包含人物
- 不包含文字和 UI

背景图：

- 横版战斗舞台视角
- 中心区域干净，留给角色和特效
- 不遮挡人物

## 8. 当前实现和目标差距

当前已实现：

- 横版战斗主流程。
- 玩家和数字掌门战斗立绘接入。
- 数字门派战斗背景接入。
- 基础姿态切换。
- 策略飞弹、命中爆点、策略护盾接入。
- 普通攻击近身落点初步修正。

还需要补齐：

1. 把技能动画拆成 `normal / martial / strategy / defense` 四条明确管线。
2. 武功攻击从当前偏远程的逻辑改为“冲过去 + 武功特效”。
3. 新增公共武功特效映射配置。
4. 防御姿态持续到对手攻击结算后再恢复。
5. 角色视觉状态从临时 `setTexture + delayedCall` 升级为明确状态机。
6. 让其他 NPC 也能按同一套目录和 fallback 规则接入。

## 9. 第一阶段实现计划

第一阶段只做表现系统，不改伤害数值。

建议步骤：

1. 新增 `BattleSkillEffectCatalog.ts`，定义技能到特效的映射。
2. 新增 `ActorVisualState` 字段，统一记录每个角色当前姿态。
3. 重构 `performSkill`，按技能类型分发：
   - `performNormalAttack`
   - `performMartialAttack`
   - `performStrategyAttack`
   - `performDefense`
4. 武功攻击改为近身释放特效。
5. 防御姿态持续到被攻击结算后清除。
6. 为缺失素材的 NPC 保留 fallback。
7. 补单元测试覆盖：
   - 技能 ID 能解析到特效定义
   - 缺失技能使用默认特效
   - 防御状态在被攻击后清除

## 10. 长期扩展

后续可以继续扩展：

- 每个武功多帧 sprite sheet。
- 每个角色多段 attack 动作。
- 不同武功类型对应不同命中音效。
- 格挡、闪避、破防、暴击专属演出。
- 战斗镜头缩放和轻微震屏。
- 多人战斗时的横版站位队列。
- 策略 NPC 根据收益、回撤、实盘状态改变特效颜色和强度。

