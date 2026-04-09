# DeepSolo

**输入你已有的策略（哪怕亏钱），通过多智能体涌现进化，输出赚钱的可执行策略，过程全程可视化。**

DeepSolo 是一个开源的策略涌现引擎。它接收你的交易策略作为"基因种子"，通过生态竞争和社区协作双层进化机制，让策略之间竞争、变异、杂交、碰撞，涌现出比原始策略更优的可执行策略。

## 核心理念

```
你的策略（可能亏钱）
      │
      ▼
┌─────────────────────────────┐
│   DeepSolo 策略涌现引擎      │
│                             │
│  策略竞争 → 排行榜           │
│  参数变异 → 子策略           │
│  规则杂交 → 新组合           │
│  社区讨论 → 新思路           │
│                             │
│  全程可视化 👀               │
└─────────────────────────────┘
      │
      ▼
涌现出更优的可执行策略
```

## 架构概览

```
用户策略接入 ──→ 策略仓库（SQLite）
                      │
              ┌───────┴───────┐
              ▼               ▼
       生态竞争引擎      社区协作引擎
       （量化进化）      （LLM 涌现）
              │               │
              └───────┬───────┘
                      ▼
               涌现策略层
                      │
              ┌───────┴───────┐
              ▼               ▼
        可执行策略输出    像素社区可视化
```

详细架构设计见 [docs/architecture.md](docs/architecture.md)。

## 项目结构

```
deepsolo/
├── packages/
│   ├── core/              # 策略仓库 + 记忆系统
│   │   └── deepsolo/
│   │       ├── models/    # 数据模型定义
│   │       ├── storage/   # SQLite 存储层
│   │       └── memory/    # 策略记忆系统
│   ├── evolution/         # 进化引擎
│   │   └── deepsolo_evolution/
│   │       ├── competition/  # 第一层：生态竞争
│   │       └── community/    # 第二层：社区协作
│   ├── visual/            # 像素社区可视化
│   └── connector/         # 外部策略接入适配器
├── docs/                  # 文档
├── examples/              # 示例策略
├── tests/                 # 测试
└── .github/               # CI/CD & 模板
```

## 快速开始

> 项目正在开发中，敬请期待。

```bash
# 安装
pip install deepsolo

# 初始化策略仓库
deepsolo init

# 接入你的策略
deepsolo strategy add --name "my_strategy" --file strategy.json

# 启动涌现引擎
deepsolo evolve

# 查看可视化
deepsolo visual
```

## 技术栈

- **语言**：Python 3.11+
- **存储**：SQLite（初期）→ 图数据库（后期可选）
- **LLM**：OpenAI 兼容接口（支持任意模型）
- **可视化**：像素风社区（Star-Office-UI 风格）

## License

[MIT](LICENSE)
