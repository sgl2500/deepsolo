# DeepSolo 游戏流程设计 — 第一阶段：观察者入门

## 核心理念

新人作为观察者进入策略世界，由收益最低的策略 NPC 担任入门引导。完成引导后走出出生地，看到完整的策略世界。

**设计原则**：玩家从"什么都不懂"到"知道能干什么"，用时不超过 3 分钟。

## 整体流程

```
[新建存档] → 出生场景（观察者小屋）
                ↓
          引导 NPC 对话（3 轮）
                ↓
          走出小屋 → 世界地图
                ↓
          自由探索（NPC 对话 / 建筑 / 策略）
```

## 1. 出生场景

### 来源

地图数据从 **JYQXZ 原版场景 70**（主角家/基地）中截取的一个封闭房间。

原版场景 70 是玩家的大本营：
- `CC.NewGameSceneID = 70` — 新游戏出生点
- `CC.NewGameSceneX = 16, CC.NewGameSceneY = 31` — 原版出生坐标
- 按 H 键可随时回家（`Menu_HYZB()` → scene 70）
- 事件 690 提供回家休息/练功功能

我们截取了该场景左侧的封闭房间（原版坐标 x:6-14, y:26-36），包含墙壁、门、家具等完整元素。

### 场景数据

- **场景 ID**: `birth_house`
- **类型**: 室内场景（复用现有 smap 瓦片渲染系统）
- **大小**: 9×11（原版房间实际尺寸）
- **地图文件**: `public/assets/maps/indoor/indoor_birth_house.json`
- **瓦片来源**: JYQXZ `smap_1142`（地板）、`smap_1504`（墙壁）、`smap_1514`（柱子）、`smap_2554`（家具）等

### 房间布局（从原版数据）

```
 y26: D # # # # # D     ← 北墙，左右各一扇门
 y27: | . . F . . |     ← 家具（桌子）
 y28: | . . . . . |
 y29: | . . . . . S     ← 右侧台阶（通向走廊）
 y30: | . . . . . .
 y31: | . . . . . .     ← 玩家出生点 (4, 5)
 y32: | . . . . . T     ← 右侧门槛
 y33: | . . . . . |
 y34: | . . . . . |
 y35: | . . . . . |
 y36: D # # # # # D     ← 南墙，左右各一扇门（出口）
```

### 坐标映射

| 用途 | 房间内坐标 | 说明 |
|------|-----------|------|
| 玩家出生 | (4, 5) | 房间中央偏北 |
| 引导 NPC | (3, 1) | 桌子旁（y27 家具旁） |
| 出口（南门） | (0, 10) 或 (6, 10) | 南墙左侧或右侧门 |
| 北门 | (0, 0) 或 (6, 0) | 封锁（新手不从此出） |

## 2. 引导 NPC

### 角色选取规则

**由当前收益最低的存活策略 Agent 担任引导者**。

理由：收益最低的策略最理解"失败"，也最渴望新人来学习避免同样的错误。这给角色赋予了故事合理性——"我亏过，所以我知道什么不该做"。

当前初始数据下：

| Agent | returnPct | 角色 |
|-------|-----------|------|
| nv1 | -13.6% | **引导者**（收益最低） |
| hv2 | -3.2% | — |
| nv2 | -0.2% | — |
| hv3 | 4.7% | — |
| hv1 | 20.25% | — |
| hv4 | 77.1% | — |

> 注意：引导者不是固定 nv1，而是每次从 GameStore 动态取收益最低的存活 Agent。
> 如果后端数据更新后 nv1 被天道消灭，自动换为新的最低收益者。

### NPC 定义

```typescript
{
  id: 'guide',
  name: '引路人',        // 动态显示为实际策略名
  mapId: 'birth_house',
  mapX: 3,
  mapY: 1,               // 桌旁位置
  charKey: 'npc_1001',
  dialogueId: 'birth_guide',
  defaultDir: Direction.Down,
}
```

## 3. 引导对话设计

对话分 3 轮，每轮教一件事。空格推进，选择题确认理解。

### 第一轮：你是谁

```
引路人:
  "欢迎来到策略世界，新人。我是{name}，
   目前收益{returnPct}%——没错，全场最低。
   正因为亏过，所以我成了引路人。
   在这个世界里，每个角色都是一个交易策略。"
  → 下一步
```

### 第二轮：你能做什么

```
引路人:
  "在这个世界，你可以做这些事：
   · 走近 NPC 按空格对话，了解他们的策略思路
   · 进入建筑探索，比如策略茶馆、证券交易所
   · 按 B 键可以触发策略之间的切磋战斗
   · 观察策略的收益变化，理解什么策略有效"
  → 选项: [懂了 / 再说一遍]
```

### 第三轮：出门

```
引路人:
  "好了，你已经知道基本情况。
   走出这个门，就是策略世界的全貌。
   记住，观察是最好的老师。
   有空回来找我聊聊，我会告诉你我踩过的坑。"
  → 对话结束
```

**对话结束后**：出口自动亮起（或解锁），玩家走出门进入世界地图。

## 4. JYQXZ 原版对照

原版新游戏流程（事件 691）做了类似的事：

| 原版 | DeepSolo 对应 |
|------|--------------|
| 场景 70 出生 | `birth_house` 室内场景 |
| 初始属性 HP=50 MP=100 | 观察者初始状态 |
| 给予物品（银子 400 两） | 初始余额 10000 |
| 解锁场景 19/101/36/28/93 | 解锁世界地图全部区域 |
| 事件 690 "回家"（练功/休息/起程） | 后续可扩展回访功能 |
| 仆人说"公子，你回来了" | 引导 NPC 的后续对话 |

原版事件 691 的核心流程：
```
播放音乐 → 设置玩家位置(16,31) → 走到(9,31) → 淡出
→ 放置 NPC（图片 8250）→ 给物品 → 设置场景入口事件 → 解锁区域 → 淡入
```

我们的流程简化为：
```
进入 birth_house → 延迟 1s → 自动触发引导对话 → 对话结束 → 玩家走出门
```

## 5. 存档与重玩

### localStorage 判断

复用 `LS_KEY_STORY`，新增 `tutorialCompleted` 字段。

```typescript
// GameStore
tutorialCompleted: boolean;

// 恢复时
tutorialCompleted = saved?.tutorialCompleted ?? false;
```

### 启动流程

```
BootScene.create()
  → preloadAgentProfiles()
  → GameStore 恢复存档
  → this.scene.start('WorldScene')

WorldScene.create():
  → tutorialCompleted?
    → true:  正常出生在世界地图中心 (50, 50)
    → false: 自动进入 birth_house，延迟触发引导对话
```

### 世界地图上的位置

```typescript
// SceneData.ts
{ id: 'birth_house', name: '观察者小屋', x: 50, y: 55, entryRadius: 2 }

// BuildingData.ts
{
  id: 'birth_house',
  name: '观察者小屋',
  entryX: 50,
  entryY: 55,
  entryRadius: 2,
  indoorMapKey: 'indoor_birth_house',
  spawnX: 4,
  spawnY: 5,
  exitX: 0,
  exitY: 10,
  returnX: 50,
  returnY: 58,
}
```

## 6. 实现步骤

### Step 1: 室内地图 ✅

已完成：从 JYQXZ 场景 70 提取 9×11 房间 → `public/assets/maps/indoor/indoor_birth_house.json`
缺失瓦片已提取：`smap_1142`、`smap_1504`、`smap_1514`、`smap_1526`、`smap_1530`、`smap_2474`

### Step 2: BootScene 预加载

在 `BootScene.ts` 的 `preload()` 中加载 `indoor_birth_house.json` 地图数据。
在 `create()` 中调用 `preloadAgentProfiles()` 完成后启动 WorldScene。

### Step 3: BuildingData + SceneData

注册 `birth_house` 建筑（含室内坐标、出口、世界地图位置）。

### Step 4: NPCData + DialogueScripts

新增引导 NPC 和 3 轮引导对话。

### Step 5: GameStore

新增 `tutorialCompleted` + `getLowestReturnAgent()`。

### Step 6: WorldScene 启动逻辑

`!tutorialCompleted` 时自动 `sceneManager.enterBuilding('birth_house')`，延迟触发引导对话。

### Step 7: 引导结束处理

对话 `onComplete` 设置 `tutorialCompleted = true` 并持久化。

## 7. 扩展预留

- **引导者身份动态化**: 从后端取最低收益 Agent 的 `profile.json`，显示真实名称和性格
- **回访功能**: 老玩家回到小屋，引导者说"又回来了？有什么新发现？"（类似原版事件 690）
- **Phase 2 衔接**: 引导者暗示"这个世界里有高手，你可以找他们拜师学艺"
- **原版回家功能**: 类似 JYQXZ 的 H 键回城，可传送到出生小屋休息/查看进度

## 8. 文件清单

| 操作 | 文件 | 内容 |
|------|------|------|
| ✅ 新建 | `public/assets/maps/indoor/indoor_birth_house.json` | 9×11 室内地图（JYQXZ 场景 70） |
| ✅ 新增 | `public/assets/jy-runtime/10_smap/1142.png` 等 | 缺失瓦片已提取 |
| 修改 | `src/data/BuildingData.ts` | 新增 birth_house 建筑 |
| 修改 | `src/data/SceneData.ts` | 新增 birth_house 场景坐标 |
| 修改 | `src/data/NPCData.ts` | 新增引导 NPC |
| 修改 | `src/data/DialogueScripts.ts` | 新增 birth_guide 对话 |
| 修改 | `src/core/GameStore.ts` | 新增 tutorialCompleted + getLowestReturnAgent |
| 修改 | `src/scenes/BootScene.ts` | 预加载 birth_house 地图 |
| 修改 | `src/scenes/WorldScene.ts` | 启动时判断教程流程 |
| 修改 | `src/systems/StorySystem.ts` | 新增出生引导触发 |
