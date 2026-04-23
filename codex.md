# DeepSolo Codex

> 状态：当前主文档 / 单一事实源（SSOT）
>
> 生效日期：2026-04-23
>
> 约束：从本日期开始，`codex.md` 是本项目的最高优先级文档。后续架构、流程、运行方式、数据结构、开发约定发生变化时，必须优先更新本文件；其他文档默认视为补充材料，若与本文件冲突，以本文件为准。

---

## 1. 这份文档的用途

这不是 README 的重复版，而是后续持续开发的总控文档。它承担 6 个职责：

1. 记录项目当前真实状态，而不是仅记录理想设计。
2. 明确哪些代码已经存在、哪些能力只是设计、哪些部分依赖外部系统。
3. 统一后续开发约定，避免“代码是一套、文档是一套、口头约定又是一套”。
4. 维护架构真相、运行真相、数据真相、优先级真相。
5. 给未来开发提供稳定入口，让每次迭代都能从同一上下文出发。
6. 作为后续任务拆解、技术决策、重构范围界定的基线。

---

## 2. 项目一句话定义

DeepSolo 是一个“策略涌现世界”：

- 输入：用户已有的交易策略及其回测/交易数据。
- 核心机制：把策略实体化为 Agent/NPC，在一个像素社区中进行讨论、衍生、天道审查与可视化展示。
- 输出：新的衍生策略 Agent，以及可供外部“夜间系统”继续实现的经验洞察。

重点是：

- 当前仓库已经实现了“策略世界 + 讨论/衍生/审查 + 文件存储 + 可视化世界”。
- 当前仓库没有完整实现“自动把新洞察落成可执行策略代码并完成回测回填”的闭环。
- README 中提到的“夜间系统”是外部系统，不在当前仓库内。

---

## 3. 当前权威结论

以下结论基于当前代码，而不是仅基于旧文档：

### 3.1 当前已经真实存在的能力

- 文件系统存储的 Agent 仓库。
- WebSocket 观察者聊天服务。
- 定时讨论引擎。
- 定时心跳派生引擎。
- 定时天道审查引擎。
- Phaser 3 像素世界前端。
- 前端通过轮询 `JSON` 文件同步世界状态与事件。
- 前端已经具备较强的“游戏世界”扩展：室内场景、剧情、战斗、Token Center、头像/地图/战斗资源加载。

### 3.2 当前未完成或依赖外部系统的能力

- 从经验洞察自动生成完整策略代码。
- 对新衍生策略执行真实回测并自动回填 `strategy/` 数据。
- 统一 connector 接入层。
- 完整测试体系。
- 严格一致的文档体系。

### 3.3 当前代码与旧文档存在的差异

- 心跳衍生在代码中是每 `24h` 一次，见 `packages/core/deepsolo/server.py`；部分旧文档写成了 `6h`。
- 讨论调度在代码中是每 `4h` 一次，和主 README 一致。
- 天道审查在代码中是每日一次，且只对衍生 Agent 生效，基础 Agent 不受天罚。
- `README.md` 提到 `cp .env.example .env`，但仓库当前未见 `.env.example`。
- `world_status.json` 目前主要由初始化脚本写入，服务运行中没有看到稳定更新逻辑，因此 `world.json` 的时间字段不应视为完全可信的实时调度状态。
- 前端存在 fallback 数据，见 `packages/visual/src/config.ts` 和 `packages/visual/src/core/GameStore.ts`，所以即便没有完整后端数据，前端也能启动一个演示世界。

---

## 4. 仓库结构与职责划分

### 4.1 根目录

- `README.md`：项目概览，适合首次介绍，但不是后续维护主文档。
- `codex.md`：主文档，从现在开始作为最高优先级说明。
- `docs/`：历史设计文档、专题设计文档、战斗/剧情/Token/天道等专项资料。
- `data/`：运行时数据目录，是真实世界状态的本地存储。
- `scripts/`：初始化和手动触发脚本。
- `packages/`：代码主体，分 `core` 与 `visual`。

### 4.2 `packages/core`

语言：Python 3.11+

职责：

- 数据模型。
- 文件存储层。
- LLM 调用。
- 观察者与 Agent 对话。
- 讨论、衍生、天道审查三大引擎。
- WebSocket 服务和定时任务入口。

关键目录：

- `packages/core/deepsolo/models/`
- `packages/core/deepsolo/storage/`
- `packages/core/deepsolo/llm/`
- `packages/core/deepsolo/chat/`
- `packages/core/deepsolo/evolution/`
- `packages/core/deepsolo/server.py`

### 4.3 `packages/visual`

语言：TypeScript + Phaser 3 + Vite

职责：

- 像素世界渲染。
- Agent/NPC 实体展示。
- 事件可视化。
- 观察者交互。
- 对话系统。
- 游戏化扩展系统（战斗/剧情/建筑/室内场景/Token Center）。

注意：这个前端已经不只是“策略看板”，而是一个较完整的 RPG 风格世界壳。

### 4.4 `data`

这是运行态真相目录，不是示例目录。

- `data/agents/{id}/profile.json`
- `data/agents/{id}/strategy/`
- `data/agents/{id}/memory/`
- `data/frontend/strategies.json`
- `data/frontend/world.json`
- `data/frontend/events.json`
- `data/world_status.json`

### 4.5 `scripts`

当前最重要的脚本：

- `scripts/seed_base_agents.py`：初始化基础策略 Agent。
- `scripts/trigger_discussion.py`：手动触发讨论。
- `scripts/trigger_derivation.py`：手动触发心跳派生。
- `scripts/trigger_heaven.py`：手动触发天道审查。

---

## 5. 核心运行架构

系统是双链路运行：

### 5.1 链路 A：世界数据链路

后端把 Agent 数据写入本地文件：

- `data/agents/...`
- `data/frontend/strategies.json`
- `data/frontend/world.json`
- `data/frontend/events.json`

前端通过轮询这些 JSON 驱动世界变化。

这意味着：

- 前后端之间没有完整 REST API。
- 文件系统就是系统事实层。
- JSON 桥接是核心边界，而不是临时方案。

### 5.2 链路 B：聊天链路

- 前端 `ChatService` 建立 WebSocket。
- 后端 `server.py` 接收聊天请求。
- `ChatSession` 读取 Agent 上下文和历史对话。
- `LLMClient` 调用 Anthropic Messages 格式接口。

这条链路和文件轮询链路并行存在。

---

## 6. 后端真实模块说明

### 6.1 服务入口：`packages/core/deepsolo/server.py`

作用：

- 加载 `.env`
- 创建 WebSocket 服务
- 启动 3 个异步定时任务：
  - `derivation_scheduler()`
  - `discussion_scheduler()`
  - `heaven_scheduler()`

当前真实调度参数：

- 服务启动后 `60s`：首次心跳派生。
- 服务启动后 `120s`：首次讨论。
- 服务启动后 `300s`：首次天道审查。
- 之后：
  - 派生每 `86400s`（24h）
  - 讨论每 `14400s`（4h）
  - 天道审查每 `86400s`（24h）

### 6.2 LLM 客户端：`packages/core/deepsolo/llm/client.py`

特点：

- 使用 Anthropic Messages API 兼容格式。
- 默认基址是智谱代理风格地址：
  - `https://open.bigmodel.cn/api/anthropic`
- 默认模型在服务中常用的是 `glm-4.7`。

结论：

- 这里是“兼容 Anthropic 协议的统一调用层”，不是绑定某一家模型提供方。

### 6.3 上下文构建：`packages/core/deepsolo/llm/context.py`

为观察者聊天构建 Agent 的 system prompt，包含：

- 角色名、类别、策略描述。
- Persona 信息。
- 账户汇总指标。
- 最近 5 条经验。
- 最近 3 次与其他策略的讨论摘要。
- 对回答风格的要求。

这决定了观察者聊天当前是“角色扮演 + 数据引用”的体验，而不是通用量化问答。

### 6.4 聊天会话：`packages/core/deepsolo/chat/session.py`

职责：

- 读取 Agent 历史聊天。
- 构建消息列表。
- 调用 LLM。
- 将观察者对话落盘到：
  - `data/agents/{id}/memory/conversations/with_observer.json`

### 6.5 数据模型：`packages/core/deepsolo/models/`

当前主要模型：

- `agent.py`
  - `AgentProfile`
  - `Persona`
- `strategy.py`
  - 前端消费格式对应模型
- `account.py`
  - 账户配置与汇总
- `memory.py`
  - `Experience`
  - `Conversation`
  - `DialogueTurn`
- `world.py`
  - `WorldStatus`

注意：

- `AccountData` 的 Python dataclass 只显式建模了 `config` 和 `summary`，但运行数据中实际还依赖 `账户信息.json` 里的 `daily` 字段。
- 这意味着模型层和真实 JSON 结构并未完全对齐，属于后续需要收敛的地方。

### 6.6 文件存储层：`packages/core/deepsolo/storage/file_store.py`

这是当前系统最关键的基础设施之一。

能力：

- 初始化 `data/`
- 创建 Agent 目录
- 读写 `profile / account / trades / signals / selection / scripts / experiences / conversations`
- 判断策略是否已实现：`is_strategy_implemented()`
- 列出全部 Agent / 存活 Agent
- 读写世界状态

当前“策略已实现”的判定标准：

- `交易记录.json` 存在且非空
- `账户信息.json` 存在
- `账户信息.json` 中有 `daily`

这个判定逻辑非常重要，因为讨论引擎和天道审查都依赖它。

### 6.7 前端桥接层：`packages/core/deepsolo/storage/json_bridge.py`

职责：

- 生成 `strategies.json`
- 生成 `world.json`
- 维护 `events.json`
- 同步到 `packages/visual/public/data/`

当前事件类型：

- `discussion`
- `agent_born`
- `heaven_eliminate`

注意：

- 这里只保留最近 50 条事件。
- 这是前端“出生、消灭、讨论动画”的主要驱动源。

---

## 7. 讨论引擎真实逻辑

代码：`packages/core/deepsolo/evolution/discuss.py`

### 7.1 讨论引擎目标

不是让 Agent 随便聊天，而是：

1. 基于真实交易数据做自我诊断。
2. 判断参与者是否双向互补。
3. 只有互补时，才允许 LLM 导向新策略涌现。

### 7.2 参与者筛选

- 先取所有 `alive` Agent。
- 再过滤出 `is_strategy_implemented == true` 的 Agent。
- 只有“已实现”的 Agent 才能参与讨论。
- 每次随机选 `2-3` 个参与者。

### 7.3 自我诊断维度

讨论前会读取：

- `账户信息.json` 中的 `daily`
- `交易记录.json`

形成：

- `strengths`
- `weaknesses`
- `needs`
- `data_evidence`

当前诊断重点包括：

- 累计收益
- 日均收益
- 单日最大盈利/亏损
- 盈利日占比
- 日波动率
- 连亏天数
- 回撤期
- 大额亏损交易

### 7.4 互补判定

当前是“规则 + 指标差异”的轻量判定：

- 关键词匹配：
  - `波动 -> 稳定`
  - `亏损 -> 盈利`
  - `止损 -> 胜率`
  - `连亏 -> 爆发力`
  - `回撤 -> 收益`
  - `风控 -> 稳定`
- 指标差异匹配：
  - 收益差异
  - 波动率差异

只有双向都成立，才判定为互补。

### 7.5 LLM 输出要求

讨论 Prompt 会显式告诉模型：

- 每个参与者从自己的立场讲话。
- 需要引用具体收益、回撤、胜率等数字。
- 若不互补，不允许硬凑新策略。
- 若互补，可以自然走向合作思路。

期望输出是 JSON，包含：

- `dialogues`
- `emerged`
- `new_idea`
- `experiences`

### 7.6 讨论完成后的落盘

每个参与者都会写入：

- `memory/conversations/disc_*.json`
- `memory/experience.json`

如果产生新 Agent，则额外：

- 创建新 Agent 目录
- 写入 `profile.json`
- 给新 Agent 注入“继承自父代的优势 + 诞生洞察”
- 追加前端 `agent_born` 事件

### 7.7 当前真实约束

- 讨论引擎可以产生“新 Agent 壳”，但不能自动补全其策略代码和数据。
- 因此大量新 Agent 会处于“alive 但未实质化”的状态。
- 这正是天道审查里“空壳超时消灭”的背景。

---

## 8. 心跳派生真实逻辑

代码：`packages/core/deepsolo/evolution/derive.py`

### 8.1 当前实现方式

当前派生逻辑比架构文档里写得更简单，实际是：

1. 列出所有存活 Agent。
2. 读取账户汇总表现。
3. 按收益率排序。
4. 取 Top 2 作为父代。
5. 取最大回撤控制最好的一个作为参考。
6. 让 LLM 产出一个新策略名字、描述、关系类型。
7. 创建新的衍生 Agent profile。

### 8.2 当前未做的事情

以下内容属于旧文档或理想设计，但当前代码未完整实现：

- 按 Agent 总数动态切换衍生策略。
- 多维综合评分筛选父代。
- 人口超过阈值的末位淘汰。
- LLM 资源分层分配。

因此当前心跳派生应被视为：

“基于 Top 表现者的简化版策略孵化器”。

---

## 9. 天道审查真实逻辑

代码：`packages/core/deepsolo/evolution/heaven.py`

### 9.1 审查对象

- 仅 `derived` Agent。
- 仅 `status == alive`。
- 分两类：
  - 未实现壳体：空壳超时判罚。
  - 已实现策略：LLM 审查未来函数与逻辑一致性。

基础 Agent 不受天罚。

### 9.2 空壳超时

当前阈值：

- `SHELL_TIMEOUT_DAYS = 3`

即：

- 衍生 Agent 出生后超过 3 天仍未被夜间系统实质化，就会被消灭。

### 9.3 LLM 审查材料

对已实现衍生策略，会收集：

- 策略代码采样：
  - `生成买卖信号.py`
  - `生成回测明细.py`
  - `生成盘前选股.py`
- 最近交易记录样本
- 账户汇总
- 最近日度数据样本

### 9.4 LLM 审查维度

- 未来函数
- 卖出价格异常
- 持仓天数与描述不符
- 仓位限制与实际不符
- 收益数据不一致
- 异常收益

### 9.5 审查结果落盘

如果判定有罪：

- `profile.status = heaven_removed`
- 写入 `memory/heaven_judgement.json`
- 追加一条失败经验
- 追加 `heaven_eliminate` 事件

### 9.6 现阶段意义

天道系统本质上是当前闭环里唯一的“健康性治理机制”。

它的两个作用分别是：

- 防止世界被永远不会落地的空想 Agent 污染。
- 防止夜间系统回填出明显作弊或逻辑不自洽的策略。

---

## 10. 前端真实架构

### 10.1 入口

- `packages/visual/src/main.ts`

启动顺序：

1. 创建 `EventBus`
2. 创建 `GameStore`
3. 创建 `ChatService`
4. 创建 `UIManager`
5. 注入上下文给 `WorldScene`
6. 启动 Phaser

### 10.2 主状态容器：`packages/visual/src/core/GameStore.ts`

职责：

- 持有 `strategies`
- 持有事件日志
- 轮询后端 JSON
- 检测 Agent 新增/移除
- 发射前端事件

关键事实：

- 前端启动时先加载 `INITIAL_STRATEGIES` 作为 fallback。
- 随后尝试从 `./data/strategies.json` 拉取真实数据。
- 若成功，则开始轮询。

### 10.3 世界场景：`packages/visual/src/scenes/WorldScene.ts`

这是前端协调中心，整合：

- 地图渲染
- 玩家输入
- Agent 实体系统
- 小地图
- 昼夜系统
- 讨论系统
- 场景切换
- 对话系统
- 特效系统
- 战斗系统
- 剧情系统
- 建筑标记
- 聊天消息接入

这意味着：

- 目前 `WorldScene` 较重，是后续重点解耦对象之一。

### 10.4 启动场景：`packages/visual/src/scenes/BootScene.ts`

职责：

- 加载地图资源
- 加载角色图集
- 加载室内地图
- 加载头像资源
- 加载战斗资源
- 加载剧情相关资源

结论：

- 当前前端资源体量大，首屏不是轻量仪表盘，而是完整游戏入口。

### 10.5 聊天前端：`packages/visual/src/services/ChatService.ts`

特点：

- WebSocket 连接
- 自动重连
- 支持发送聊天与拉历史
- 前端以消息回调方式消费响应

### 10.6 前端事件来源

有两套：

1. 本地交互事件：由 `EventBus` 在场景内部流转。
2. 后端世界事件：由 `events.json` 轮询得到后再发射。

---

## 11. 当前数据模型真相

### 11.1 Agent

关键字段来自 `profile.json`：

- `id`
- `type`
- `name`
- `category`
- `description`
- `persona`
- `parents`
- `relation`
- `status`
- `born_at`
- `eliminated_at`
- `llm_tier`

### 11.2 Agent 状态

当前系统涉及的状态语义：

- `alive`
- `pending`
- `eliminated`
- `heaven_removed`

但实际主流程里最关键的是：

- `alive + implemented`
- `alive + unimplemented`
- `heaven_removed`

### 11.3 Strategy 展示数据

前端主要消费字段：

- `returnPct`
- `maxDrawdownPct`
- `totalTrades`
- `winRate`
- `avgReturnPct`
- `capital`
- `parents`
- `relation`
- `state`

### 11.4 账户数据

当前仓库实际依赖两层结构：

- `config`
- `summary`

且运行逻辑还依赖：

- `daily[]`

这属于“JSON 结构 > Python 显式模型”的现状。

### 11.5 记忆数据

主要分两类：

- `experience.json`
- `memory/conversations/*.json`

其中：

- 与观察者聊天：`with_observer.json`
- 多 Agent 讨论：`disc_*.json`

### 11.6 Battle 扩展数据

`data/agents/{id}/battle.json` 在当前数据目录中已经存在，且视觉文档对战斗属性系统有说明，但核心后端主模型未统一纳入它。

结论：

- `battle.json` 已经是事实数据的一部分，但尚未成为后端统一域模型的一部分。

---

## 12. 当前系统的核心闭环

真实闭环如下：

1. 基础 Agent 已存在，且带有历史策略数据。
2. 讨论引擎从已实现 Agent 中随机抽人讨论。
3. 若互补，则诞生新衍生 Agent。
4. 新衍生 Agent 暂时只有 profile 与经验。
5. 外部夜间系统应读取这些洞察并回填策略实现。
6. 若若干天后仍未回填，天道将其清除。
7. 前端通过 JSON 轮询看到世界新增、讨论、消灭事件。

也就是说，当前项目核心不是“自动赚钱策略生成器”，而是：

“为策略进化提供一套世界化、角色化、事件化、可视化的中间层系统”。

---

## 13. 当前明显短板

### 13.1 缺少测试

`tests/` 目录目前几乎为空，只看到 `tests/__init__.py`。

结论：

- 当前系统可运行，但不具备可靠回归保护。
- 后续任何较大改动都应该优先补测试，而不是继续裸奔扩展。

### 13.2 文档漂移

当前多个文档价值很高，但已经出现：

- 时间周期不一致
- 设计与实现粒度不一致
- 代码已有扩展但主架构文档未完全吸收

### 13.3 世界状态更新不完整

`world_status.json` 的写入在现有代码里主要出现在初始化脚本中，运行期调度没有形成完整更新闭环。

### 13.4 领域模型不统一

例如：

- `battle.json` 已落地但不在主模型体系中。
- `daily` 在账户数据里被强依赖，但未显式建模。

### 13.5 世界模拟与产品主线并存但尚未完全收束

项目已经同时拥有：

- 策略涌现主线
- 剧情系统
- 战斗系统
- 室内地图系统
- Token Center

这些方向都合理，但需要统一成一条产品叙事，否则后续容易失焦。

---

## 14. 从现在开始的文档治理规则

这是本项目后续开发必须遵守的规则。

### 14.1 优先级

文档优先级固定如下：

1. `codex.md`
2. 代码实现
3. 专题文档（`docs/`、`packages/visual/docs/`）
4. `README.md`

解释：

- 如果代码和 `codex.md` 冲突，先检查是否代码已变而 `codex.md` 未更新。
- 如果专题文档和 `codex.md` 冲突，以 `codex.md` 为准，并在后续逐步回收旧文档。

### 14.2 修改规则

以后每次开发，如果影响以下任一项，必须同步更新 `codex.md`：

- 架构边界
- 运行命令
- 数据结构
- 调度周期
- 模块职责
- 状态机
- 前后端通信方式
- 项目优先级
- 路线图

### 14.3 旧文档处理规则

旧文档不要求一次性全删，但要逐步分为三类：

- 保留：仍有高参考价值，且与当前系统兼容。
- 降级：设计价值存在，但已不是当前实现真相。
- 废弃：已经误导开发，不再作为参考。

### 14.4 每次开发的最小文档动作

每次迭代至少做 1 件事：

- 更新 `codex.md` 的相关章节；或
- 在 `codex.md` 的“变更记录”中登记本次变化；或
- 在 `codex.md` 标记新的已知差异和后续计划。

---

## 15. 从现在开始的开发原则

### 15.1 先收敛主线，再继续横向扩展

当前主线应定义为：

“策略 Agent 的生成、讨论、回填、审查、展示闭环”。

因此后续开发优先级应是：

1. 稳定核心闭环。
2. 明确数据契约。
3. 补测试。
4. 再强化世界玩法。

### 15.2 文件系统优先保持稳定

当前整个系统高度依赖文件系统目录约定，所以任何改数据结构的动作都必须：

- 先写迁移策略。
- 再更新桥接逻辑。
- 最后更新前端读取逻辑。

### 15.3 避免进一步扩大隐式契约

当前系统已经存在一些“代码默认某 JSON 字段一定存在，但模型没声明”的情况。

后续新增能力时，尽量遵循：

- 先定义数据结构。
- 再写读写层。
- 再写业务逻辑。

### 15.4 不要把世界玩法和策略主线耦死

剧情、战斗、Token Center 都可以保留，但它们应该服务主线，而不是成为独立产品后把主线稀释掉。

建议把这些系统统一归类为：

- `世界表达层`
- `世界交互层`
- `策略核心层`

---

## 16. 建议的近期开发路线图

这是当前推荐路线，不是冻结路线；后续可调整，但应先从这里出发。

### Phase 1：把核心闭环做实

目标：让 DeepSolo 真正具备“生—长—审—显”的最小可靠循环。

优先事项：

1. 明确并统一 Agent 数据契约。
2. 显式建模 `daily` 数据。
3. 显式建模 `battle.json` 是否属于核心域。
4. 让 `world_status.json` 在运行期真实更新。
5. 为讨论/派生/天道补基础测试。
6. 为前端轮询数据补示例与容错。

### Phase 2：打通夜间系统边界

目标：明确本仓库与外部策略实现系统之间的协议。

优先事项：

1. 定义“衍生 Agent 待实现协议”。
2. 定义外部回填输入输出。
3. 增加 connector 设计落地。
4. 明确回填失败、部分回填、重复回填的处理逻辑。

### Phase 3：收束世界玩法

目标：让剧情/战斗/Token 体系为“策略世界”服务。

优先事项：

1. 明确这些玩法和 Agent 生命周期的关系。
2. 决定哪些玩法进入 MVP 主线，哪些留作扩展。
3. 拆解 `WorldScene`。

---

## 17. 我对旧文档的当前判定

以下是当前阶段的使用建议。

### 17.1 仍然有价值，继续参考

- `docs/community_evolution.md`
- `docs/heaven_judgement.md`
- `docs/token_center_design.md`
- `docs/unified_conversation_panel.md`
- `packages/visual/docs/story_system.md`
- `packages/visual/docs/battle_system.md`
- `packages/visual/docs/agent_profile_system.md`

### 17.2 有价值，但必须以代码和本文件校正

- `docs/architecture.md`
- `README.md`
- `docs/衍生NPC流程.md`

### 17.3 更像专题研究资料

- `docs/jyqxz_battle_system_analysis.md`
- `packages/visual/docs/jyqxz_story_system.md`
- `packages/visual/docs/character-walking.md`
- `packages/visual/docs/indoor_birth_house.md`

它们对世界表现层很重要，但不是当前核心运行真相的首选入口。

---

## 18. 当前运行方式

### 18.1 后端安装

```bash
cd packages/core
pip install -e .
```

### 18.2 配置环境变量

当前项目通过根目录 `.env` 读取：

- `LLM_API_KEY`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `WS_HOST`
- `WS_PORT`

注意：

- 仓库当前未看到 `.env.example`，后续应补上。

### 18.3 初始化基础 Agent

```bash
cd /Users/sunguanlong/Desktop/AIGC/deepsolo
python scripts/seed_base_agents.py
```

### 18.4 启动后端服务

```bash
cd /Users/sunguanlong/Desktop/AIGC/deepsolo/packages/core
python -m deepsolo.server
```

### 18.5 启动前端

```bash
cd /Users/sunguanlong/Desktop/AIGC/deepsolo/packages/visual
npm install
npm run dev
```

### 18.6 手动触发

```bash
cd /Users/sunguanlong/Desktop/AIGC/deepsolo
python scripts/trigger_discussion.py
python scripts/trigger_derivation.py
python scripts/trigger_heaven.py
```

---

## 19. 当前开发时必须记住的事实

1. 这个项目已经是“策略世界模拟器”，不是普通量化项目。
2. 文件系统是主数据库。
3. JSON 桥接不是临时方案，而是当前正式通信协议的一部分。
4. 讨论引擎只允许已实现策略参与。
5. 衍生 Agent 可以诞生为空壳。
6. 天道系统会清理空壳和违规衍生策略。
7. 前端世界强游戏化，不能用“普通 dashboard”思路随便改。
8. 当前测试缺口很大，后续开发要优先补。
9. `WorldScene` 很重，是后续重构热点。
10. 从现在开始，以 `codex.md` 为后续开发入口。

---

## 20. 下一阶段建议的首批开发任务

这是推荐顺序。

### Task A：建立数据契约层

目标：

- 统一 `profile / account / daily / memory / events / battle` 的 schema。

收益：

- 降低前后端漂移。
- 给后续 connector 和测试打基础。

### Task B：补核心引擎测试

优先覆盖：

- `discuss.py`
- `derive.py`
- `heaven.py`
- `json_bridge.py`

### Task C：让世界状态真实更新

目标：

- 在调度运行时维护 `world_status.json`，而不是只靠 seed 初始化。

### Task D：明确夜间系统协议

目标：

- 把“外部夜间系统”从口头概念变成正式边界协议。

### Task E：梳理前端主线和玩法边线

目标：

- 区分哪些系统服务 MVP，哪些系统作为后续增强。

---

## 21. 变更记录

### 2026-04-23

- 新建 `codex.md` 作为项目主文档。
- 基于当前代码完成一轮“实现真相”梳理。
- 明确从现在起文档优先级为：`codex.md` > 代码校验后的专题文档 > README。
- 识别当前关键差异：
  - 心跳派生周期文档与代码不一致。
  - `.env.example` 缺失。
  - `world_status.json` 运行期更新不足。
  - 领域模型与真实 JSON 存在漂移。
  - 测试体系几乎为空。

---

## 22. 后续维护约定

以后如果我继续介入开发，我会默认遵守以下流程：

1. 先读 `codex.md`。
2. 确认本次任务影响的模块边界。
3. 开发前如发现本文件失真，先更新本文件再动代码，或至少同步更新。
4. 开发完成后，把新的真实状态补回本文件。

这意味着：

- `codex.md` 不只是介绍文档。
- 它是后续迭代的操作基线。

