# DeepSolo 项目治理规范

本文定义 DeepSolo 后续迭代的轻量治理方式。目标不是增加流程负担，而是让游戏功能、编辑器、资源、文档和构建结果都能稳定延续。

## 当前项目定位

DeepSolo 当前包含两条主线：

- 策略涌现产品主线：Agent、策略、讨论、衍生、故事和玩家成长。
- 像素 RPG 可视化主线：大地图、室内场景、战斗系统、交互编辑器和资源管线。

现阶段以 `packages/visual` 为主要高频迭代区，优先保证：

1. 正常玩家模式干净，不暴露后台坐标或编辑数据。
2. 编辑模式所见即所得，允许快速调入口、碰撞、家具、遮挡和交互区域。
3. 编辑数据最终可固化为代码配置，不能长期只停留在浏览器 localStorage。
4. 每次重要功能完成后更新对应文档。

## 质量门禁

每次提交或交付前至少执行：

```bash
cd packages/visual
npm run check
npm run audit:governance
```

门禁含义：

- `npm run check`：TypeScript 类型检查 + 单元测试 + Vite 生产构建。
- `npm run audit:governance`：项目治理巡检，输出大文件、调试输出、localStorage、文档缺口等风险提示。

如果只是在快速调参，可以先跑：

```bash
cd packages/visual
npm run typecheck
npm run test:unit
```

## 变更分类

| 类型 | 示例 | 必须同步 |
| --- | --- | --- |
| 游戏体验 | 战斗流程、玩家属性、交互反馈 | 对应功能文档 + 构建验证 |
| 编辑器能力 | 家具编辑、大地图入口/碰撞、多边形点位 | 编辑器说明文档 + 操作提示 |
| 资源变更 | 建筑贴图、战斗帧、行走帧、室内贴图 | 资源映射文档 + 来源说明 |
| 数据结构 | `BuildingDef`、玩家进度、秘籍、物品 | 类型说明 + 存储迁移说明 |
| 架构治理 | 拆模块、脚本、规范 | 本治理文档 + 技术债清单 |

## 编辑器数据生命周期

编辑器允许使用 localStorage 做临时调参，但不能作为最终交付形态。

推荐生命周期：

1. 编辑模式内 WYSIWYG 调整。
2. localStorage 暂存，刷新页面可继续调。
3. 阶段完成后导出/抄录到代码配置。
4. 文档记录关键点位和调参方法。
5. 清理旧的本地保存，验证代码默认配置可复现效果。

当前需要逐步补齐“导出/固化”能力的模块：

- 室内家具布局与遮挡 mask。
- 室内交互区域。
- 大地图建筑 `visualX/visualY`、入口和 `collisionPolygon`。

## 文档规则

- 设计类文档放在根目录 `docs/`。
- 视觉包专属调参文档放在 `packages/visual/docs/`。
- 功能完成后，至少更新一份对应文档。
- `codex.md` 记录连续迭代的关键结论、参数、用户偏好和验证结果。
- 文档不要只写“做了什么”，还要写“后续怎么调”。

## 代码治理规则

- 正常模式不显示编辑器、坐标、碰撞点、mask 点等后台信息。
- 编辑器 UI 尽量内嵌在游戏场景内，风格参考观察者小屋编辑器。
- 单文件超过 1500 行必须进入技术债清单；超过 2200 行应优先拆分，具体规则见 `docs/large_file_governance.md`。
- 新系统优先拆成：数据配置、运行时逻辑、渲染/编辑器、文档四部分。
- 不新增网络依赖和重型工具，除非明确需要。
- 资源贴图不要大比例依赖浏览器缩放，优先生成 runtime 尺寸。

## 大文件治理入口

当前大文件治理已拆成三份文档：

- `docs/large_file_governance.md`：全项目大文件判定标准、拆分原则和交付要求。
- `packages/visual/docs/battle_system_refactor_plan.md`：`BattleSystem.ts` 拆分路线。
- `packages/visual/docs/map_renderer_refactor_plan.md`：`MapRenderer.ts` 拆分路线。

后续如果新增文件超过 1500 行，需要同步登记到 `docs/technical_debt_register.md` 并补拆分计划。

## 发布/回归检查清单

每次准备给用户看效果前：

1. 确认没有多余 Vite dev server。
2. `npm run check` 通过。
3. 正常玩家模式不显示调试坐标。
4. 编辑模式入口明确，退出后 overlay 全部隐藏。
5. 关键流程手动走一遍：大地图、进出建筑、室内交互、战斗、玩家面板。
6. 更新相关文档和 `codex.md`。
