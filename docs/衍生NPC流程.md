# 衍生 NPC 流程

## 概述

衍生 NPC 有两种诞生方式：
1. **心跳派生** — 定时从排行榜 Top 策略中选父代，LLM 生成子代
2. **讨论涌现** — NPC 随机碰面，基于真实数据自我诊断，双向互补时产生融合策略

两种方式产出的都是”空壳 Agent”（有经验洞察，无策略代码），等待夜间系统回填数据后才能参与后续讨论。

## 心跳派生

### 诞生条件

1. 存活 Agent >= 2
2. 每 24 小时自动触发一次
3. 取收益 Top 2 作为父策略
4. LLM 综合分析生成新策略名称和描述

### 实现代码

`packages/core/deepsolo/evolution/derive.py` — `run_derivation()`

## 讨论涌现

### 诞生条件

1. 已实现的 Agent >= 2（有完整交易数据）
2. 随机选 2-3 个碰面
3. 每个 Agent 自我诊断（优势/问题/需求）
4. **双向互补** — A 的优势解决 B 的需求，反之亦然
5. 互补 + LLM 确认涌现 → 诞生新 Agent
6. 不互补 → 仅记录经验，不诞生

### 实现代码

`packages/core/deepsolo/evolution/discuss.py` — `run_discussion()`

详细设计见 [社区讨论演化文档](community_evolution.md)

## 衍生 Agent 的生命周期

```
诞生（空壳）
  ├─ profile.json: 名字、人设、父代关系
  ├─ experience.json: 继承的洞察 + 诞生洞察
  └─ strategy/: 空目录
      ↓
夜间系统回填
  ├─ 读取 experience.json
  ├─ 实现策略代码
  ├─ 回测 → 交易记录 + 账户数据
  └─ is_strategy_implemented → true
      ↓
参与后续讨论
  └─ 有了真实数据，可以做自我诊断
```

## 前端表现

### 诞生位置

新 NPC 从**策略茶馆** 走出。

### 视觉区分

- emerged 类别使用蓝色（`#60a5fa`）
- 名字格式：`[杂交]稳中求进`、`[变异]竞价低吸`

### 数据同步

复用 `strategies.json` 轮询机制（10 秒间隔）：
1. 后端刷新 strategies.json
2. 前端轮询检测到新 ID
3. GameStore 触发 `strategy:loaded`
4. EntitySystem 创建新 Agent 实例
