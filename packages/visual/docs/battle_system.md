# DeepSolo 战斗系统文档

## 概述

DeepSolo 战斗系统实现了金庸群侠传（JYQXZ）风格的等距视角回合制战斗。支持 **自动 AI 对战** 和 **手动键盘操控** 两种模式，可随时切换。

### 核心特性

- 等距菱形网格战场（10×10）
- 按轻功（速度）排序的回合制
- 6 种策略角色 + 各自专属武功
- JYQXZ 原版战斗精灵帧 + 走路精灵帧混合动画
- 武功特效贴图序列播放（含 AoE 范围扩散）
- Tab 键实时切换手动/自动模式
- 手动模式下完整的操作菜单：移动、攻击、防御、休息、状态、自动

## 架构

### 状态机

战斗系统使用嵌套状态机：

```
Phase (顶层)
├── idle        初始/结束
├── running     等待下一回合
├── animating   播放动画中（不可操作）
├── manual      手动控制（内嵌子状态机）
└── ended       战斗结束，等待清理

ManualPhase (手动子状态，仅 phase='manual' 时有效)
├── action_menu     显示操作菜单
├── move_select     光标选择移动目标
├── wugong_select   选择武功
└── target_select   光标选择技能释放中心点
```

### 文件结构

| 文件 | 职责 |
|------|------|
| `src/systems/BattleSystem.ts` | 战斗引擎：状态机、回合驱动、AI、渲染、手动控制 |
| `src/data/BattleData.ts` | 角色属性种子、武功定义、特效帧数 |
| `src/types.ts` | BattlePerson、WugongDef、ManualPhase 等类型定义 |
| `src/config.ts` | ARENA_SIZE、动画时长等常量 |
| `src/systems/SceneManager.ts` | 战斗模式下隐藏/恢复世界地图元素 |
| `src/ui/UIManager.ts` | 战斗时隐藏策略面板、小地图等 DOM UI |

## 战斗流程

### 触发方式

按 **B** 键触发测试战斗（`WorldScene` 中注册），随机选取两个策略角色进行对战。

### 启动流程

```
start(redId, blueId)
  → createBattlePerson() × 2   创建红蓝双方
  → initBattleKeys()            注册键盘监听（方向键/Space/ESC/Tab）
  → renderArena()               绘制战场背景 + 网格
  → renderPersons()             渲染角色精灵 + 名字 + 队伍标记
  → renderHUD()                 渲染 HP/MP 面板 + 回合标签 + 日志
  → emit('battle:start')
  → 延迟 800ms → nextTurn()
```

### 回合驱动

```
nextTurn()
  ├─ turnQueue 为空? → round++ → 按速度降序重排所有存活角色
  ├─ 取出队首 person
  ├─ isAutoMode? → executePersonTurn(person)   // AI 路径
  └─ 否则 → enterManualMode(person)            // 手动路径
```

### 结束条件

任一方 HP 降至 0 → 该方所有角色死亡 → 播放死亡特效 → 显示结束画面 → 3 秒后自动清理返回世界地图。

## 手动控制

### 模式切换

- **Tab** 键：在自动/手动模式间切换
- 切换为手动时：当前回合仍由 AI 完成，下一回合开始生效
- 切换为自动时：立即退出手动界面，当前角色由 AI 接管

### 键盘映射

| 按键 | 功能 |
|------|------|
| Tab | 切换手动/自动模式 |
| ↑↓←→ | 移动光标 / 切换菜单项 |
| Space | 确认 |
| ESC | 取消（返回上一级） |

### 操作菜单（ActionMenu）

屏幕右侧显示 6 项操作，上下选择，Space 确认：

| 序号 | 操作 | 说明 |
|------|------|------|
| 0 | 移动 | 进入移动选择子阶段 |
| 1 | 攻击 | 进入武功选择 → 选中心点 → 释放 |
| 2 | 防御 | 本回合受伤减半 |
| 3 | 休息 | 恢复 10% MP |
| 4 | 状态 | 在日志中显示当前属性 |
| 5 | 自动 | 切换回 AI 自动模式 |

ESC 在菜单中 = 等同休息（结束回合）。

### 移动选择（MoveSelect）

```
enterMoveSelect()
  → calcMoveRange(pos, moveRange)  // BFS 计算可移动范围
  → showMoveRange()                 // 蓝色半透明覆盖
  → showCursor()                    // 金色菱形光标（闪烁）
```

- 方向键移动光标（限制在 10×10 网格内）
- Space：如果光标在移动范围内 → 执行移动动画；否则提示"不能移动到该位置"
- ESC：取消，返回操作菜单（已移动的位置不保留）
- 移动到原位置：视为不移动，直接返回菜单

### 攻击流程（WugongSelect → TargetSelect）

```
操作菜单选"攻击"
  → 显示武功子菜单（专属武功 + 普通攻击）
  → MP 不足灰显
  → 确认武功
  → 进入 TargetSelect：光标选中心点
  → Space 确认
  → executeManualAttack()
      → 面朝中心点方向
      → 显示武功名（放大动画）
      → 播放攻击帧（fight 精灵帧序列）
      → 蓄力微蹲 → 弹出
      → 以中心点释放 AoE 特效
      → 计算 AoE 范围内敌人伤害
      → 命中反馈（闪红 + 震动 + 伤害数字）
      → 空挥（无敌人）也正常播放特效
```

### AoE（范围攻击）

技能有 `aoeSize` 属性（当前所有武功均为 3，即 3×3 范围）：

```
中心点 (cx, cy)
  覆盖范围: |dx| ≤ half && |dy| ≤ half
  half = floor(aoeSize / 2) = 1
  → 覆盖 9 个格子
```

AoE 特效采用波浪式扩散：按曼哈顿距离递增延迟播放每个格子的特效贴图，形成从中心向外扩散的视觉效果。

### 空挥

技能可以在没有敌人的位置释放（空挥）。此时仍正常播放武功名、攻击帧和特效动画，只是不造成伤害，日志显示"空挥"。

## 精灵动画系统

### 两套精灵图

| 精灵 | 来源 | 用途 | 帧命名 | 原始尺寸 | 显示缩放 |
|------|------|------|--------|----------|----------|
| Fight 精灵 | `assets/fight/` | 站立 + 攻击 | `fight000_{帧号}` | 23×50 px | `spriteScale = 2.0` → 视觉 46×100 px |
| Chars 图集 | `assets/char_atlas` | 走路 | `player_d{方向}_f{帧}` | 75×195 px | `walkSpriteScale = 0.51` → 视觉 ~38×100 px |

### 缩放匹配原理

Fight 精灵和 Chars 精灵的视觉高度需要匹配，避免切换时角色"跳大跳小"：

```
fight 视觉高度 = 50 × 2.0 = 100 px
chars 帧高度  = 195 px
walkSpriteScale = 100 / 195 ≈ 0.51
```

### 状态切换流程

```
站立（fight sprite，scale=2.0）
  ↓ 选择移动
移动（chars atlas 走路帧，scale=0.51）
  ↓ 到达目标
站立（fight sprite，scale=2.0）
  ↓ 选择攻击
攻击（fight sprite 攻击帧，scale 微蹲→弹出→恢复）
  ↓ 攻击完成
站立（fight sprite，scale=2.0）
```

### Fight 精灵帧布局

Attack Type 0 的 238 帧分布：

| 方向 | 帧范围 | Direction 映射 |
|------|--------|---------------|
| 右上 | 40-51 (12帧) | Direction.Up (0) |
| 右下 | 52-63 (12帧) | Direction.Right (1) |
| 左上 | 64-75 (12帧) | Direction.Left (2) |
| 左下 | 76-87 (12帧) | Direction.Down (3) |

站立帧 = 方向偏移量本身（如 Up 站立 = 帧 40）。

### Chars 走路帧

4 方向 × 7 帧（f0-f6），命名规则 `player_d{方向}_f{帧号}`：

| Direction | 方向后缀 d |
|-----------|-----------|
| Up (0) | 0 |
| Right (1) | 1 |
| Left (2) | 2 |
| Down (3) | 3 |

走路循环使用 `cycleWalkFrames()`，每 120ms 切换一帧，从 f1 开始（f0 为站立）。

## 攻击动画时间线

```
[0ms]        面朝目标方向
[0-400ms]    武功名放大显示（仅特殊武功）
[400ms]      开始播放攻击帧序列（12帧 × 50ms = 600ms）
[400-520ms]  蓄力微蹲（scale ×0.85/0.9）
[520-670ms]  原地弹出（scale ×1.15）
[670ms]      播放技能特效
[920ms]      恢复初始缩放 → 站立帧
[920ms]      命中反馈：闪红 + 震动 + 伤害数字
[1620ms]     检查胜负 → 下一回合
```

## 角色属性

> 属性数据存储在 `data/agents/{id}/battle.json`，前端从 `public/data/agents/` 加载。
> 详见 [Agent 角色档案系统文档](./agent_profile_system.md)。

### 初始属性表

| 策略 ID | 名称 | HP | MP | 攻击 | 防御 | 轻功 | 移动力 | 专属武功 | 数据文件 |
|---------|------|----|----|------|------|------|--------|----------|----------|
| hv1 | 人气追涨 | 800 | 300 | 65 | 35 | 40 | 5 | 追魂剑法 | `data/agents/hv1/battle.json` |
| hv2 | 妖股追涨 | 600 | 400 | 75 | 25 | 55 | 6 | 疯魔杖法 | `data/agents/hv2/battle.json` |
| hv3 | 上影线追涨 | 750 | 350 | 55 | 45 | 35 | 4 | 太极拳 | `data/agents/hv3/battle.json` |
| hv4 | 分时大票 | 1000 | 250 | 50 | 60 | 30 | 3 | 金刚伏魔功 | `data/agents/hv4/battle.json` |
| nv1 | 多信号综合 | 700 | 500 | 60 | 40 | 45 | 5 | 落英神剑掌 | `data/agents/nv1/battle.json` |
| nv2 | 早盘强势 | 850 | 300 | 70 | 30 | 50 | 5 | 独孤九剑 | `data/agents/nv2/battle.json` |

衍生 Agent 属性从父母之间随机插值生成（详见档案系统文档）。

### 武功定义

| 武功 | 类型 | MP | 威力 | 命中率 | 射程 | 特效 ID |
|------|------|-----|------|--------|------|---------|
| 普通攻击 | 拳 | 0 | 40 | 90% | 1 | 003 |
| 追魂剑法 | 剑 | 30 | 120 | 85% | 2 | 005 |
| 疯魔杖法 | 特殊 | 40 | 150 | 75% | 1 | 008 |
| 太极拳 | 拳 | 25 | 90 | 95% | 1 | 004 |
| 金刚伏魔功 | 内功 | 50 | 100 | 90% | 3 | 001 |
| 落英神剑掌 | 拳 | 35 | 130 | 80% | 2 | 006 |
| 独孤九剑 | 剑 | 45 | 160 | 80% | 2 | 009 |

武功类型颜色：拳=橙、剑=蓝、刀=红、特殊=紫、内功=绿。

## 伤害计算

```typescript
calcDamage(attacker, defender, skill):
  1. 命中判定: random() × 100 >= skill.hitRate → 未命中 (MISS)
  2. 基础伤害: skill.power × attacker.attack / (attacker.attack + defender.defense + 50)
  3. 随机波动: × (0.85 + random() × 0.30)   // ±15%
  4. 下限: max(1, result)
```

## AI 决策

自动模式下 AI 逻辑（`aiDecide()`）：

1. 敌人在攻击范围内且有足够 MP → 使用专属武功
2. 敌人在攻击范围内但 MP 不足 → 普通攻击
3. 不在攻击范围 → BFS 计算移动范围，选择离敌人最近的可达位置

## 移动范围计算

BFS 洪水填充算法（`calcMoveRange()`）：

```
起点: 角色当前位置
步数上限: person.moveRange
障碍: 被其他存活角色占据的格子
四方向扩展: 上、下、左、右
```

## 战场渲染

### 坐标转换

等距投影（`arenaToScreen()`）：

```typescript
cx = (ARENA_SIZE - 1) / 2   // 4.5
cy = (ARENA_SIZE - 1) / 2   // 4.5
hw = TILE_HALF_W × BATTLE_TILE_SCALE  // 18
hh = TILE_HALF_H × BATTLE_TILE_SCALE  // 9

screenX = hw × (dx - dy) + SCREEN_WIDTH / 2   // dx = x - cx
screenY = hh × (dx + dy) + SCREEN_HEIGHT / 2   // dy = y - cy
```

### 视觉元素

| 元素 | Depth | 说明 |
|------|-------|------|
| 战场背景 | 5000 | 半透明黑色遮罩 + 菱形网格 |
| 角色精灵 | y+100 | 按 Y 轴排序实现遮挡 |
| HP 条 | 同面板 | 左右两侧固定面板 |
| 范围覆盖 | 8000 | 蓝色移动范围 / 红色攻击范围 |
| 光标 | 9000 | 金色菱形闪烁 |
| 菜单 | 9500 | 操作菜单 / 武功子菜单 |
| 特效 | 9998 | 伤害数字 / 武功特效贴图 |
| 结束画面 | 9999 | 半透明遮罩 + 胜负信息 |

### 光标渲染

金色菱形（0xfbbf24），带填充（alpha 0.35）和粗边框（alpha 0.9），每 350ms 在 alpha 1.0 ↔ 0.3 间闪烁。

### 移动范围覆盖

蓝色菱形（0x3b82f6, alpha 0.25），在每个可达格子上绘制。

### 操作菜单

右侧 Container（x=SCREEN_WIDTH-150），圆角矩形背景（0x0f172a, alpha 0.92），金色边框（0xfbbf24, alpha 0.6）。选中项黄色加粗 + 金色底条高亮。

### 武功子菜单

操作菜单左侧弹出（x=SCREEN_WIDTH-290），绿色边框（0x44ffaa）。显示武功名和 MP 消耗，MP 不足灰显。

## 世界地图 UI 隐藏

进入战斗时，以下元素被隐藏：

| 元素 | 隐藏方式 |
|------|----------|
| 策略排行面板 | `panel.style.display = 'none'` |
| Token 面板 | `tokenPanel.style.display = 'none'` |
| 顶部统计栏 | `headerBar.setVisible(false)` |
| 小地图 canvas | `minimap.style.display = 'none'` |
| 调试信息 | `debugInfo.style.display = 'none'` |
| 世界 Agent | `entitySystem.setWorldAgentsVisible(false)` |
| 玩家精灵 | `player.container.setVisible(false)` |
| 地图瓦片图 | `mapRenderer.scrImage.setVisible(false)` |
| 建筑标记 | `setBuildingMarkersVisible(false)` |

战斗结束后全部恢复。

## 配置常量

| 常量 | 值 | 说明 |
|------|-----|------|
| ARENA_SIZE | 10 | 战场网格尺寸 |
| BATTLE_ANIM_SPEED | 400 ms | 移动动画时长 |
| BATTLE_TURN_DELAY | 300 ms | 回合间隔 |
| BATTLE_LOG_MAX | 6 | 日志最大行数 |
| FIGHT_FRAMES_PER_DIR | 12 | 每方向攻击帧数 |
| FIGHT_FRAME_INTERVAL | 50 ms | 攻击帧切换间隔 |
| BATTLE_TILE_SCALE | 1.0 | 战场瓦片缩放（与世界地图等大） |
| spriteScale | 2.0 | Fight 精灵缩放 |
| walkSpriteScale | 0.51 | Chars 走路精灵缩放 |
| WALK_FRAME_COUNT | 7 | 走路帧数 |
| WALK_FRAME_INTERVAL | 120 ms | 走路帧切换间隔 |

## 操作验证清单

1. `npm run dev` 启动
2. 按 **B** 触发战斗（默认自动 AI 模式）
3. 按 **Tab** 切换为手动模式（下一回合生效）
4. 手动模式验证：
   - 方向键切换菜单项，Space 确认
   - 移动：蓝色范围显示，光标选格，Space 确认移动，角色播放走路动画
   - 攻击：选武功 → 光标选中心点 → Space 释放 → AoE 特效扩散
   - ESC 取消返回上一级
   - 状态：显示 HP/MP/ATK/DEF
   - 自动：切回 AI 模式
5. 战斗结束 → 3 秒自动返回世界地图 → 所有 UI 恢复
