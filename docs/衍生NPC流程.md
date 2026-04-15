# 衍生 NPC 流程

## 概述

衍生 NPC 是指由现有优秀策略通过分析、学习产生的新策略 NPC。不是随机生成，而是基于优秀基因的进化。

## 诞生条件（全部满足）

1. **优秀基因** — 父策略在同期排行榜前几名
2. **学习分析** — 分析同期其他策略的优点（如回撤控制好、胜率高）
3. **生成 Agent 目录** — 在 `data/agents/{id}/` 下创建新 agent，包含 profile 但暂无策略数据
4. **频率限制** — 每天最多衍生 1 个

## 衍生流程

```
后端定时任务（每天 1 次）
    │
    ├─ 1. 从排行榜中取 Top N 策略作为候选父策略
    │
    ├─ 2. LLM 分析父策略 + 同期其他策略的优点
    │     输入：父策略 profile + 同期策略表现对比
    │     输出：改进方向描述（如“继承追涨逻辑 + 加入回撤控制”）
    │
    ├─ 3. 生成新 Agent 目录
    │     data/agents/{new_id}/
    │     ├── profile.json          ← 姓名、描述、父母 ID、关系（杂交/变异）
    │     ├── memory/               ← 空目录，后续积累经验
    │     └── strategy/             ← 暂无策略数据，后续由心跳填充
    │
    ├─ 4. 更新 strategies.json（前端轮询的数据源）
    │     新增一条 Strategy 记录：
    │     - id: {new_id}
    │     - name: "[杂交]融合三号" 或 "[变异]三号"
    │     - category: "emerged"
    │     - parents: ["hv1", "hv4"]
    │     - relation: "杂交" | "变异"
    │     - returnPct: 0（新策略，暂无数据）
    │     - capital: 100000（初始资金）
    │
    └─ 5. 前端轮询发现新 ID → 在地图上创建新 NPC
```

## 前端表现

### 诞生位置

新 NPC 从**策略茶馆 (30, 90)** 走出。玩家可以看到一个新角色从茶馆方向出现。

### 视觉区分

名字标签区分，格式：
- 杂交：`[杂交]融合三号`
- 变异：`[变异]三号`

颜色使用 emerged 类别的蓝色（`#60a5fa`），与原始 NPC 的黄色（hot）和灰色（normal）区分。

### 数据同步

复用现有 `strategies.json` 轮询机制（10 秒间隔）：
1. 前端轮询到新 strategy ID
2. GameStore 检测到新策略 → 触发 `strategy:loaded` 事件
3. EntitySystem 创建新 Agent 实例
4. 新 Agent 出现在茶馆位置

## 实现清单

### 后端（packages/core）

| 步骤 | 文件 | 说明 |
|------|------|------|
| 定时任务 | 新增 `evolution/daily_derive.py` | 每天 1 次触发衍生逻辑 |
| 选父策略 | 复用 `storage/json_bridge.py` | 从排行榜取 Top N |
| LLM 分析 | 复用 `llm/client.py` + `llm/context.py` | 分析父策略 + 同期策略 |
| 生成 Agent | 复用 `storage/file_store.py` | 创建目录 + profile.json |
| 更新 JSON | 复用 `storage/json_bridge.py` | 更新 strategies.json |

### 前端（packages/visual）

| 步骤 | 文件 | 说明 |
|------|------|------|
| 检测新策略 | `core/GameStore.ts` | 轮询时 diff 策略列表，发现新 ID |
| 创建 Agent | `systems/EntitySystem.ts` | 为新策略创建 Agent 实例 |
| 出生位置 | `entities/Agent.ts` | emerged 类别初始位置设在茶馆坐标 |

### 数据结构

**profile.json 示例**：
```json
{
  "id": "e3",
  "name": "融合三号",
  "description": "继承人气追涨的选股逻辑，加入分时大票的回撤控制",
  "category": "emerged",
  "parents": ["hv1", "hv4"],
  "relation": "杂交",
  "created_at": "2026-04-15T10:00:00"
}
```

**strategies.json 新增条目**：
```json
{
  "id": "e3",
  "name": "[杂交]融合三号",
  "category": "emerged",
  "description": "继承人气追涨的选股逻辑，加入分时大票的回撤控制",
  "returnPct": 0,
  "maxDrawdownPct": 0,
  "totalTrades": 0,
  "winRate": 0,
  "avgReturnPct": 0,
  "capital": 100000,
  "state": "idle",
  "parents": ["hv1", "hv4"],
  "relation": "杂交"
}
```

## 暂不实现

- NPC 淘汰机制
- 衍生 NPC 的策略数据自动生成
- 诞生动画特效
