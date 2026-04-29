# BattleSystem 拆分计划

`BattleSystem.ts` 当前承担战斗状态机、手动输入、AI、移动/攻击规则、动画、HUD、日志和结算等职责，已经超过 2400 行。后续新增战斗功能前，应按本文逐步拆分。

## 当前职责盘点

| 区间 | 职责 | 建议归属 |
| --- | --- | --- |
| 初始化与生命周期 | `start*`、`update`、`destroy`、`cleanup` | `BattleSystem` 主协调器 |
| 手动控制 | 键盘输入、菜单阶段、移动/武功/目标选择 | `BattleInputController` / `BattleManualController` |
| AI | `aiDecide` | `BattleAI` |
| 战斗规则 | 伤害、范围、移动路径、技能威力、胜负判定 | `BattleRules` |
| 动画调度 | 移动、攻击、特效、受击、死亡 | `BattleAnimationDirector` |
| HUD 与菜单 | 行动菜单、武功菜单、状态面板、日志、结束页 | `BattleHUDRenderer` |
| 坐标与棋盘 | `arenaToScreen`、棋盘绘制、菱形绘制 | `BattleBoardRenderer` |

## 目标结构

建议最终形成：

```text
src/systems/battle/
  BattleSystem.ts              # 主协调器，保留状态机和子模块调度
  BattleRules.ts               # 纯规则：伤害、距离、范围、路径、胜负
  BattleAI.ts                  # AI 决策
  BattleInputController.ts     # 键盘输入归一化
  BattleManualController.ts    # 手动战斗阶段流转
  BattleBoardRenderer.ts       # 棋盘、范围、光标、坐标换算
  BattleHUDRenderer.ts         # HUD、菜单、日志、结束页
  BattleAnimationDirector.ts   # 动画编排，复用 BattleAnimator
```

## 分阶段迁移

### 阶段 1：抽纯规则（已开始）

状态：2026-04-29 已新增 `src/systems/battle/BattleRules.ts`，并迁移/接入以下规则函数。

优先迁移无 Phaser 依赖或弱 Phaser 依赖的逻辑：

- `manhattanDist`（已迁移）
- `isInAttackRange`（已迁移）
- `calcAttackRange`（已迁移）
- `calcMoveRange`（已迁移）
- `calcMovePath`（已迁移）
- `calcDamage`（伤害公式已迁移为 `calcBattleDamage`，主类仍负责玩家武功倍率）
- `checkEnd`（已迁移为 `checkBattleEnd`）
- `uniqueSkills`（已迁移）
- `getEnemy`（已迁移）
- `getSkillAreaSize`（已迁移）

验收：规则函数可单独导入，`BattleSystem` 只调用规则模块。当前 `npm run typecheck` 已通过；完整回归仍以 `npm run check` 和手动战斗验证为准。

### 阶段 2：抽 AI 与输入（已开始）

状态：2026-04-29 已新增 `src/systems/battle/BattleAI.ts` 和 `src/systems/battle/BattleInputController.ts`。

- `aiDecide` 已迁移为 `decideBattleAI`。
- `initBattleKeys`、`getBattleInput` 已迁移到 `BattleInputController`。
- 手动阶段流转仍保留在主类，后续可再抽 `BattleManualController`。

验收：`npm run typecheck` 已通过；自动/手动战斗行为需要继续手动回归。

### 阶段 3：抽 HUD 与棋盘渲染（已完成）

- 行动菜单、武功菜单、状态面板、日志、结束页迁移到 `BattleHUDRenderer`。
- 棋盘、范围、光标、坐标换算迁移到 `BattleBoardRenderer`。

状态：2026-04-29 已新增 `src/systems/battle/BattleBoardRenderer.ts` 和 `src/systems/battle/BattleHUDRenderer.ts`，并完成以下渲染职责迁移：

- `renderArena`：战斗背景、标题、地砖与棋盘线。
- `arenaToScreen` / `getBoardCenter`：战斗棋盘坐标换算。
- 光标显示、隐藏与位置更新。
- 移动范围和攻击范围覆盖层。
- 双方状态卡、生命/内力条、回合标签。
- 行动菜单、武功菜单、提示文字。
- 战斗记录和战斗结束遮罩。

- 当前行动环、目标环、人物脚底阴影仍留在 `BattleSystem.ts`，因为它们和人物状态、手动阶段更新强绑定。

验收：`npm run check` 已通过；`BattleSystem.ts` 已降至约 1411 行，退出大文件治理告警。

### 阶段 4：抽动画调度

- `animateMove`
- `animateAttack`
- `playAoeEffect`
- `playEftSprite`
- `playHitFlash`
- `playDeathEffect`

迁移到 `BattleAnimationDirector`，主类只提供回调和状态更新。

验收：走路帧、攻击帧、武功特效、死亡表现不变。

## 禁止事项

- 不要在拆分阶段同时改 UI 设计或战斗数值。
- 不要一次性搬完整文件，避免定位回归困难。
- 不要让 renderer 直接修改玩家持久化数据，数据写回仍由主流程协调。

## 回归清单

每完成一个阶段，至少验证：

1. 发起玩家 vs NPC 战斗。
2. 初始站位为左下对右上，双方对视。
3. 手动移动不能穿人，移动动画正常。
4. 普通攻击距离与单格表现正常。
5. 武功熟练度增长，命中/空挥逻辑正常。
6. 战斗结束后玩家生命/内力正确回写。
