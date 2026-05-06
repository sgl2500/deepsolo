# Unified Combat World Rule V1

**日期：** 2026-05-06  
**状态：** 已实现前端战斗接入，后端投影元数据已补齐，数值仍需实战调优

## 1. 目标

这一轮不是继续给单个角色打补丁，而是把“主角 / 掌门 / 弟子 / 其他策略 NPC”统一拉进一套世界规则里。

核心要求：

- 不单独给玩家开一套战斗公式。
- 实盘角色天然更强，但这种强不通过写死特例实现，而通过统一参数 `existenceTier` 体现。
- `hp` 是真实战斗生命，不是展示值。
- `returnPct` 强挂钩生命值。
- `maxDrawdownPct` 先挂钩体质，再影响防御。
- `attack` 在 V1 只对策略收益做弱挂钩，避免收益率直接把伤害打穿。

## 2. 世界规则定义

### 2.1 存在层级

- 普通角色 / 非实盘角色：`existenceTier = 1`
- 实盘 / workspace-backed 角色：`existenceTier = 10`

前端默认推导规则：

- 有 `strategy.existenceTier` 时直接使用。
- 没有显式字段，但存在 `sourceWorkspace` 时，视为 `10`。
- 其余情况视为 `1`。

### 2.2 统一基础属性

V1 的统一基础值：

- 力量、智力、敏捷、体质：默认 `10`
- 生命、内力、攻击、防御、命中、闪避相关属性：默认 `10`

玩家旧存档会被抬到这个基线，避免旧档继续沿用过低数值。

### 2.3 生命公式

统一生命公式落在 `packages/visual/src/data/CombatProfile.ts`：

```ts
maxHp = max(100 * existenceTier, round(existenceTier * (200 + returnPct)))
```

这意味着：

- 普通角色，收益率 `100%` => `300 HP`
- 实盘角色，收益率 `100%` => `3000 HP`

这正是本轮想要的“实盘角色天然更厚”的结果，而且它来自统一规则，不来自单独分支。

### 2.4 回撤 -> 体质 -> 防御

V1 先采用简单映射：

```ts
constitutionBonus = max(0, floor((20 - maxDrawdownPct) / 2))
constitution = baseConstitution + constitutionBonus
defenseAttr = baseDefenseAttr + constitutionAttrBonus + constitutionBonus
defense = max(40, defenseAttr * 10)
```

含义：

- 回撤越小，体质越高
- 体质越高，防御越高

这套映射先确保世界观方向正确，后面再调比例。

### 2.5 攻击弱挂钩

V1 不让收益率直接爆炸式影响输出，只给小幅加成：

- `existenceTier` 给少量固有攻击加成
- `returnPct` 通过步长换算成少量攻击加成

当前实现目标是：

- 实盘角色有稳定压制感
- 但战斗胜负不完全被收益率单点决定

## 3. 本轮实现范围

### 3.1 新增统一战斗档案模块

新增文件：

- `packages/visual/src/data/CombatProfile.ts`

职责：

- 统一生成策略角色战斗档案
- 统一生成玩家战斗档案
- 推导 `existenceTier`
- 输出 `maxHp / maxMp / attack / defense / speed / hitRate / dodgeRate`

### 3.2 前端战斗角色不再以 `battle.json` 为真源

调整文件：

- `packages/visual/src/data/BattleData.ts`

变更方向：

- 策略角色存在 `Strategy` 数据时，真实战斗属性来自 `CombatProfile`
- `battle.json` 退回为“战斗载具配置”，只负责：
  - `wugongId`
  - `moveRange`

这样做的好处是：

- 战斗规则只维护一份
- 外部 workspace 策略和普通策略 NPC 能统一进入战斗
- 后面要继续挂钩更多策略字段时，不需要每次回头重写静态战斗 JSON

### 3.3 玩家也接入统一世界规则

调整文件：

- `packages/visual/src/core/GameStore.ts`
- `packages/visual/src/data/BattleData.ts`
- `packages/visual/src/systems/BattleSystem.ts`

当前做法：

- 玩家默认档案升级到 `version: 2`
- 基础属性抬到 `10`
- 基础血蓝抬到 `200 / 200`
- 进入战斗时，玩家用统一 `buildPlayerCombatProfile(...)`
- 战斗结束后，把 `hp/mp/maxHp/maxMp` 同步回长期档案

这保证了“玩家不是例外角色”，只是世界里一个 `existenceTier = 1` 的个体。

### 3.4 伤害模型重算

调整文件：

- `packages/visual/src/systems/battle/BattleRules.ts`
- `packages/visual/src/types/battle.ts`

新增战斗字段：

- `existenceTier`
- `hitRate`
- `dodgeRate`

V1 伤害公式：

```ts
hitChance = clamp(skill.hitRate + (attacker.hitRate - defender.dodgeRate) * 2, 20, 98)
damage = round((effectiveSkillPower + attacker.attack - defender.defense * 0.6) * randomMod)
```

原因：

- 旧公式更适合低血量战斗
- 在 `2000~3000 HP` 世界里会显得过平
- 新公式先确保角色打得动，命中/闪避也开始进入系统

### 3.5 实盘 workspace 元数据补齐

调整文件：

- `packages/core/deepsolo/projection/strategy_workspace.py`
- `packages/core/deepsolo/storage/json_bridge.py`
- `packages/visual/src/types/strategy.ts`

本轮没有强行把后端战斗公式同步成新公式，只做了两件必要的事情：

- workspace 投影写入 `existenceTier = 10`
- `strategies.json` 桥接时把 `existenceTier` 带到前端

这样前端战斗已经能按统一世界规则识别实盘角色。

## 4. `.gitignore` 修正

这一轮还发现一个工程问题：

- `deepsolo/.gitignore` 里的 `data/` 规则会误伤 `packages/visual/src/data/`

后果是：

- 前端真实源码目录一直被误忽略
- 新增的 `CombatProfile.ts`、`BattleData.ts` 等文件不会进入版本控制

本轮修正方式：

```gitignore
data/
!packages/visual/src/data/
!packages/visual/src/data/**
```

这样可以同时满足：

- 继续忽略根目录 `data/` 和 `packages/visual/public/data/` 这类运行生成数据
- 放开 `packages/visual/src/data/` 这棵真实源码目录

## 5. 校验结果

已完成校验：

- `cd packages/visual && npm run typecheck`
- `cd packages/visual && npm run test:unit`
- `cd packages/visual && npm run build`

单测补充内容：

- live 策略 `100% return` => `3000 HP`
- non-live 策略 `100% return` => `300 HP`
- 低回撤提升体质与防御
- 命中 / 闪避影响命中判定

## 6. 当前边界

这次只把统一世界规则接入到前端战斗主链路，没有一次性把所有周边都重写。

明确没做的部分：

- 后端 `battle.json` 生成公式尚未改造成同一套数值逻辑
- 角色面板还没有完整展示“力量 / 智力 / 敏捷 / 体质 / 命中 / 闪避”等新维度
- 武功威力、回合节奏、实战 TTK 还需要实机调参
- 还没有把“资金 / 风险 / 仓位 / 回撤 / 生存”进一步扩展成更细战斗子系统

## 7. 下一步建议

建议按这个顺序继续：

1. 先实战打一轮数字掌门，观察真实 TTK、命中率、压制感是否符合预期。
2. 再决定要不要把 `attack / speed / mp` 继续挂钩更多策略字段。
3. 最后再把后端 `battle.json` 投影规则收敛到同一世界规则，避免双轨数值来源长期并存。
