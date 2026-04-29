# 技术债清单

本文记录当前已知风险、影响和建议处理顺序。优先级含义：P0 影响主流程，P1 影响体验或后续迭代，P2 是治理/维护问题。

## P0

目前无构建阻塞问题。`packages/visual` 在 2026-04-29 可通过：

```bash
npm run build
```

## P1

### 编辑器数据还没有统一导出/固化流程

- 位置：室内家具编辑器、大地图编辑器。
- 问题：调参结果主要依赖 localStorage，换浏览器或部署后不可复现。
- 建议：新增“复制当前配置 JSON”或开发态导出文件流程，并在文档中要求固化。

## 已处理

### 大地图多边形顶点新增命中不够严格

- 处理日期：2026-04-29
- 位置：`packages/visual/src/systems/WorldMapEditor.ts`
- 结果：`Shift+点击` 只有距离碰撞多边形边 18px 内才会新增顶点；没有多边形时会先恢复默认多边形，避免误点导致轮廓跳变。

### 正常模式 debug 坐标暴露

- 处理日期：2026-04-29
- 位置：`packages/visual/src/scenes/WorldScene.ts`、`packages/visual/src/systems/MapRenderer.ts`
- 结果：`#debug-info` 只在大地图编辑器或室内家具编辑器开启时显示；普通玩家模式清空并隐藏。

### 室内 debug 出口距离取错建筑

- 处理日期：2026-04-29
- 位置：`packages/visual/src/scenes/WorldScene.ts`
- 结果：出口距离改为读取 `sceneManager.getCurrentBuildingId()` 对应建筑，不再使用 `BUILDINGS.find(b => true)`。

### 调试日志未统一开关

- 处理日期：2026-04-29
- 位置：`packages/visual/src/utils/DebugLogger.ts`、`packages/visual/src/services/ChatService.ts`、`packages/visual/src/systems/MapRenderer.ts`
- 结果：新增 `DebugLogger`，WebSocket 连接类调试输出默认关闭，仅在 `localStorage.setItem('deepsolo:debugLogs', '1')` 后输出；家具导出使用 `console.info` 作为用户主动操作反馈，不再触发 `console.log` 治理告警。

### debug-info 样式被误判为分散引用

- 处理日期：2026-04-29
- 位置：`scripts/visual_governance_audit.mjs`
- 结果：治理审计将 `UIManager.ts`、`WorldScene.ts` 和 `styles.css` 视为 `#debug-info` 的合法归属，不再把样式文件误报为分散引用。

### `types.ts` 万能类型桶

- 处理日期：2026-04-29
- 位置：`packages/visual/src/types.ts`、`packages/visual/src/types/*`
- 结果：`types.ts` 从约 638 行拆为兼容 barrel，领域类型拆入 `common.ts`、`strategy.ts`、`discussion.ts`、`world.ts`、`player.ts`、`dialogue.ts`、`token.ts`、`conversation.ts`、`battle.ts`、`story.ts`、`events.ts`。现有 `../types` 导入保持兼容。

## P2

### 大文件需要拆分

当前超过 1500 行的文件：

目前无。`BattleSystem.ts` 和 `MapRenderer.ts` 均已降至 1500 行以内。

治理状态：已建立大文件治理规范 `docs/large_file_governance.md`，并为原大文件补充专项拆分计划。`BattleSystem.ts` 已通过阶段 1-3 拆分降至 1500 行以内；`MapRenderer.ts` 已抽出 `IndoorCoordinateMapper.ts`、`WorldMapCanvasRenderer.ts`、`IndoorLayerRenderer.ts`、`FurnitureOccluderRenderer.ts`、`IndoorEditorPersistence.ts`，当前约 1280 行。

建议拆分方向：

- `BattleSystem.ts`：后续可继续拆动画调度，但不再属于大文件告警。
- `MapRenderer.ts`：后续可继续拆家具 base sprite、家具编辑器和交互区域编辑器，但不再属于大文件告警。

### 自动化测试底座缺失

- 处理日期：2026-04-29
- 位置：`packages/visual/package.json`、`packages/visual/tests/unit/`、`scripts/run_visual_unit_tests.mjs`
- 结果：新增 `test:unit`，当前覆盖 `BattleRules`、`IndoorCoordinateMapper`、`IndoorEditorPersistence` 共 17 个用例；`npm run check` 已串联 `typecheck`、`test:unit` 和 `build`。
