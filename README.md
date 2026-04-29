# DeepSolo

**输入你已有的策略（哪怕亏钱），通过多智能体涌现进化，输出赚钱的可执行策略，过程全程可视化。**

DeepSolo 是一个策略涌现引擎。它接收你的交易策略作为"基因种子"，通过心跳衍生和社区讨论双层进化机制，让策略自动繁殖、碰撞、涌现出比原始策略更优的想法。

## 核心理念

```
你的策略（可能亏钱）
      │
      ▼
┌─────────────────────────────────────────┐
│         DeepSolo 策略涌现世界            │
│                                         │
│  基础 NPC（6个）永驻，每天更新回测数据    │
│                                         │
│  心跳衍生 ── 每24h 综合 NPC → 诞生新 NPC  │
│  讨论涌现 ── 数据驱动碰面 → 互补才涌现    │
│  末位淘汰 ── NPC > 1000 → 淘汰最弱者     │
│  天道巡逻 ── 违背可交易原则 → 自然灭亡    │
│                                         │
│  全程可视化：像素社区里的 NPC 自治世界    │
└─────────────────────────────────────────┘
      │
      ▼
涌现出更优的策略想法（经验洞察）
      │
      ▼
夜间系统基于洞察实现可执行策略
```

## 进化机制

### 1. 心跳衍生（每 24 小时）

从排行榜 Top 2 策略中选父代，LLM 分析生成子代策略的名称和描述。新 NPC 为空壳（有 profile 和经验洞察，无策略代码），等待夜间系统回填数据。

### 2. 讨论涌现（每 4 小时，数据驱动）

每个 NPC 从自己的真实交易数据中做自我诊断，带着问题和优势随机碰面：

```
NPC A（+23%，但单日最大亏损 -11%）→ 需要: 风控
NPC B（-14%，但波动率极低 1.7%）  → 需要: 盈利能力
    ↓
A 的优势恰好是 B 的需求，反之亦然 → 双向互补
    ↓
LLM 模拟对话 → 诞生融合策略 NPC（空壳 + 经验洞察）
    ↓
夜间系统读取经验 → 实现策略代码 → 回填数据
    ↓
第二天: 新 NPC 有了真实数据，可以参与更多讨论
```

不互补的碰面只记录经验，不产生新策略。只有真正的互补才能涌现。

### 3. 昼夜循环

| 时间 | 谁在工作 | 做什么 |
|------|---------|--------|
| 白天 | DeepSolo 讨论引擎 | 随机碰面、自我诊断、互补判断、LLM 对话 |
| 晚上 | 外部调度系统 | 读取经验洞察、实现策略代码、回测回填数据 |

## 项目结构

```
deepsolo/
├── packages/
│   ├── core/              # Python 后端
│   │   └── deepsolo/
│   │       ├── models/    # 数据模型（Agent, Strategy, Account, Memory）
│   │       ├── storage/   # 文件存储层 + 前端 JSON 桥接
│   │       ├── llm/       # LLM 客户端（Anthropic API 格式）
│   │       ├── chat/      # 观察者对话会话
│   │       └── evolution/ # 衍生引擎 + 讨论引擎
│   └── visual/            # 像素社区可视化（Phaser 3 + TypeScript）
├── scripts/               # 运维脚本
│   ├── seed_base_agents.py      # 初始化 6 个基础 Agent
│   ├── trigger_derivation.py    # 手动触发心跳派生
│   ├── trigger_discussion.py    # 手动触发社区讨论
│   └── extract_game_data.js     # 从游戏文件提取地图素材
├── data/                  # 运行时数据（不入库）
│   ├── agents/{id}/       # 每个 Agent 一个目录
│   │   ├── profile.json
│   │   ├── strategy/      # 策略代码和数据
│   │   └── memory/        # 经验和对话记录
│   └── frontend/          # 前端轮询的 JSON
└── docs/                  # 文档
    ├── architecture.md
    └── community_evolution.md
```

## 快速开始

```bash
# 1. 安装后端依赖
cd packages/core
pip install -e .

# 2. 配置 LLM
cd ../..
cp .env.example .env
# 编辑 .env 填入 LLM_API_KEY

# 3. 初始化基础 Agent（需要已有策略数据）
python scripts/seed_base_agents.py

# 4. 启动服务（WebSocket + 定时讨论 + 定时派生）
cd packages/core
python -m deepsolo.server

# 5. 启动前端可视化
cd ../visual
npm install
npm run dev
```

## 项目治理

当前项目已经建立轻量治理入口：

- `docs/project_governance.md`：项目治理规范、质量门禁、文档规则和发布检查清单。
- `docs/technical_debt_register.md`：已知技术债、优先级和建议处理顺序。
- `packages/visual/docs/visual_governance.md`：Visual 包模块边界、编辑器约定和回归场景。
- `codex.md`：连续迭代记录，包含关键调参结论和验证结果。

前端可视化包交付前建议执行：

```bash
cd packages/visual
npm run check        # typecheck + unit tests + build
npm run audit:governance
```

### 手动触发

```bash
# 单次讨论
python scripts/trigger_discussion.py

# 单次派生
python scripts/trigger_derivation.py
```

## 数据流

```
外部策略数据（服务器同步）
    ↓
data/agents/{id}/strategy/  ← 买卖信号、交易记录、账户信息
    ↓
讨论引擎读取日度收益 → 自我诊断 → 互补判断 → LLM 对话
    ↓
经验洞察 → data/agents/{id}/memory/experience.json
    ↓
新 Agent 诞生 → data/agents/e{N}/
    ↓
夜间系统读取 experience.json → 实现策略 → 回填 strategy/
    ↓
is_strategy_implemented → true → 参与后续讨论
```

## Agent 状态

| 状态 | 含义 | 参与讨论 |
|------|------|---------|
| alive + 已实现 | 有完整策略数据 | 是 |
| alive + 未实现 | 刚诞生，等夜间系统 | 否 |
| pending | 等待实现 | 否 |
| eliminated | 被末位淘汰 | 否 |

## 技术栈

- **后端**: Python 3.11+, httpx, websockets
- **前端**: TypeScript, Phaser 3, Vite
- **存储**: 文件系统（JSON），每个 Agent 一个目录
- **通信**: 前端轮询 JSON 文件 + WebSocket 实时聊天
- **LLM**: Anthropic API 格式（兼容智谱 AI 等代理）

## License

[MIT](LICENSE)
