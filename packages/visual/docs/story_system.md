# DeepSolo 剧情系统文档

## 概述

剧情系统实现了可扩展的 JYQXZ 风格对话事件。通过声明式脚本定义剧情内容和触发条件，StorySystem 作为通用引擎执行脚本，添加新剧情只需写数据、不改代码。

### 核心特性

- 声明式故事脚本（纯数据驱动）
- 可扩展的条件/动作注册表（StoryRegistry）
- 自动触发检测（进入建筑时检查条件）
- 打字机效果 + 分支选择（复用 ConversationPanel）
- 故事状态持久化（localStorage）
- 优先级排序 + 防重复触发

## 架构

```
进入建筑 → scene:state-changed
              ↓
         StorySystem.checkTriggers()
              ↓
         遍历 STORY_SCRIPTS（按 priority 降序）
              ↓
         匹配 trigger（buildingId + conditions）
              ↓
         startStory() → emit conv:open
              ↓
         showNode() → emit conv:message（打字机效果）
              ↓
         玩家选择 → emit conv:choice → handleChoice()
              ↓
         执行 actions（setFlag / markCompleted / addLog）
              ↓
         endStory() → emit conv:close
```

**核心原则**：StorySystem 直接通过 `conv:*` 事件驱动 ConversationPanel（复用现有 UI），不修改 DialogueSystem。

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/systems/StorySystem.ts` | 核心引擎：触发检测、状态机、打字机、动作执行 |
| `src/data/StoryScripts.ts` | 声明式故事脚本数据 |
| `src/data/StoryRegistry.ts` | 条件谓词 + 动作处理器注册表 |
| `src/types.ts` | StoryScript/StoryNode/StoryTrigger/StoryAction 等类型 |
| `src/core/GameStore.ts` | storyFlags、completedStories、持久化 |
| `src/config.ts` | LS_KEY_STORY 常量 |
| `src/scenes/WorldScene.ts` | 实例化 StorySystem，接入 update() |

## 类型系统

### StoryScript — 完整故事脚本

```typescript
interface StoryScript {
  id: string;                  // 唯一标识
  trigger: StoryTrigger;       // 触发条件
  priority?: number;           // 越高越优先（默认 0）
  firstNode: string;           // 首个节点 ID
  nodes: Record<string, StoryNode>;  // 所有对话节点
  onStart?: StoryAction[];     // 故事开始时执行
  onComplete?: StoryAction[];  // 故事结束时执行
}
```

### StoryTrigger — 触发器

```typescript
interface StoryTrigger {
  sceneState: 'indoor';        // 触发场景（目前仅室内）
  buildingId: string;          // 建筑 ID
  conditions: StoryCondition[];// 附加条件（全部满足才触发）
  oncePerVisit?: boolean;      // 每次进入只触发一次（默认 true）
}
```

### StoryNode — 对话节点

```typescript
interface StoryNode {
  id: string;
  speaker: string;             // 说话人
  portraitKey: string;         // 头像 key
  text: string;                // 对话文本
  choices?: StoryChoice[];     // 分支选项
  next?: string;               // 自动跳转下一节点
  showCondition?: StoryCondition; // 不满足则跳到 next
  onShow?: StoryAction[];      // 显示时执行
}
```

### StoryChoice — 分支选项

```typescript
interface StoryChoice {
  text: string;
  next: string;                // 跳转节点
  showCondition?: StoryCondition; // 不满足则隐藏
  onSelect?: StoryAction[];    // 选中时执行
}
```

## 条件注册表

| 条件名 | 参数 | 说明 |
|--------|------|------|
| `strategy_exists` | `{ strategyId }` | 指定策略存在 |
| `strategy_return_gt` | `{ strategyId; threshold }` | 策略存在且 returnPct > threshold |
| `flag_not_set` | `{ flag }` | 故事标记未设置 |
| `flag_is` | `{ flag; value? }` | 故事标记等于指定值（默认 true） |
| `day_gt` | `{ day }` | 天数大于指定值 |
| `never_completed` | `{ storyId }` | 指定故事从未完成 |

## 动作注册表

| 动作名 | 参数 | 说明 |
|--------|------|------|
| `set_flag` | `{ flag; value? }` | 设置故事标记 |
| `mark_completed` | `{ storyId }` | 标记故事完成 |
| `add_event_log` | `{ agentName; text }` | 添加事件日志 |

## 首个剧情：传功

### teahouse_skill_transfer（首次传功）

- **优先级**：10
- **触发**：策略茶馆 + hv4 存在 + returnPct > 50 + 未完成
- **触发时机**：进入茶馆 1 秒后自动检测

```
start (陈掌柜) → "今天来了位高手..." → 选择: 过去看看 / 下次再说
  ↓ 过去看看
approach (传功高人) → "我有一套分时大票追涨心法..." → 选择: 赐教 / 考虑
  ↓ 赐教
accept → 传授三个要点
  → accept_2 → "知行合一"
  → accept_3 (陈掌柜) → "恭喜获得心法"
  onComplete: setFlag(learned_hv4_transfer), markCompleted, addEventLog

  ↓ 考虑
polite_decline → "等你准备好了再来"

  ↓ 下次再说
decline_early → "不勉强"
```

### teahouse_transfer_followup（后续再遇）

- **优先级**：5
- **触发**：策略茶馆 + flag_is(learned_hv4_transfer)
- **每次进入可触发一次**，不标记 completed

```
greeting (传功高人) → "上次教的心法领悟如何？" → 选择: 收益不错 / 还在研究
  ↓ 收益不错
good_report → "策略要与时俱进"
  ↓ 还在研究
encourage → "不急，先做好风控"
```

## 状态持久化

故事状态存储在 `localStorage`，key 为 `deepsolo_story`：

```json
{
  "flags": { "learned_hv4_transfer": true },
  "completed": ["teahouse_skill_transfer"]
}
```

- `flags`：故事标记，用于条件判断
- `completed`：已完成的故事 ID 列表，防止重复触发

## 可扩展性设计

**添加新剧情只需 3 步**：

1. **`StoryScripts.ts`** 中添加新的脚本对象（纯数据）
2. 如果需要新条件/动作，**`StoryRegistry.ts`** 中添加 `conditions.set()` 或 `actions.set()`
3. 如果需要新的触发时机（如天数触发），在 StorySystem 中添加新的 eventBus 订阅

**StorySystem 不需要修改** — 它是通用的脚本执行引擎。

## 验证方式

1. `npm run dev` 启动
2. 走到策略茶馆入口（世界地图 (30,90) 附近），进入茶馆
3. 进入茶馆 1 秒后，应自动弹出"传功"对话
4. 选择"过去看看" → "请前辈赐教" → 看到传功对话
5. 对话结束，事件日志出现"在策略茶馆习得分时大票追涨心法"
6. 退出茶馆，再次进入 → 应触发 followup 对话
7. 刷新页面 → 故事状态从 localStorage 恢复，不会重新触发已完成的主故事
