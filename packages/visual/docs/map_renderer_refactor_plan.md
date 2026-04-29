# MapRenderer 拆分计划

`MapRenderer.ts` 当前同时负责世界地图渲染、室内渲染、室内家具、遮挡 mask、家具编辑器、交互区域编辑器和 localStorage 持久化，已经超过 2100 行。后续室内场景继续扩展前，应按本文拆分。

## 当前职责盘点

| 区间 | 职责 | 建议归属 |
| --- | --- | --- |
| 世界地图缓存 | `renderBuffer`、`blitToScreen`、tile 绘制 | `WorldMapRenderer` |
| 室内生命周期 | `switchToIndoor`、`switchToWorld`、资产加载 | `IndoorSceneRenderer` |
| 室内地板/墙 | floor canvas、wall sprites、roof visibility | `IndoorLayerRenderer` |
| 室内家具 | furniture sprites、depth、collider visual | `IndoorFurnitureRenderer` |
| 遮挡 mask | occluder texture、mask 点、遮挡 sprite | `FurnitureOccluderRenderer` |
| 家具编辑器 | 鼠标拖点、说明、保存恢复 | `FurnitureEditor` |
| 交互区域编辑器 | 青色区域拖拽、保存恢复 | `InteractableEditor` |
| 坐标换算 | indoor map/screen/local 转换 | `IndoorCoordinateMapper` |

## 目标结构

建议最终形成：

```text
src/systems/map/
  MapRenderer.ts                  # 门面，保留现有公开 API
  WorldMapRenderer.ts             # 大地图 canvas 缓存与绘制
  IndoorSceneRenderer.ts          # 室内切换、容器、资产生命周期
  IndoorLayerRenderer.ts          # 地板、墙、屋顶、固定房间图层
  IndoorFurnitureRenderer.ts      # 家具 sprite、depth、碰撞可视化
  FurnitureOccluderRenderer.ts    # mask texture 和遮挡层
  FurnitureEditor.ts              # 家具编辑器交互与 help 文案
  InteractableEditor.ts           # 可交互区域编辑
  IndoorCoordinateMapper.ts       # 坐标换算纯工具
```

## 分阶段迁移

### 阶段 1：抽坐标换算与纯工具（已完成）

优先迁移：

- `indoorMapToScreen`
- `indoorMapToScreenWithContainer`
- `screenToIndoorMap`
- `screenToIndoorLocal`
- `roundEditorValue`
- `normalizeFurnitureCollider`
- `normalizeInteractableZone`
- `strokeIndoorDiamond`
- `strokeIndoorRectBounds`

状态：2026-04-29 已新增 `src/systems/map/IndoorCoordinateMapper.ts`，`MapRenderer.ts` 通过该模块处理室内 map/screen/local 坐标、编辑器数值取整、矩形归一化和调试几何描边。

验收：`npm run check` 已通过；编辑器拖点位置应保持不变，仍需手动回归 F2 家具编辑器。

### 阶段 2：抽世界地图渲染（已开始）

迁移：

- `shouldRerender`
- `renderBuffer`
- `blitToScreen`
- `drawWorldTile`

状态：2026-04-29 已新增 `src/systems/map/WorldMapCanvasRenderer.ts`，迁移世界地图双缓冲 canvas、`shouldRerender`、`renderBuffer`、`blitToScreen` 和世界地图 tiles atlas 绘制。`MapRenderer.ts` 保留同名公开 API 作为门面，避免影响 `WorldScene` 和 `SceneManager`。

暂不迁移：

- `drawSmapTileOnCtx`
- `drawFixedTextureOnCtx`

这两项已随阶段 3 迁移到 `IndoorLayerRenderer`。

验收：`npm run check` 已通过；大地图移动、建筑贴图、清晰度仍需手动回归。

### 阶段 3：抽室内图层渲染（已完成）

迁移：

- `renderIndoorFloor`
- `renderFixedRoomFloorTiles`
- `createWallSprites`
- `createFixedRoomWallSprites`
- `updateRoofVisibility`
- `destroyWallSprites`
- `drawSmapTileOnCtx`
- `drawFixedTextureOnCtx`

状态：2026-04-29 已新增 `src/systems/map/IndoorLayerRenderer.ts`，迁移室内地板 canvas、固定房间地板、普通室内墙/屋顶、固定房间围墙、屋顶透明度和图层清理。`MapRenderer.ts` 保留 `updateIndoorCamera` 和 `updateRoofVisibility` 公开入口，内部委托给室内图层模块。

验收：`npm run check` 已通过；观察者小屋地板、墙、屋顶遮挡仍需手动回归。

### 阶段 4：抽家具与遮挡（已开始）

迁移：

- 家具 sprite 创建和 depth 更新。
- `updateFurnitureOccluderSprite`
- `createFurnitureOccluderTexture`
- `syncFurnitureOccluderSprite`
- `destroyFurnitureOccluder`

状态：2026-04-29 已新增 `src/systems/map/FurnitureOccluderRenderer.ts`，迁移局部 mask 纹理创建、遮挡 sprite 同步、深度计算、单个/全部遮挡层销毁。`MapRenderer.ts` 目前仍负责家具 base sprite 创建、位置更新和调试点绘制。

验收：`npm run check` 已通过；床、书架、宝箱、茶几遮挡表现仍需手动回归。

### 阶段 5：抽编辑器

迁移：

- `onFurnitureEditorPointerDown/Move/Up`
- `findFurnitureEditorHandle`
- `findInteractableEditorHandle`
- localStorage 保存恢复
- helpText/guideText

状态：2026-04-29 已新增 `src/systems/map/IndoorEditorPersistence.ts`，先迁移家具编辑器和交互区域编辑器的 localStorage key、快照创建/应用、保存/读取。鼠标拖拽、help 文案和实时视觉更新仍留在 `MapRenderer.ts`。

验收：`F2` 家具编辑器、`M` mask、青色交互区域编辑都保持可用。

## 兼容策略

- 第一轮拆分时保留 `MapRenderer` 公开 API，避免影响 `WorldScene` 和 `SceneManager`。
- 新模块可以先作为 `MapRenderer` 内部组合对象，不急着改变外部调用方式。
- 每一阶段只迁移一类职责，避免同时改视觉效果。

## 回归清单

每完成一个阶段，至少验证：

1. 大地图移动流畅，建筑不漂浮、不晃动、不发糊。
2. 进入观察者小屋后，大地图 UI 隐藏。
3. 室内地板、墙、屋顶遮挡正常。
4. 家具碰撞、遮挡、局部 mask 正常。
5. `F2` 编辑器可开关，正常模式不显示点位。
6. 书架秘籍、床休息交互区域正常。
