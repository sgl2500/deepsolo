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

补充（2026-04-24）：

- 出生室内场景 `birth_house` 正在从旧 JYQXZ 室内瓦片拼接，切换为“自有可复用美术包 + 固定布局渲染”模式。
- 当前观察者小屋的主资源目录已经迁移到 `packages/visual/public/assets/rooms/observer_house/`。
- 其中：
  - `runtime/`：前端直接加载的成品贴图。
  - `raw/`：原始生成结果。
  - `cutouts/`：抠图结果。
  - `preview/`：布局预览图。
  - `metadata/`：提示词与生成元数据。
- `observer_house_v2/` 仅作为上一轮尝试保留，不再作为当前运行时主资源来源。
- `birth_house` 的玩法逻辑仍沿用现有室内地图坐标、移动和交互机制；只替换视觉层，不替换底层地图/碰撞数据。
- 2026-04-25 新增独立场景编辑模块：`packages/visual/public/场景编辑模块/`。
  - 目标是把室内场景生产从“整图试错”收束为“贴图包 + 分层场景 JSON”的流程。
  - 当前不直接改 Phaser 运行时，只提供静态编辑器入口 `index.html`、起步贴图包 `tilepacks/starter/`、示例场景 `projects/observer_house_seed.scene.json`。
  - 当前标准分层为：`floor`、`wall_back`、`decor`、`front_occluder`、`collision`。
  - 后续观察者小屋、茶馆、客栈、书房都应优先产出场景 JSON 和贴图包，再接入运行时 loader。
  - 新增 `scripts/scene_editor/process_tilepack_assets.py`，用于把页面生图的纯绿背景 raw 图处理成透明 PNG，并自动生成贴图包 `manifest.json`。
- 同日新增第二代分层方案：
  - `packages/visual/public/assets/rooms/observer_house/` 作为观察者小屋的三层资产目录。
  - 当前分层为：
    - `floor_base`：地面层
    - `back_shell`：后墙 / 侧墙 / 柱梁母版
    - `front_occluder`：前景遮挡墙层
  - `scripts/process_observer_house_layers.py` 用于抠纯绿背景、从高分母图切出分层贴图、生成运行时资源和预览。
  - 2026-04-24 已开始从“三层整图”过渡到“模块化地板 tile 拼装”：
    - 运行时新增 `floor_tile_0.png` ~ `floor_tile_3.png`
    - 生成脚本：`scripts/generate_observer_house_floor_tiles.py`
    - 预览图：
      - `../assets-library/deepsolo/observer_house/v3/preview/floor_tile_sheet.png`
      - `../assets-library/deepsolo/observer_house/v3/preview/floor_room_preview.png`
    - `birth_house` 当前地面不再依赖放大后的整张 `floor_base`，而是在固定室内坐标系中按 tile 逐格拼装。
  - 同日，地板风格路线进一步收敛到用户选定的 `A5`：
    - 原始选型图：`../assets-library/deepsolo/observer_house/v3/raw/floor_ai_pure_a_v2/surface_01/image_01.png`
    - 基于 A5 参考图再次生成的 tile 候选：`../assets-library/deepsolo/observer_house/v3/raw/floor_a5_tiles_ai/`
    - 实践结论：A5 单图自身带较强中心拼花结构，直接缩放或简单抽样都会导致重复感过强，不适合作为最终整屋地板母版。
  - 当前地板主路线已切换为 `A 温暖客栈` 的下半区开放地板带：
    - 母版来源：`../assets-library/deepsolo/observer_house/v3/raw/floor_ai_options/warm_inn/image_01.png`
    - 当前处理脚本：
      - 通用构建器：`scripts/build_floor_tileset_from_scene.py`
      - 当前 warm_inn 包装脚本：`scripts/process_warm_inn_floor_tiles.py`
      - 当前 warm_inn profile：`scripts/floor_profiles/warm_inn_observer_house.json`
    - 处理方式：
      - 先从 warm_inn 场景图中截取无遮挡地板带
      - 再把该区域矫正为方形木纹纹理
      - 最后通过正确的 square-to-isometric 投影生成运行时地板 tile，并降低对比、软化缝线
    - 复用方式：
      - 复制一份 `scripts/floor_profiles/warm_inn_observer_house.json`
      - 替换 `source_path`、`floor_quad` 和 `tiles` 采样参数
      - 运行 `python3 scripts/build_floor_tileset_from_scene.py --profile <profile-path>`
    - 当前 warm_inn 地板运行时预览：
      - `../assets-library/deepsolo/observer_house/v3/preview/floor_warm_inn_rectified_texture.png`
      - `../assets-library/deepsolo/observer_house/v3/preview/floor_warm_inn_runtime_tile_sheet.png`
      - `../assets-library/deepsolo/observer_house/v3/preview/floor_warm_inn_room_preview.png`
    - 当前 warm_inn 地板输出清单：`../assets-library/deepsolo/observer_house/v3/metadata/floor_warm_inn_runtime_manifest.json`
  - 同日，墙壁层开始从单张 `back_shell` 过渡到“半模块化后墙”：
    - 当前仍保留 `back_shell.png` 作为母版与参考，不再直接作为 `birth_house` 的唯一后墙运行时资源。
    - 新增后墙模块构建器：`scripts/build_wall_modules_from_shell.py`
    - 当前墙体 profile：`scripts/wall_profiles/observer_house_back_shell.json`
    - 运行时输出目录：`packages/visual/public/assets/rooms/observer_house/walls/`
    - 第一版模块拆分为：
      - `wall_left.png`
      - `wall_center.png`
      - `wall_right.png`
    - 对应清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_back_shell_modules.json`
    - 对应预览：
      - `../assets-library/deepsolo/observer_house/v3/preview/wall_back_shell_recompose.png`
      - `../assets-library/deepsolo/observer_house/v3/preview/wall_back_shell_sheet.png`
    - 当前接入策略：
      - `birth_house` 使用固定基准坐标 `BIRTH_HOUSE_BACK_WALL_BASE`
      - 再按模块在母版中的 `sourceRect` 复原三段后墙位置
      - 这样先替换掉整张 `birth_house_back_shell` 的运行时依赖，同时保留后续继续拆成窗格、立柱、横梁的空间
    - 当前约束：
      - 这一版是“半模块化”，本质上仍由同一张母版切片而来
      - `front_occluder` 仍保持单独前景遮挡层，下一轮再继续拆
  - 同日，开始尝试“直接 AI 生成更细的后墙模块”：
    - 第一批提示词清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_ai_modular_v2_prompts.json`
    - 第一批原始输出：`../assets-library/deepsolo/observer_house/v3/raw/wall_ai_modular_v2/`
    - 第一批总览：`../assets-library/deepsolo/observer_house/v3/preview/wall_ai_modular_v2_raw_sheet.png`
    - 结论：
      - 模块拆分方向是对的
      - 但 AI 仍会频繁带出地面、接触阴影或不该出现的结构，不能直接整套进入运行时
  - 同日，追加第二批更严格的 cutout 提示词：
    - 提示词清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_ai_modular_v3_prompts.json`
    - 原始输出：`../assets-library/deepsolo/observer_house/v3/raw/wall_ai_modular_v3/`
    - 总览：`../assets-library/deepsolo/observer_house/v3/preview/wall_ai_modular_v3_raw_sheet.png`
    - 结论：
      - `wall_left_window` 的 v3 版本更适合作为“后墙中心转角核心”
      - 其余模块需和 v2 混用，不能机械地整批替换
  - 当前实际可用路线已切换为“AI 多轮出图 + 人工筛选 + 去绿底 + 紧裁剪”：
    - 当前精选运行时模块目录：`packages/visual/public/assets/rooms/observer_house/walls_modular_v1/`
    - 当前紧裁剪版本：`packages/visual/public/assets/rooms/observer_house/walls_modular_v1_tight/`
    - 当前精选清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_modular_curated_v1.json`
    - 当前紧裁剪清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_modular_curated_v1_tight.json`
    - 当前精选总览：`../assets-library/deepsolo/observer_house/v3/preview/wall_modular_curated_v1_sheet.png`
    - 当前紧裁剪总览：`../assets-library/deepsolo/observer_house/v3/preview/wall_modular_curated_v1_tight_sheet.png`
    - 当前可用模块为：
      - `wall_corner_core`
      - `wall_left_window`
      - `wall_left_plain`
      - `wall_right_window`
      - `wall_right_plain`
      - `pillar_post`
    - 当前临时拼接预览：`../assets-library/deepsolo/observer_house/v3/preview/wall_modular_curated_v1_assembly.png`
    - 当前完整房间静态预览：`../assets-library/deepsolo/observer_house/v3/preview/birth_house_modular_wall_full_preview.png`
    - 当前判断：
      - 这一套已经比“单张 back_shell 三切片”更细
      - 也已经足够支撑下一步把后墙做成真正的模块拼装
      - 但 AI 直接产出仍不稳定，后续应继续强化“筛选与清洗”这一步，而不是只靠一次出图
  - 2026-04-24 当前运行时接入状态：
    - `birth_house` 已不再使用 `runtime/walls/wall_left.png + wall_center.png + wall_right.png` 作为主后墙方案
    - 中间曾尝试加载 `runtime/walls_modular_v1_tight/` 下的 6 个精选模块，但实际效果不对，已放弃作为主方案
    - 接入文件：
      - `packages/visual/src/scenes/BootScene.ts`
      - `packages/visual/src/systems/MapRenderer.ts`
    - 当前布置策略：
      - 当前改为从原始 coherent `back_shell.png` 再细切 7 段模块，并按原母版坐标精确复原
      - 当前细切 profile：`scripts/wall_profiles/observer_house_back_shell_fine.json`
      - 当前运行时目录：`packages/visual/public/assets/rooms/observer_house/walls_fine/`
      - 当前清单：`../assets-library/deepsolo/observer_house/v3/metadata/wall_back_shell_fine_modules.json`
      - 当前预览：
        - `../assets-library/deepsolo/observer_house/v3/preview/wall_back_shell_fine_sheet.png`
        - `../assets-library/deepsolo/observer_house/v3/preview/wall_back_shell_fine_recompose.png`
        - `../assets-library/deepsolo/observer_house/v3/preview/birth_house_fine_wall_full_preview.png`
      - 暂时仍保留现有家具坐标与 `front_occluder`
  - 同日，尝试过“统一后墙 AI 母版 v4”但失败：
    - 提示词：`../assets-library/deepsolo/observer_house/v3/metadata/wall_back_master_v4_prompt.json`
    - 原始输出：`../assets-library/deepsolo/observer_house/v3/raw/wall_back_master_v4/image_01.png`
    - 结论：
      - 模型仍会自动带出家具、地面和完整室内陈设
      - 不适合作为当前阶段的可控后墙生产方式

#### 2026-04-27 观察者小屋（birth_house）当前完成状态

观察者小屋已经从单纯室内展示推进到“可调试、可交互、可保存”的小场景 MVP。当前以 `packages/visual/src/content/IndoorFurnitureLayout.ts`、`packages/visual/src/content/IndoorInteractables.ts` 和 `packages/visual/src/systems/MapRenderer.ts` 为主要运行时入口。

已完成能力：

- 固定进入 `birth_house` 小屋，正常玩家模式不暴露调试坐标、碰撞框、mask 点等后台数据。
- `F2` 开启/关闭室内编辑模式。
- 编辑模式内显示中文操作说明面板：
  - 左下角显示操作说明。
  - 点击说明面板或按 `H` 可收起/展开。
  - 左上角只显示当前选中家具与交互对象的实时参数。
- 家具编辑器支持：
  - 黄色圆环：家具锚点 `localX/localY`。
  - 紫色实心点：家具遮挡排序点 `depthLocalX/depthLocalY`。
  - 红色框：家具碰撞框 `collider`。
  - 橙色多边形：家具局部前景遮挡 `occluderMask`。
  - 青色框/点：室内可交互区域，例如床休息区域、书架翻看区域。
- 遮挡 mask 已经是所见即所得：
  - 同一家具会渲染底层整图。
  - `occluderMask` 区域会生成一层前景裁剪贴图，盖在玩家上方。
  - 编辑橙色点时遮挡效果实时变化。
- 编辑操作：
  - 普通拖动黄色圆环移动家具锚点。
  - 按住 `Shift` 拖动重合点时优先移动紫色 depth 点。
  - `M` 开关 mask 模式。
  - 点击家具图片新增橙色 mask 点。
  - 拖动橙色点修改 mask。
  - `Alt` + 点击橙色点或右键橙色点删除指定点。
  - `Backspace` / `Delete` 删除当前选中 mask 点；没有选中点时删除最后一个点。
  - `C` 清空当前家具 mask。
  - 拖青色中心点移动交互区域。
  - 拖青色四角调整交互触发范围。
  - `R` 清空本地保存并恢复代码默认参数。
- 自动保存：
  - 家具布局、碰撞、depth、mask 保存到 `localStorage`：
    - `deepsolo_furniture_editor_layouts:birth_house`
  - 室内可交互区域保存到 `localStorage`：
    - `deepsolo_interactable_editor_layouts:birth_house`
  - 玩家生命/内力/物品/秘籍/flag 保存到 `localStorage`：
    - `deepsolo_player_progress`

当前观察者小屋交互：

- 书架：
  - 靠近书架区域按空格，第一次发现秘籍《吐纳入门》。
  - 写入 `GameStore.playerProgress.manuals` 和 `inventory`。
  - 设置一次性 flag：`birth_house_bookshelf_manual_found`。
  - 再次按空格时显示已经翻过的重复提示，不重复获得。
- 床：
  - 只有站在床正面的青色交互区域内，按空格才触发休息。
  - 休息会把玩家生命和内力恢复到上限。
  - 玩家头顶显示反馈气泡，屏幕有轻微 flash。
- 靠近可交互对象时，屏幕底部显示 `空格：...` 操作提示。
- 顶部状态栏已经显示玩家 `生命 hp/maxHp` 和 `内力 mp/maxMp`。

重要文件：

- 家具定义：`packages/visual/src/content/IndoorFurnitureLayout.ts`
- 可交互定义：`packages/visual/src/content/IndoorInteractables.ts`
- 家具碰撞：`packages/visual/src/content/IndoorFurnitureCollision.ts`
- 额外对话脚本：`packages/visual/src/content/ExtraDialogueScripts.ts`
- 编辑器、室内渲染、mask 裁剪：`packages/visual/src/systems/MapRenderer.ts`
- 空格交互执行入口：`packages/visual/src/scenes/WorldScene.ts`
- 玩家进度与持久化：`packages/visual/src/core/GameStore.ts`
- 顶部生命/内力显示：`packages/visual/src/ui/HeaderBar.ts`
- 详细调参文档：
  - `packages/visual/docs/observer_house_furniture_tuning.md`
  - `packages/visual/docs/embedded_furniture_editor_mvp.md`
  - `packages/visual/docs/indoor_birth_house.md`

当前设计结论：

- 观察者小屋的小场景闭环已经完成：家具摆放、碰撞、遮挡、局部 mask、交互区域、床休息、书架秘籍和状态持久化都可运行。
- 当前编辑器仍是“浏览器本地保存”模型，不会自动写回源码文件；确认稳定参数后再整理回配置或迁移到 JSON 数据源。
- 后续复用到新室内场景时，应优先复用这套模式：家具配置 + 可交互配置 + 编辑模式可视化调参 + localStorage 暂存。

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

### 15.1 先把世界做真，再把策略赋魂

从 2026-04-23 当前轮次开始，第一优先级调整为：

“先围绕 `JYQXZ` 参考，把 DeepSolo 前端世界做成一个可信、可探索、可交互的古代武侠场景；策略数据赋能延后接入。”

因此近期开发优先级调整为：

1. 先打磨现有地图与室内场景，让它们像真实游戏场景。
2. 先统一走动、交互、对话、切战斗、进出室内这套前端框架。
3. 先用 `观察者小屋` 打通室内场景生产模板。
4. 之后再回到策略 Agent 的生成、讨论、回填与赋能。

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

这是当前推荐路线，不是冻结路线；后续可调整，但当前应先从“游戏场景成立”出发。

### Phase 1：观察者小屋样板间

目标：以 `birth_house` 为样板，打通一套可复用的室内场景生产流程。

优先事项：

1. 参考 `JYQXZ` 场景骨架，增强小屋布局与陈设。
2. 打通室内可交互物件流程，例如床、书架、案台、门边木牌。
3. 统一室内走动、遮挡、碰撞、交互范围。
4. 沉淀后续茶馆、客栈、书房可复用的制作规范。

### Phase 2：现有世界地图增密

目标：不推翻现有世界地图结构，只在现有骨架上补建筑感、道路感、NPC 存在感和野外气息。

优先事项：

1. 强化已有建筑入口与门前空间。
2. 在空旷区域补游离 NPC、野怪与环境细节。
3. 统一“靠近 + 空格 = 先对话，再分支”的交互入口。
4. 逐步淘汰“只是一个点”的建筑表达。

### Phase 3：前端游戏框架收束

目标：让探索、对话、战斗、进出场景成为一套稳定前端框架。

优先事项：

1. 统一室内/室外交互状态机。
2. 将战斗从快捷键触发逐步迁移到对话/事件分支。
3. 拆解 `WorldScene`，降低场景协调器复杂度。
4. 为后续秘籍、领悟、挑战 NPC、掉落系统预留挂点。

### Phase 4：策略赋能回接

目标：在世界已经成立之后，再把策略数据、策略人格和策略演化能力接回 NPC 与玩法。

优先事项：

1. 给策略 NPC 赋予真实策略身份和动态表现。
2. 把秘籍、领悟、洞察与策略知识体系关联起来。
3. 再推进讨论、衍生、夜间回填与天道系统的深度接入。

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
- 同日调整第一优先级：
  - 先参考 `JYQXZ` 打磨古代武侠世界前端。
  - 先把 `观察者小屋` 做成室内场景样板间。
  - 策略赋能与后端闭环延后到世界框架稳定之后。
- 新增室内可交互物件第一版框架：
  - `birth_house` 现在支持床、书架、长案、木牌四类交互挂点。
- 新增室内场景素材加载能力：
  - 进入室内时按地图实际使用的 `smap` 瓦片动态加载缺失贴图，不再完全依赖 `BootScene` 的硬编码预加载列表。
- 对 `birth_house` 做了第一轮可见陈设补充：
  - 已补床位、书卷架、案台、门边木牌及少量生活化摆件。
- 对 `birth_house` 做了第一轮语义校正：
  - 床改用更接近床铺的 `JYQXZ` 现有素材。
  - 为书架、案台、木牌补了自定义像素贴图，避免继续拿错误语义的原素材硬凑。
- 对 `birth_house` 做了第二轮“真实场景化”重构：
  - 室内地面从草地改为自定义木地板，并补了一块可复用的红毯地砖组合。
  - 用多格组合贴图重做了帷幔木榻、藏卷书架、长案、屏风、双联告示牌、火盆和木箱。
  - 压缩了室内切屋顶范围，避免屋顶遮挡主要家具视野。
  - 床、书架、长案、屋规告示的交互坐标与文案已同步到新的室内布局。

### 2026-04-25

- 新增 `packages/visual/public/场景编辑模块/`，作为观察者小屋和后续室内场景的独立瓦片/贴图分层编辑模块。
- 明确新的室内生产流程：先维护贴图包，再在编辑器中按 `floor / wall_back / decor / front_occluder / collision` 分层摆放，最后导出场景 JSON。
- 当前模块先不接入主 Phaser 运行时，避免继续扩大 `MapRenderer.ts` 的硬编码；下一步应实现 scene JSON loader。

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

### 2026-04-27 玩家体系底座

- 升级 `packages/visual/src/types.ts` 的 `PlayerProgress`：加入 `version`、玩家身份、基础属性、物品堆叠、秘籍进度、装备栏和 flags。
- `packages/visual/src/core/GameStore.ts` 继续作为玩家长期状态入口，但新增了更明确的操作方法：`grantItem`、`consumeItem`、`discoverManual`、`learnManual`、`hasItem`、`hasManual`，并保留 `addManual` 兼容现有小屋书架交互。
- 新增内容定义：
  - `packages/visual/src/content/PlayerItems.ts`：物品定义表，当前包含 `manual_tuna_intro`。
  - `packages/visual/src/content/PlayerManuals.ts`：秘籍定义表，当前包含《吐纳入门》。
- 旧版 `deepsolo_player_progress` 存档兼容迁移：旧的 `inventory: string[]` 会转换为物品堆叠，旧的 `manuals: string[]` 会转换为已研读秘籍进度。
- 新增 `packages/visual/src/ui/PlayerPanel.ts`：按 `I` 打开/关闭玩家面板，展示身份、生命/内力、攻击/防御/身法/悟性/福缘、装备栏、背包和秘籍。
- `packages/visual/src/ui/HeaderBar.ts` 增加 `I 玩家面板` 操作提示。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 玩家面板分层

- `packages/visual/src/ui/PlayerPanel.ts` 改为左侧 Tab 分层：`个人属性`、`武功`、`物品`。
- `个人属性` 页展示身份、生命/内力、基础属性和装备栏。
- `武功` 页新增可学习武功列表：当前通过 `packages/visual/src/content/PlayerMartialArts.ts` 定义，已接入《吐纳入门》解锁的 `吐纳功`；获得秘籍后可在该页点击 `研读`，调用 `GameStore.learnManual` 生效。
- `物品` 页展示背包物品和已获秘籍；物品图标使用 `packages/visual/public/assets/jy-runtime/08_thing/0079.png`，运行时路径为 `assets/jy-runtime/08_thing/0079.png`。
- `packages/visual/src/content/PlayerItems.ts` 的物品定义新增 `iconPath` 字段，用于后续不同物品绑定不同贴图。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 玩家物品/武功循环

- 玩家物品页新增 `放弃` 操作：调用 `GameStore.abandonItem(itemId)`，直接移除背包中的该物品堆叠；如果放弃的是未研读秘籍，会同步移除未学习的秘籍进度。
- 武功页新增 `遗忘` 操作：调用 `GameStore.forgetManual(manualId)`，移除已掌握武功记录，但不回滚已经获得的属性加成。
- `GameStore.learnManual(manualId)` 改为需要背包中存在对应秘籍物品；研读成功后消耗秘籍物品，并再次应用秘籍属性加成，因此遗忘后重新获取、重新研读可以继续叠加属性。
- 书架获取秘籍逻辑改为以当前玩家状态为准：只要背包已有对应秘籍，或当前已掌握/已记录该秘籍，就不会重复获得；遗忘且背包没有该秘籍后，可以再次从书架获得。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 基础武功

- `packages/visual/src/content/PlayerMartialArts.ts` 新增先天武功 `普通攻击`：不依赖秘籍、不占背包、不可遗忘，作为玩家默认掌握的基础战斗动作。
- `packages/visual/src/ui/PlayerPanel.ts` 的武功页支持 `innate` 武功：显示为 `基础武功`，操作按钮为禁用态 `常驻`。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 大地图玩家战斗 MVP

- 大地图战斗入口从“B 键随机 Agent vs Agent”改为“玩家靠近 Agent 后按 B 发起切磋”。
  - 入口：`packages/visual/src/scenes/WorldScene.ts`
  - 附近 Agent 查询：`packages/visual/src/systems/EntitySystem.ts#getNearbyAgent`，现在返回距离最近者。
- `packages/visual/src/data/BattleData.ts` 新增 `createPlayerBattlePerson(progress, team, startPos)`：把玩家长期档案转换成战斗角色。
  - 玩家 HP/MP 在战斗内按 5 倍放大，以匹配现有 Agent 战斗数值量级。
  - 玩家攻击/防御/身法从个人属性换算：攻击 x6、防御 x5、身法 x5。
  - 当前玩家战斗武功先接 `NORMAL_ATTACK`，后续攻击型武功再从玩家武功体系映射。
- `packages/visual/src/systems/BattleSystem.ts` 新增 `startPlayerVsAgent(agentId, agentName)`：玩家红方、Agent 蓝方。
  - 支持 `controlledPersonId`：玩家回合手动，敌方 Agent 回合 AI。
  - 保留原 `start(redId, blueId)`，用于旧的 Agent vs Agent 自动战斗。
  - 战斗结束后把玩家剩余 HP/MP 按比例写回 `GameStore.playerProgress`。
  - `battle:end` 事件改为结束画面停留 3 秒并清理战斗后再发出，避免大地图和战斗结束画面同时显示。
- `packages/visual/src/core/GameStore.ts` 新增 `setPlayerVitals(hp, mp)`，用于战斗结束状态回写。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 普通攻击熟练度 MVP

- `packages/visual/src/types.ts` 的 `PlayerProgress` 新增 `martials`，用于记录玩家武功成长数据。
  - 当前记录字段：`martialId`、`level`、`exp`、`totalUses`、`hitCount`、`whiffCount`、`stack`。
- `packages/visual/src/content/PlayerMartialArts.ts` 新增武功成长辅助函数：
  - `MARTIAL_LEVEL_MAX = 10`
  - `getMartialRequiredExp(level)`：当前规则为 Lv.N 升下级需要 `N * 10` 熟练度。
  - `getMartialPowerMultiplier(level, stack)`：当前规则为每级威力 +8%，每层 stack 额外 +5%。
- `packages/visual/src/core/GameStore.ts` 新增武功成长操作：
  - `getMartialProgress(martialId)`
  - `getMartialPowerMultiplier(martialId)`
  - `recordMartialUse(martialId, hit)`
  - 旧存档迁移时会自动补入 `basic_attack` 的 Lv.1 熟练度记录。
- `packages/visual/src/systems/BattleSystem.ts` 接入普通攻击成长：
  - 战斗技能 `normal_attack` 映射到玩家武功 `basic_attack`。
  - 玩家每次释放普通攻击都会记录熟练度：命中 +2，空挥/未命中 +1。
  - 伤害计算会读取玩家该武功的等级倍率；当前普通攻击等级越高，威力越高。
  - 战斗日志会显示 `普通攻击 Lv.X`，升级时显示升级提示。
- `packages/visual/src/ui/PlayerPanel.ts` 的武功页展示武功等级、熟练度进度条、威力倍率、使用次数、命中次数和空挥次数。
- `packages/visual/src/ui/styles.css` 新增武功熟练度进度条样式。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗 HUD 第一版重做

- `packages/visual/src/systems/BattleSystem.ts` 调整战斗开局站位：红方/玩家固定在左下 `{ x: 2, y: 7 }`，蓝方/对手固定在右上 `{ x: 7, y: 2 }`，进入战斗时双方强制互相面对。
- 战斗背景从单纯深色遮罩改为武侠战棋舞台：深色幕布、暖金边框、左右环境光，标题改为 `江湖切磋`。
- HUD 从临时调试样式改为固定信息层级：
  - 顶部左右双方状态卡，显示阵营、姓名、当前武功、生命/内力条和数值。
  - 左下固定 `战斗记录` 面板，日志不再挤在底部中央。
  - 底部固定横向命令栏，替代原右侧竖向小菜单。
- 操作菜单支持横向选择：`←/↑` 上一个命令，`→/↓` 下一个命令，`Space` 确认，`Esc` 返回。
- 武功选择菜单改为底部技能卡片，显示技能名、内力消耗、范围，并以青绿色高亮当前技能。
- 战斗中 HP/MP UI 现在会同时更新玩家和对手的生命、内力条与数值。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗攻击距离修正

- `packages/visual/src/systems/BattleSystem.ts` 修正手动攻击距离：进入目标选择时会显示当前武功的红色攻击范围；只能对红色范围内的格子释放，超出距离会提示 `攻击距离不足`，不会执行攻击。
- 普通攻击仍为距离 1；后续远程/剑法/掌法可通过 `WugongDef.attackRange` 控制攻击距离。
- AI 移动策略从“尽量贴近敌人”改为“优先停在自己武功刚好能打到的位置”；远程武功不会无脑贴脸，近战普通攻击仍会自然接近到 1 格。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗表现清理第一版

- `packages/visual/src/data/BattleData.ts` 修正 `NORMAL_ATTACK.aoeSize`：普通攻击从 3x3 群攻改为单体 `aoeSize: 1`。
- `packages/visual/src/systems/BattleSystem.ts` 的移动动画改为按 BFS 路径逐格移动，不再从起点直线 Tween 到终点，避免视觉上穿过其他角色。
- 战斗角色脚下常驻调试感元素清理：移除角色脚下红/蓝色块和常驻姓名文本，保留更克制的黑色淡影。
- 当前行动者增加金色脚下光圈；攻击目标选择增加红色目标光圈，均会随角色/光标位置更新。
- 手动攻击结束后会正确退出本回合手动状态，清理当前行动光圈和目标光圈。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗角色动作层分离

- 新增 `packages/visual/src/content/BattleActors.ts`：独立描述战斗角色动作资源。
  - 当前配置 `fight000`，对应 `assets/jy-runtime/12_fight/Fight000/0040.png-0087.png`。
  - `idle` 使用每个方向的起始帧：40/52/64/76。
  - `attack` 使用四方向攻击帧：40-51、52-63、64-75、76-87。
- 新增 `packages/visual/src/systems/BattleAnimator.ts`：封装战斗动作播放。
  - 提供 `getIdleTextureKey`、`hasIdleTexture`、`resetToIdle`、`playAttack`。
  - 后续可扩展 `move`、`hit`、`defend`、`dead`，不再混用大地图 `chars` 图集。
- `packages/visual/src/systems/BattleSystem.ts` 不再直接维护 `DIR_TO_FIGHT_OFFSET`、`fightKey`、`cycleAttackFrames` 等 Fight000 细节，改为通过 `BattleAnimator` 播放站立和攻击动作。
- 这一步只做资源/动作职责分离，战斗视觉表现保持原有行为；下一步可继续新增 `BattleSkillVisuals.ts` 管理武功特效、文字、范围形状和等级视觉阶段。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 武功表现配置层

- 新增 `packages/visual/src/content/BattleSkillVisuals.ts`：集中配置武功表现，不再让 `BattleSystem.ts` 直接写死特效表现。
  - 支持字段：`targetMode`、`rangeShape`、`effectId`、`effectScale`、`castText`、`castTextColor`、`showCastText`、`impactDelayMs`、`hitStopMs`、`cameraShake`、`tiers`。
  - 当前已配置 `normal_attack`、`zhuihun_jian`、`fengmo_zhang`、`taiji_quan`、`jingang_fumo`、`luoying_shenjian`、`dugu_jiujian`。
- 普通攻击接入等级视觉阶段：
  - Lv.1：`003`，小特效，不显示招式字。
  - Lv.4：`004`，显示 `拳风初成`。
  - Lv.7：`006`，显示 `拳劲纵横`，带轻微震动。
  - Lv.10：`009`，显示 `登峰一击`，更大特效、震动和更长命中停顿。
- `packages/visual/src/systems/BattleSystem.ts` 现在通过 `getBattleSkillVisual(skill, level)` 决定：
  - 是否单体/群攻。
  - 播放哪个 eft 特效。
  - 特效缩放。
  - 是否显示招式文字。
  - 命中延迟、命中停顿、屏幕震动。
- `playEftSprite` 和 `playAoeEffect` 支持传入 `effectScale`；`showKungfuName` 支持直接传入配置色值。
- 新增 `hitStop(durationMs)`，用于命中瞬间短暂停顿；当前通过 `tweens.pauseAll/resumeAll` 实现。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗页面右侧面板优化

- 新增 `packages/visual/docs/battle_system_tuning.md`：记录战斗系统调参入口，包括棋盘缩放、右侧面板、状态卡、日志、行动命令、武功表现和初始站位。
- `packages/visual/src/config.ts` 将 `BATTLE_TILE_SCALE` 调整为 `2.25`，让中心战斗棋盘更大、更有存在感。
- `packages/visual/src/systems/BattleSystem.ts` 将战斗 HUD 从顶部/底部分散布局改为右侧贴边固定面板：
  - 上方显示回合、操作提示和双方状态卡。
  - 中部固定显示 `战斗记录`。
  - 底部固定显示行动命令，`移动/攻击/防御/休息/状态/自动` 使用 2 列按钮网格。
  - 武功选择也复用右侧底部区域，避免遮挡中心战斗地图。
- 行动菜单方向键适配 2 列网格：左右切换同一行，上下跨行切换。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗右侧 HUD 减重修正

- 用户反馈上一版右侧面板“越来越不好看”，本次把设计方向从厚重后台面板改为轻量武侠战斗栏。
- `packages/visual/src/systems/BattleSystem.ts` 调整：
  - 右侧面板宽度从 `314` 降到 `286`，边距从 `22` 降到 `18`，减少对战场的压迫。
  - `getBoardCenter()` 增加 `+28` 视觉补偿，让棋盘不被过度挤到左侧。
  - 主面板透明度降低，减少多层粗边框，只保留轻量金色分割线。
  - 状态卡改为细左侧色条 + 半透明底，不再使用厚重双框。
  - 行动按钮和武功卡片去掉外层大黑框，直接嵌入右侧栏，降低“调试 UI”感觉。
- `packages/visual/docs/battle_system_tuning.md` 同步记录新原则：战斗地图是主角，右侧只做半透明信息层，不要继续堆厚重外框。
- 验证：`cd packages/visual && npm run build` 已通过，仅保留 Vite 大 chunk 体积警告。

### 2026-04-27 战斗 HUD 参考图方向修正 + Vite 警告处理

- 用户给出参考图后，确认上一版“右侧整条战斗栏”方向不对，改为参考图式“四角 HUD + 中心战场”：
  - 左上：玩家/敌人状态卡，加入小头像框。
  - 右上：战局、回合、操作提示。
  - 左下：战斗记录。
  - 右下：行动命令/武功选择。
  - 底部中间：简易出手顺序条。
- `packages/visual/src/systems/BattleSystem.ts` 调整：
  - 删除对整条右侧面板布局的依赖，`getBoardCenter()` 回到屏幕中心略向下。
  - 新增 `getBattleInfoRect()`，状态/日志/命令分别回到四角浮层。
  - 右下行动菜单恢复为参考图的 2 列按钮卡片，不再占整侧。
  - `renderTurnOrder()` 新增底部出手顺序条。
- `packages/visual/vite.config.ts` 设置 `build.chunkSizeWarningLimit = 1800`：Phaser 单页游戏当前 bundle 体积在预期内，避免 Vite 大 chunk 误报警告。
- `packages/visual/docs/battle_system_tuning.md` 同步更新：记录“四角 HUD + 中心战场”的新布局原则。
- 验证：`cd packages/visual && npm run build` 已通过，且不再输出 Vite 大 chunk 警告。

### 2026-04-27 玩家战斗生命/内力同步修正

- 修正用户发现的问题：战斗 HUD 显示玩家生命 `500`，但个人属性生命上限是 `100`。
- 原因：`packages/visual/src/data/BattleData.ts#createPlayerBattlePerson` 曾为了临时匹配 Agent 战斗量级，把玩家 HP/MP 乘以 5。
- 现在改为生命/内力直接读取 `GameStore.playerProgress.vitals`：
  - `hp = progress.vitals.hp`
  - `maxHp = progress.vitals.maxHp`
  - `mp = progress.vitals.mp`
  - `maxMp = progress.vitals.maxMp`
- `packages/visual/src/systems/BattleSystem.ts#syncPlayerVitalsAfterBattle` 同步改为战斗结束直接回写 HP/MP，不再除以 5。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-27 战斗移动走路帧接入

- 用户指出战斗中移动目前是战斗站立图平移，缺少走路动作。
- `packages/visual/src/scenes/BootScene.ts` 新增加载 `assets/jy-runtime/16_walk/2501.png-2528.png`，key 为 `battle_walk_2501` 到 `battle_walk_2528`。
- `packages/visual/src/content/BattleActors.ts` 扩展 `fight000` 动作配置：
  - 站立/攻击继续使用 `12_fight/Fight000/0040.png-0087.png`。
  - 移动使用 `16_walk`：右上 `2501-2507`，右下 `2508-2514`，左上 `2515-2521`，左下 `2522-2528`。
  - 新增 `walkScale = 2.35`、`walkOriginY = 0.88`，让 16_walk 尺寸接近当前战斗人物比例。
- `packages/visual/src/systems/BattleAnimator.ts` 新增 `playWalk()` / `hasWalkTexture()` / `getWalkTextureKey()`，并在恢复站立时重置贴图、缩放和锚点。
- `packages/visual/src/systems/BattleSystem.ts#animateMove` 在逐格移动 tween 期间播放 walk 循环，移动结束后停止 walk timer 并恢复 Fight000 站立帧。
- `packages/visual/docs/battle_system_tuning.md` 同步记录走路帧编号、方向映射和调参入口。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-27 战斗走路频率修正

- 用户反馈 NPC 战斗走路频率过快，看不到走路样子。
- 原因：`BattleSystem.animateMove` 每格移动最短只有 120ms，且每走一格都会重启 walk 动画，导致基本只看到起始帧。
- `packages/visual/src/systems/BattleSystem.ts` 新增 `BATTLE_MOVE_STEP_DURATION = 260`，逐格移动固定为 260ms，让每格至少能看到 2-3 个走路帧。
- `faceToward(person, target, updateSprite = true)` 增加可选参数；移动中只更新朝向，不立刻重置回站立帧。
- `animateMove` 现在同方向连续移动不会重启 walk timer，只有转向时才重启对应方向走路帧。
- `packages/visual/src/content/BattleActors.ts` 将 `16_walk` 的 `frameIntervalMs` 从 95ms 调慢到 120ms。
- `packages/visual/docs/battle_system_tuning.md` 补充：走路观感优先调 `BATTLE_MOVE_STEP_DURATION` 和 `frameIntervalMs`。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-27 战斗系统优化阶段性收尾文档

- 用户确认本轮战斗系统优化完成，已更新 `packages/visual/docs/battle_system_tuning.md`。
- 文档补充当前完成状态：
  - 玩家手动战斗入口。
  - 四角 HUD + 中心战场布局。
  - 玩家生命/内力直接取个人属性并回写。
  - BFS 逐格移动与角色碰撞。
  - `16_walk/2501-2528` 战斗走路帧。
  - 普通攻击单体化、熟练度成长与等级视觉阶段。
  - 武功表现配置层。
  - Vite 大 chunk 警告处理方式。
- 文档同步最新参数：`BATTLE_MOVE_STEP_DURATION = 260`、walk `frameIntervalMs = 120`、`chunkSizeWarningLimit = 1800`。

### 2026-04-28 大地图建筑贴图替换

- 用户要求将大地图建筑替换为 `../assets-library/deepsolo/world_buildings/source` 下的贴图。
- 新增运行时透明裁剪贴图目录：`packages/visual/public/assets/world/buildings/`。
  - `ai_building_a_share.png`
  - `ai_building_crypto.png`
  - `ai_building_us.png`
  - `ai_building_gold.png`
- `美股门派.png` 原图带棋盘格底，运行时版本已做边缘白/灰棋盘格透明处理；原图保留不改。
- `packages/visual/src/scenes/BootScene.ts` 新增 `WORLD_BUILDING_ASSETS` 预加载四张建筑贴图。
- `packages/visual/src/systems/BuildingMarkers.ts` 将原来的文字 + 黄点入口标记替换为建筑贴图 + 阴影 + 名称 + 小入口光点。
  - 当前映射：`exchange=A股门派`、`token_center=数字币门派`、`news=美股门派`、`teahouse=黄金门派`，`birth_house` 暂用 A 股门派，`heimu_cliff` 暂用黄金门派。
  - 建筑容器深度改为 `entryY + 0.25`，让玩家接近时有基本前后层级关系。
- 新增文档 `packages/visual/docs/world_building_assets.md`，记录资源、映射和调参入口。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图建筑落地与清晰度修正

- 用户反馈大地图建筑“漂浮在空中”且“分辨率不清晰”。
- 原因：上一版直接把 1000+ 像素大图在 Phaser 中用 `scale=0.12-0.16` 实时缩小，线性采样导致发糊；同时建筑 `originY=1` 且 `offsetY` 为负值，等于把建筑底部悬在入口点上方。
- 重新生成 `packages/visual/public/assets/world/buildings/` 运行时贴图为游戏内目标尺寸：
  - A股门派：`230x219`
  - 数字币门派：`210x191`
  - 美股门派：`260x216`
  - 黄金门派：`250x198`
- `packages/visual/src/systems/BuildingMarkers.ts` 修正：
  - 移除每个建筑的 `scale` 配置，建筑显示 `scale=1`。
  - 改为 `originY=0.88-0.9`，让门口/台阶压到入口点附近。
  - `offsetY` 改为 `0`，避免负偏移造成漂浮。
  - 删除建筑整体上下浮动 tween，只保留轻微缩放呼吸。
- `packages/visual/docs/world_building_assets.md` 同步补充：要改显示大小优先重新生成 runtime 图，不建议 Phaser 大比例缩放。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图建筑晃动修正

- 用户反馈大地图建筑在渲染层感觉晃动。
- 原因：上一版保留了建筑本体 `scaleX/scaleY` 的轻微呼吸 tween，静态建筑会看起来抖动。
- `packages/visual/src/systems/BuildingMarkers.ts` 已移除建筑本体 tween，建筑完全固定；仅入口小光点保留 alpha/scale 脉冲提示。
- `packages/visual/docs/world_building_assets.md` 已同步说明建筑本体不做 tween。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图入口/碰撞编辑模式 MVP

- 用户希望大地图也有编辑模式，可以增加入口及碰撞效果。
- 新增 `packages/visual/src/systems/WorldMapEditor.ts`：
  - `F3` 开关大地图编辑模式。
  - 显示绿色入口圈/入口点、红色碰撞圈/碰撞点。
  - 拖绿色点移动建筑入口；拖红色点移动碰撞中心。
  - `[` / `]` 调入口半径，`-` / `=` 调碰撞半径，`Delete` 清除碰撞，`R` 恢复默认。
  - 编辑结果保存到 `localStorage`：`deepsolo_world_map_editor_layouts`。
- `packages/visual/src/types.ts` 的 `BuildingDef` 新增 `collisionX/collisionY/collisionRadius`。
- `packages/visual/src/content/WorldBuildingCollision.ts` 新增大地图建筑碰撞检测；入口半径内会跳过碰撞，避免入口被挡住。
- `packages/visual/src/entities/Player.ts` 在世界地图移动时接入 `isBlockedByWorldBuildingCollision()`。
- `packages/visual/src/systems/BuildingMarkers.ts` 改为每帧按 `buildingId` 读取当前 `BUILDINGS` 坐标，编辑入口后建筑贴图即时移动。
- `packages/visual/src/scenes/WorldScene.ts` 接入编辑器创建、快捷键和 update。
- 新增文档 `packages/visual/docs/world_map_editor.md`，记录操作方式、代码入口、存储结构和碰撞规则。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图编辑器鼠标面板

- 用户希望大地图编辑模式尽量都用鼠标操作。
- `packages/visual/src/systems/WorldMapEditor.ts` 新增右侧鼠标操作面板：
  - `入口 -` / `入口 +`：调整入口半径。
  - `碰撞 -` / `碰撞 +`：调整碰撞半径。
  - `清除碰撞`：清除当前建筑碰撞。
  - `恢复默认`：清空本地保存并恢复代码默认。
  - `关闭编辑模式`：退出编辑模式。
- 拖拽绿色入口点、红色碰撞点、点击选择建筑仍然保留；快捷键也保留作为备用。
- `packages/visual/docs/world_map_editor.md` 已同步鼠标面板说明。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图编辑器改为观察者小屋式交互

- 用户明确希望大地图编辑方式类似室内观察者小屋，而不是右侧后台按钮面板。
- `packages/visual/src/systems/WorldMapEditor.ts` 已改为纯场景内 WYSIWYG 操作：
  - 取消右侧鼠标操作面板。
  - 左下角中文操作说明支持点击或 `H` 收起/展开。
  - 绿色圆点拖动入口中心，绿色方块拖动入口半径。
  - 红色圆点拖动碰撞中心，红/橙色方块拖动碰撞半径。
  - 无碰撞建筑会显示红色空心点，拖动即可新建碰撞。
  - 右键红色碰撞手柄可清除碰撞，滚轮/快捷键仅保留为辅助微调。
- `packages/visual/src/scenes/WorldScene.ts` 合并 `H/R/Delete` 绑定：大地图编辑器开启时优先操作大地图编辑器，否则继续操作室内家具编辑器。
- `packages/visual/docs/world_map_editor.md` 已同步最新操作方式和代码入口。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图入口与建筑贴图坐标拆分

- 用户反馈拖绿色点时整栋建筑一起移动，且红/橙碰撞点不可见。
- 原因：上一版 `BuildingMarkers` 直接用 `entryX/entryY` 作为建筑贴图锚点，入口点和建筑本体耦合；同时旧版 localStorage 保存了 `collisionRadius=0`，会覆盖代码默认碰撞。
- `packages/visual/src/types.ts` 的 `BuildingDef` 新增 `visualX/visualY`，表示建筑贴图本体锚点。
- `packages/visual/src/data/BuildingData.ts` 为现有大地图建筑配置 `visualX/visualY` 和默认 `collisionX/collisionY/collisionRadius=2.8`。
- `packages/visual/src/systems/BuildingMarkers.ts` 改为使用 `visualX/visualY` 渲染建筑；拖绿色入口点不再移动建筑贴图。
- `packages/visual/src/systems/WorldMapEditor.ts` 存储版本升级到 v2：旧 v1 保存会保留入口调整，但不会用旧的 0 碰撞覆盖新默认碰撞，因此红/橙碰撞点会重新出现。
- `packages/visual/docs/world_map_editor.md` 已补充建筑本体、入口、碰撞三套坐标的区别。
- 验证：`cd packages/visual && npm run build` 已通过，且无 Vite 大 chunk 警告。

### 2026-04-28 大地图建筑本体拖动恢复

- 用户反馈拆分入口后建筑本体没法拖动。
- `packages/visual/src/systems/WorldMapEditor.ts` 新增 `visual-center` 编辑手柄：
  - 编辑模式显示黄色建筑锚点。
  - 拖黄色点或直接拖建筑主体区域，会修改 `visualX/visualY`，移动整栋建筑贴图。
  - 绿色点继续只移动入口，红/橙点继续只编辑碰撞。
  - localStorage 保存版本升级到 v3，开始保存 `visualX/visualY`。
- `packages/visual/src/systems/BuildingMarkers.ts` 中入口光点改为跟随真实 `entryX/entryY`，建筑容器本体继续跟随 `visualX/visualY`。
- `packages/visual/docs/world_map_editor.md` 已同步黄色建筑锚点和拖建筑主体的说明。
- 验证：`cd packages/visual && npm run build` 已通过。

### 2026-04-28 大地图建筑碰撞升级为不规则多边形

- 用户指出建筑碰撞不应该是圆形，应该是不规则多边形。
- `packages/visual/src/types.ts` 的 `BuildingDef` 新增 `collisionPolygon?: Array<{x,y}>`。
- `packages/visual/src/data/BuildingData.ts` 为现有建筑配置默认六边形碰撞轮廓，作为可拖拽初始形状。
- `packages/visual/src/content/WorldBuildingCollision.ts` 改为优先使用 `collisionPolygon` 做点在多边形内检测；旧 `collisionRadius` 只作为无多边形时的兜底。
- `packages/visual/src/systems/WorldMapEditor.ts`：
  - 橙色多边形表示建筑真实碰撞区域。
  - 拖橙色点调整顶点。
  - `Shift+点击` 新增碰撞顶点。
  - 右键/`Alt+点击` 橙色点删除顶点。
  - 拖黄色建筑锚点移动建筑时，会同步平移碰撞多边形。
  - localStorage 保存版本升级到 v4，保存 `collisionPolygon`。
- `packages/visual/docs/world_map_editor.md` 已同步多边形碰撞操作说明。
- 验证：`cd packages/visual && npm run build` 已通过。

### 2026-04-29 项目治理基线

- 用户要求将项目按正规化方式治理。
- 新增根目录治理文档：
  - `docs/project_governance.md`：质量门禁、变更分类、编辑器数据生命周期、文档规则、代码治理规则和发布检查清单。
  - `docs/technical_debt_register.md`：当前 P1/P2 技术债清单，包括 debug 坐标、错误出口距离、大文件拆分、localStorage 固化、测试缺失等。
- 新增 Visual 包治理文档：`packages/visual/docs/visual_governance.md`，记录模块边界、编辑器模式约定、大地图建筑数据约定和回归场景。
- 新增治理巡检脚本：`scripts/visual_governance_audit.mjs`，检查必要治理文档、package scripts、大文件、console.log 和 debug 风险。
- `packages/visual/package.json` 新增脚本：
  - `typecheck`：`tsc --noEmit`
  - `check`：`npm run build`
  - `audit:governance`：运行治理巡检脚本
- `README.md` 和 `packages/visual/README.md` 已补充治理入口和常用命令。

### 2026-04-29 治理 P1：普通模式隐藏 debug 坐标

- 按治理清单开始处理 P1 问题。
- `packages/visual/src/systems/MapRenderer.ts` 新增 `isFurnitureEditorActive()`，用于外部判断室内家具编辑器是否开启。
- `packages/visual/src/scenes/WorldScene.ts` 调整 `#debug-info`：
  - 只有大地图编辑器 `F3` 开启，或室内家具编辑器 `F2` 开启时才显示坐标。
  - 普通玩家模式会清空并隐藏 debug 文本。
  - 室内出口距离改为使用 `sceneManager.getCurrentBuildingId()` 找当前建筑，修掉 `BUILDINGS.find(b => true)`。
- `docs/technical_debt_register.md` 已把这两项从 P1 移到“已处理”。

### 2026-04-29 治理 P1：收紧大地图多边形新增顶点

- 继续处理治理清单 P1。
- `packages/visual/src/systems/WorldMapEditor.ts` 调整大地图碰撞多边形编辑：
  - 新增 `collisionInsertScreenThreshold = 18`。
  - `Shift+点击` 只有距离当前多边形边线 18px 内才会插入新顶点。
  - 插点时按屏幕空间找最近边，再插入到对应边后面，避免点远处导致轮廓跳变。
  - 如果当前建筑碰撞多边形已被清空，则 `Shift+点击` 会先恢复默认多边形，而不是随意插一个孤立点。
- `packages/visual/docs/world_map_editor.md` 和 `docs/technical_debt_register.md` 已同步。
- 验证：`npm run typecheck` 已通过。

### 2026-04-29 治理：大文件规范化与拆分文档

- 用户要求继续治理，并将大文件规范化、形成文档。
- 新增 `docs/large_file_governance.md`：定义大文件行数等级、拆分原则、例外规则、标准拆分流程和交付要求。
- 新增 `packages/visual/docs/battle_system_refactor_plan.md`：为 `BattleSystem.ts` 做职责盘点和四阶段拆分计划（规则、AI/输入、HUD/棋盘、动画调度）。
- 新增 `packages/visual/docs/map_renderer_refactor_plan.md`：为 `MapRenderer.ts` 做职责盘点和五阶段拆分计划（坐标工具、世界渲染、室内图层、家具遮挡、编辑器）。
- `docs/project_governance.md` 增加大文件治理入口。
- `packages/visual/docs/visual_governance.md` 和 `packages/visual/README.md` 增加大文件治理文档链接。
- `docs/technical_debt_register.md` 中大文件技术债已关联专项拆分计划。
- `scripts/visual_governance_audit.mjs` 将大文件提醒指向 `docs/large_file_governance.md`，并把三个大文件治理文档列为必须文档。

### 2026-04-29 大文件拆分第一刀：BattleRules

- 按大文件治理计划开始拆 `BattleSystem.ts`。
- 新增 `packages/visual/src/systems/battle/BattleRules.ts`，迁移战斗纯规则/弱依赖规则：
  - `manhattanDist`
  - `isInAttackRange`
  - `calcAttackRange`
  - `calcMoveRange`
  - `calcMovePath`
  - `calcBattleDamage`
  - `checkBattleEnd`
  - `uniqueSkills`
  - `getEnemy`
  - `getSkillAreaSize`
- `BattleSystem.ts` 改为调用 `BattleRules`，保留主类对玩家武功倍率、状态机、动画和 HUD 的协调职责。
- `BattleSystem.ts` 行数从约 2456 降到约 2314，仍超过高风险阈值，后续继续拆 AI/输入、HUD/棋盘、动画调度。
- `packages/visual/docs/battle_system_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步阶段 1 状态。
- 验证：`npm run typecheck` 已通过。

### 2026-04-29 大文件拆分第二刀：BattleAI 与 BattleInputController

- 继续按大文件治理计划拆 `BattleSystem.ts`。
- 新增 `packages/visual/src/systems/battle/BattleAI.ts`：
  - 将原 `aiDecide` 迁移为 `decideBattleAI(person, persons)`。
  - 复用 `BattleRules` 中的 `getEnemy`、`manhattanDist`、`calcMoveRange`。
- 新增 `packages/visual/src/systems/battle/BattleInputController.ts`：
  - 统一初始化战斗键盘按键。
  - 提供 `consumeToggleAuto()` 和 `consumeInput()`，替代主类中的 `battleKeys/initBattleKeys/getBattleInput`。
- `BattleSystem.ts` 继续保留手动阶段流转和 UI/动画协调，行数降至约 2239。
- `packages/visual/docs/battle_system_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步阶段 2 状态。
- 验证：`npm run typecheck` 已通过。

### 2026-04-29 大文件拆分第三刀：BattleBoardRenderer

- 继续按大文件治理计划拆 `BattleSystem.ts`。
- 新增 `packages/visual/src/systems/battle/BattleBoardRenderer.ts`：
  - 负责战斗棋盘背景、标题、地砖和网格绘制。
  - 负责 `arenaToScreen` 和 `getBoardCenter` 坐标换算。
  - 负责手动模式光标显示、隐藏、位置更新。
  - 负责移动范围和攻击范围覆盖层绘制与清理。
- `BattleSystem.ts` 改为通过 `boardRenderer` 调用棋盘/光标/范围渲染能力，主类继续保留战斗状态机、人物环、HUD、菜单、日志和动画调度。
- 本次有意不迁移目标环/当前行动环/HUD，避免一次性改动过大；后续可继续拆 `BattleHUDRenderer`。
- `BattleSystem.ts` 行数降至约 1984，仍处于大文件技术债范围，但已从高风险区间明显下降。
- `packages/visual/docs/battle_system_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步阶段 3 状态。
- 验证：`npm run typecheck`、`npm run check`、`npm run audit:governance` 已通过；构建仅保留 Vite 大 chunk 提示。

### 2026-04-29 大文件拆分第四刀：BattleHUDRenderer

- 继续按大文件治理计划拆 `BattleSystem.ts`。
- 新增 `packages/visual/src/systems/battle/BattleHUDRenderer.ts`：
  - 负责战斗 HUD 框架、双方状态卡、生命/内力条和回合标签。
  - 负责行动菜单、武功菜单、提示文字。
  - 负责战斗记录滚动和战斗结束遮罩。
- `BattleSystem.ts` 改为通过 `hudRenderer` 调用 HUD、菜单、日志和结束画面能力，主类继续保留战斗状态机、手动阶段流转、人物环、动画调度和持久化写回。
- 本次不改 UI 视觉、不改战斗数值、不改输入行为，仅做职责迁移。
- `BattleSystem.ts` 行数降至约 1411，已退出大文件治理告警；`MapRenderer.ts` 仍是当前主要大文件技术债。
- `packages/visual/docs/battle_system_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步阶段 3 完成状态。
- 验证：`npm run check`、`npm run audit:governance` 已通过；构建仅保留 Vite 大 chunk 提示。

### 2026-04-29 MapRenderer 拆分第一批：坐标、世界 canvas、编辑器持久化

- 按 `packages/visual/docs/map_renderer_refactor_plan.md` 开始拆 `MapRenderer.ts`。
- 新增 `packages/visual/src/systems/map/IndoorCoordinateMapper.ts`：
  - 迁移室内 `map <-> screen` 坐标换算。
  - 迁移编辑器 local 坐标换算、数值取整、矩形归一化。
  - 迁移室内调试菱形/矩形描边工具。
- 新增 `packages/visual/src/systems/map/WorldMapCanvasRenderer.ts`：
  - 迁移世界地图双缓冲 canvas 初始化与缓存。
  - 迁移 `shouldRerender`、`renderBuffer`、`blitToScreen` 和世界地图 atlas tile 绘制。
  - `MapRenderer.ts` 保留同名公开 API 和 `scrImage` getter，兼容 `WorldScene` / `SceneManager`。
- 新增 `packages/visual/src/systems/map/IndoorEditorPersistence.ts`：
  - 迁移家具编辑器/交互区域编辑器的 localStorage key、快照创建、快照应用、读取和保存。
- `MapRenderer.ts` 行数从约 2145 降至约 1844，仍在大文件技术债范围；下一批优先拆家具遮挡或室内图层。
- `packages/visual/docs/map_renderer_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步。
- 验证：`npm run check`、`npm run audit:governance` 已通过；治理审计仍提示 `MapRenderer.ts` 大文件、`console.log` 和 debug-info 分散。

### 2026-04-29 MapRenderer 拆分第二批：家具遮挡层

- 继续拆 `MapRenderer.ts` 的家具遮挡职责。
- 新增 `packages/visual/src/systems/map/FurnitureOccluderRenderer.ts`：
  - 管理局部 mask 遮挡 sprite 和临时 canvas texture。
  - 负责根据 `occluderMask` 创建家具遮挡贴图。
  - 负责遮挡 sprite 与家具 base sprite 的位置、origin、scale、alpha 和 depth 同步。
  - 负责单个家具遮挡层销毁和全部遮挡层清理。
- `MapRenderer.ts` 改为通过 `FurnitureOccluderRenderer` 更新/同步家具遮挡，保留家具 base sprite 创建、拖拽编辑、调试点绘制。
- `MapRenderer.ts` 行数从约 1844 降至约 1734，仍处于大文件技术债范围；下一批可继续拆室内图层或家具 base sprite 渲染。
- `packages/visual/docs/map_renderer_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步。
- 验证：`npm run check`、`npm run audit:governance` 已通过；治理审计仍提示 `MapRenderer.ts` 大文件、`console.log` 和 debug-info 分散。

### 2026-04-29 MapRenderer 拆分第三批：室内图层渲染

- 继续拆 `MapRenderer.ts` 的室内图层职责。
- 新增 `packages/visual/src/systems/map/IndoorLayerRenderer.ts`：
  - 管理室内地板 canvas、`__indoorFloor` 纹理和地板 image 生命周期。
  - 迁移固定房间地板、普通室内 earth/surface 地板绘制。
  - 迁移普通室内墙/屋顶 sprite 创建、固定房间围墙创建。
  - 迁移屋顶透明度更新、墙/屋顶/地板清理。
  - 迁移室内 smap 偏移表、`drawSmapTileOnCtx`、`drawFixedTextureOnCtx`。
- `MapRenderer.ts` 保留 `switchToIndoor`、`switchToWorld`、`updateIndoorCamera` 和 `updateRoofVisibility` 公开入口，其中室内图层创建/销毁/屋顶透明委托给 `IndoorLayerRenderer`。
- `MapRenderer.ts` 行数从约 1734 降至约 1280，已退出大文件治理告警；治理审计当前不再提示大文件。
- `packages/visual/docs/map_renderer_refactor_plan.md` 和 `docs/technical_debt_register.md` 已同步。
- 验证：`npm run check`、`npm run audit:governance` 已通过；治理审计仅剩 `console.log` 和 debug-info 分散提示。

### 2026-04-29 治理清理：DebugLogger 与 audit 零提醒

- 用户要求继续朝项目健硕方向治理。
- 新增 `packages/visual/src/utils/DebugLogger.ts`：
  - `DebugLogger.info(scope, message, ...args)` 默认不输出。
  - 浏览器控制台执行 `localStorage.setItem('deepsolo:debugLogs', '1')` 并刷新后开启调试输出。
  - `DebugLogger.userInfo(...)` 用于用户主动操作反馈，例如家具配置导出。
- `packages/visual/src/services/ChatService.ts`：WebSocket 已连接/关闭日志改为 `DebugLogger.info`，普通体验版不再输出连接调试日志。
- `packages/visual/src/systems/MapRenderer.ts`：家具编辑器导出日志改为 `DebugLogger.userInfo`，文案从 `console` 调整为 `console.info`。
- `scripts/visual_governance_audit.mjs`：将 `styles.css` 纳入 `#debug-info` 合法归属，避免样式文件被误报为 debug-info 分散引用。
- `docs/technical_debt_register.md` 和 `packages/visual/docs/visual_governance.md` 已同步调试输出规则。
- 验证：`npm run check`、`npm run audit:governance` 已通过；治理审计当前显示“治理提醒：暂无”。

### 2026-04-29 健硕化：Visual 单元测试底座

- 用户要求继续朝项目健硕方向推进。
- 新增 `scripts/run_visual_unit_tests.mjs`：使用 `packages/visual` 已有的 `esbuild` 将 TypeScript 测试打包到系统临时目录并用 Node 运行，不额外引入测试框架或网络依赖。
- `packages/visual/package.json` 新增：
  - `test:unit`：运行 Visual 单元测试。
  - `check`：升级为 `typecheck + test:unit + build`。
- 新增 `packages/visual/tests/unit/` 首批测试：
  - `battle_rules.test.ts`：覆盖攻击范围、移动范围、绕障路径、确定性伤害、未命中、胜负判定、武功去重。
  - `indoor_coordinate_mapper.test.ts`：覆盖室内坐标换算、容器偏移、local 坐标、编辑器取整、碰撞/交互矩形归一化。
  - `indoor_editor_persistence.test.ts`：覆盖家具/交互区域快照应用、localStorage 保存和读取。
  - 当前共 17 个单元测试。
- `scripts/visual_governance_audit.mjs` 将 `test:unit` 纳入必须脚本检查。
- `packages/visual/README.md`、`packages/visual/docs/visual_governance.md`、`docs/project_governance.md`、`docs/technical_debt_register.md` 已同步测试门禁说明。
- 验证：`npm run check` 已通过，执行 `typecheck`、17 个 unit tests 和 Vite build；`npm run audit:governance` 显示“治理提醒：暂无”。

### 2026-04-29 类型体系治理：拆分 types.ts

- 用户询问项目结构后，按建议先治理 `packages/visual/src/types.ts`。
- 保留 `packages/visual/src/types.ts` 作为兼容 barrel，继续支持现有 `import ... from '../types'`。
- 新增 `packages/visual/src/types/` 领域类型文件：
  - `common.ts`：方向、地图元数据、地图数据、气泡配置。
  - `strategy.ts`：Agent 状态、策略、账户、状态标签/转换。
  - `discussion.ts`：讨论话题、讨论小组、对话行。
  - `world.ts`：场景状态、建筑、NPC、室内交互对象。
  - `player.ts`：玩家属性、生命内力、物品、秘籍、武功进度。
  - `dialogue.ts`：传统对话树。
  - `token.ts`：Token 中心类型。
  - `conversation.ts`：统一对话模型。
  - `battle.ts`：战斗角色、武功、行动、结果。
  - `story.ts`：剧情条件、动作、触发器、脚本。
  - `events.ts`：EventBus 事件映射。
- `types.ts` 从约 638 行降到 15 行；各领域类型文件均保持小文件。
- `packages/visual/docs/visual_governance.md`、`docs/project_governance.md`、`docs/technical_debt_register.md` 已同步类型边界规则。
- 验证：`npm run check` 和 `npm run audit:governance` 已通过，17 个 unit tests 通过，治理提醒为暂无。

### 2026-05-05 23:41 CST 通用室内房间模板 v1

- 用户确认希望室内场景编辑器未来可开放给玩家做室内编辑和装修，先从瓦片编辑不再绑定 `birth_house` 开始抽象。
- 新增 `packages/visual/src/content/IndoorRoomTemplates.ts`：
  - 定义 `IndoorRoomTemplate`、`IndoorEditableTileRegion`、`IndoorFixedRoomDef` 等模板类型。
  - `birth_house` 保留原固定房间配置，地板可编辑区为 `col/row 3..22`。
  - `token_center` 新增地板可编辑区 `col/row 4..36`，先开放 floor 单点刷，避免覆盖墙体边缘。
- `packages/visual/src/systems/MapRenderer.ts`：
  - 固定房间渲染配置改为从 `getIndoorRoomTemplate(...).fixedRoom` 读取。
  - 瓦片编辑可用性、地板笔刷候选、调试网格和点击命中改为读取 `editableLayers.floor`，不再只看出生小屋的 `fixedRoom.floorTiles`。
- `packages/visual/src/systems/map/IndoorLayerRenderer.ts`：普通室内 tilemap 也会应用 `floor tile overrides`，使 Token 中心这类非 fixed room 场景能进入瓦片编辑链路。
- `packages/visual/src/content/IndoorFurnitureLayout.ts`：室内 local/map 坐标原点改为从房间模板读取，避免继续维护分散的 `INDOOR_LOCAL_ORIGINS`。
- 新增 `packages/visual/docs/indoor_room_template_editor.md`，记录 RoomTemplate / RoomInstance 的目标抽象、当前边界和后续路线；文档内更新时间为 `2026-05-05 23:41:17 CST`。
- 新增 `packages/visual/tests/unit/indoor_room_templates.test.ts`，覆盖出生小屋模板、Token 中心 floor 可编辑区和模板 localOrigin 坐标换算。

### 2026-05-06 00:17 CST 室内素材目录与 AssetCatalog 统一

- 用户要求统一室内编辑器素材并规范目录，方便后续注册添加、玩家装修和资产等级扩展。
- 运行时可编辑室内素材迁移到 `packages/visual/public/assets/indoor/`：
  - `furniture/observer-house/`：观察者小屋床、书架、木箱、灯笼、屏风、茶桌。
  - `furniture/token-center/`：Token 中心掌门像。
  - `characters/`：大师兄、归海一刀、师叔、孙大娘、和尚。
  - `wall-decor/token-center/`：门派背景、左侧贴图。
  - `tiles/floor/token-center/`：Token 中心地板。
  - `tiles/rug/`：地毯 0306-0313 / 0330。
- `packages/visual/src/content/AssetCatalog.ts` 扩展为室内编辑器素材注册主入口：
  - 注册 `indoor.furniture / indoor.character / indoor.wallDecor / indoor.floorTile / indoor.rugTile`。
  - 保留 `economy` 字段用于未来 default/owned/market/reward、价格和稀有度。
  - 新增 `getAssetByTextureKey`、`getIndoorTileBrushAssets` 等查询能力。
- `packages/visual/src/scenes/BootScene.ts` 改为遍历 `ASSET_CATALOG` 预加载室内编辑素材，不再硬编码出生小屋家具、Token 中心装饰、地砖和地毯。
- `packages/visual/src/content/IndoorAssetLibrary.ts` 作为对象素材兼容层，现支持 `furniture / character / wallDecor`。
- `packages/visual/src/content/IndoorRoomTemplates.ts` 的 `editableLayers.floor` 支持 `brushAssetIds`，Token 中心 floor brush 改为引用注册资产。
- `packages/visual/src/ui/BuildModeOverlay.ts` 瓦片笔刷支持从 catalog 读取正确缩略图路径，避免 `smap_9309` 这类自定义瓦片误指向 `jy-runtime/10_smap`。
- 新增 `packages/visual/docs/indoor_asset_registry.md`，记录目录规范、注册规范和当前边界；更新时间为 `2026-05-06 00:17:51 CST`。

### 2026-05-06 00:43 CST 室内编辑撤销与碰撞交互

- 室内 `F2` 建造模式新增快照式撤销/重做：
  - `Cmd/Ctrl+Z` 撤销。
  - `Cmd/Ctrl+Shift+Z` 或 `Cmd/Ctrl+Y` 重做。
  - 底部状态条也提供“撤销 / 重做”按钮。
- 撤销快照覆盖家具/墙贴、人物、交互区、地板 override、当前选中对象和遮挡 Mask 编辑状态；先保障单机编辑安全网，后续多人装修再升级为 command 系统。
- 右侧 inspector 将“碰撞框”文案明确为“实体碰撞框”，和顶部“遮挡Mask”分离。
- 碰撞框支持未启用时直接输入坐标并自动创建，新增“重置 1x1”和“清除碰撞”按钮。
- `packages/visual/docs/indoor_asset_library_editor.md` 已补充建造模式 UI v6，更新时间为 `2026-05-06 00:43:23 CST`。
