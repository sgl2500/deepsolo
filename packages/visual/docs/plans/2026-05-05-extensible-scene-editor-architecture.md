# 可扩展场景编辑器架构实施计划

> **For Codex:** 按小步迁移执行，不一次性重写 `MapRenderer` / `WorldMapEditor`，每一步都必须保持现有玩法可运行。

**Goal:** 把当前室内编辑器和大地图编辑器演进为未来玩家买地建房、布置住宅、多人在线访问可复用的场景编辑架构。

**Architecture:** 采用方案 B：先建立通用 schema、Asset Catalog 和适配器边界，再逐步把室内/大地图编辑逻辑迁移到统一 Editor Core。当前阶段只落地架构地基，不改变玩家现有操作路径。

**Tech Stack:** TypeScript、Phaser、Vite、localStorage 草稿保存；未来可接服务端 JSON/API 持久化。

---

## 阶段 1：架构地基（当前执行）

### Task 1: 新增通用编辑 schema

**Files:**
- Create: `packages/visual/src/editor/schema/SceneSchema.ts`
- Create: `packages/visual/src/editor/schema/AssetSchema.ts`
- Create: `packages/visual/src/editor/schema/PermissionSchema.ts`

**目标:** 定义未来所有场景编辑都能共用的数据语言：场景类型、对象类型、图层、位置、变换、碰撞、交互、权限。

**验收:**
- 不接入运行时也不破坏现有逻辑。
- `npm run typecheck` 通过。

### Task 2: 新增全局 Asset Catalog

**Files:**
- Create: `packages/visual/src/content/AssetCatalog.ts`
- Modify: `packages/visual/src/content/IndoorAssetLibrary.ts`

**目标:** 把当前 `IndoorAssetLibrary` 提升为全项目素材目录的兼容子集。室内编辑器继续读 `INDOOR_ASSET_LIBRARY`，但数据源来自通用 catalog。

**验收:**
- `BootScene` 仍能遍历 `INDOOR_ASSET_LIBRARY` 预加载。
- `MapRenderer` 素材库面板仍显示当前 6 个素材。
- 新增同类素材时，优先加到 `AssetCatalog.ts`。

### Task 3: 文档说明未来迁移路线

**Files:**
- Modify: `packages/visual/docs/indoor_asset_library_editor.md`
- Create: `packages/visual/docs/plans/2026-05-05-extensible-scene-editor-architecture.md`

**目标:** 让后续实现者清楚：现在是兼容层，未来要迁移到统一 scene state。

**验收:**
- 文档说明本地草稿、未来服务端保存、玩家住宅三层实体。

---

## 阶段 2：统一室内 Scene State

### Task 4: 引入 IndoorSceneAdapter

**Files:**
- Create: `packages/visual/src/editor/adapters/IndoorSceneAdapter.ts`
- Modify: `packages/visual/src/systems/MapRenderer.ts`

**目标:** 把室内坐标转换、对象查询、图层规则、depth 规则放进 adapter。先只包一层，不改变渲染结果。

**验收:**
- 室内家具、人物、墙贴位置和遮挡与迁移前一致。
- `F2` 编辑、拖动、删除、复制、保存都保持可用。

### Task 5: 导出统一室内场景 JSON

**Files:**
- Create: `packages/visual/src/editor/core/SceneSerializer.ts`
- Modify: `packages/visual/src/systems/MapRenderer.ts`
- Modify: `packages/visual/src/scenes/WorldScene.ts`

**目标:** 支持导出完整 `EditableSceneSnapshot`，包含家具、人物、墙贴、交互点。短期用于固化配置，未来可直接发服务端。

**验收:**
- 新快捷键或按钮可导出当前室内完整 scene JSON。
- JSON 不再分散为 furniture/character/interactable 三份。

---

## 阶段 3：Editor Core

### Task 6: 抽 Selection / Command / History

**Files:**
- Create: `packages/visual/src/editor/core/EditorCommand.ts`
- Create: `packages/visual/src/editor/core/SelectionManager.ts`
- Create: `packages/visual/src/editor/core/EditorHistory.ts`

**目标:** 统一选中、移动、删除、复制、撤销/重做。多人在线阶段可把 command 发给服务端校验和广播。

**验收:**
- 室内编辑器可以用 command 完成新增、移动、删除。
- 至少支持本地 undo/redo 的数据结构。

### Task 7: 接入 WorldSceneAdapter

**Files:**
- Create: `packages/visual/src/editor/adapters/WorldSceneAdapter.ts`
- Modify: `packages/visual/src/systems/WorldMapEditor.ts`

**目标:** 大地图编辑器复用素材库、选中、删除、复制、保存模式；特殊规则留在 world adapter。

**验收:**
- 原有建筑入口、碰撞编辑能力不丢。
- 大地图未来可以放置玩家房屋/地块装饰。

---

## 阶段 4：玩家住宅与多人在线预留

### Task 8: 定义玩家地块/房屋模型

**Files:**
- Create: `packages/visual/src/editor/schema/HousingSchema.ts`

**核心实体:**
- `LandPlot`: 大地图地块、价格、归属、可建类型。
- `PlayerHouse`: 房屋外观、owner、地块、室内 scene。
- `IndoorScene`: 房屋内部 objects/colliders/portals。

**验收:**
- 模型支持 owner、permissions、publishedVersion。
- 不依赖本地源码布局，未来可由服务端返回。

### Task 9: 服务端保存协议草案

**Files:**
- Create: `packages/visual/docs/scene_editor_server_protocol.md`

**目标:** 定义未来多人在线保存方式：客户端发 command 或 scene snapshot，服务端校验资产权限、地块边界、对象数量、碰撞合法性。

**验收:**
- 文档列出新增/移动/删除/发布四类 API 草案。

---

## 当前执行边界

本轮只做阶段 1：schema + Asset Catalog + 兼容文档。不要在本轮重写 `MapRenderer` 和 `WorldMapEditor`，避免把正在可用的编辑功能改坏。

---

## 2026-05-05 23:41 CST 补充：通用室内 RoomTemplate v1

用户确认希望室内场景编辑器未来可以开放给玩家做室内编辑和装修。为避免瓦片编辑继续只绑定 `birth_house`，本轮追加了一个低风险抽象层：

- 新增 `packages/visual/src/content/IndoorRoomTemplates.ts`。
- `birth_house` 的原固定房间配置从 `MapRenderer.ts` 移入 `IndoorRoomTemplate.fixedRoom`。
- `token_center` 新增 `editableLayers.floor`，先开放内部地板单点刷。
- `MapRenderer.ts` 的瓦片编辑可用性、笔刷候选、点击命中和调试网格改为读取 `IndoorRoomTemplate.editableLayers.floor`。
- `IndoorLayerRenderer.ts` 对普通室内 tilemap 也应用 `floor tile overrides`，让非 fixed room 的室内也能进入瓦片覆盖链路。
- `IndoorFurnitureLayout.ts` 的 local/map 原点改为从模板读取。

详细说明见：

```txt
packages/visual/docs/indoor_room_template_editor.md
```

这个补充仍然保持小步迁移原则：先建立模板边界，不把现有编辑器一次性重写为玩家装修系统。下一阶段再引入 `IndoorRoomInstance` 和 `IndoorSceneAdapter`。

---

## 2026-05-06 00:17 CST 补充：室内素材目录与 AssetCatalog 统一

为后续玩家装修、资产等级和注册扩展做准备，本轮把可编辑室内素材统一到 `public/assets/indoor/`，并让 `AssetCatalog.ts` 成为注册主入口：

- 物理目录新增/迁移到：
  - `indoor/furniture/observer-house/`
  - `indoor/furniture/token-center/`
  - `indoor/characters/`
  - `indoor/wall-decor/token-center/`
  - `indoor/tiles/floor/token-center/`
  - `indoor/tiles/rug/`
- `AssetCatalog.ts` 现在注册家具、人物、墙贴、地板瓦片和地毯瓦片。
- `BootScene` 改为遍历 `ASSET_CATALOG` 预加载室内编辑器素材，不再分别硬编码出生小屋家具、Token 中心装饰、地砖和地毯。
- `IndoorAssetLibrary` 扩展为对象素材兼容层，支持 `furniture / character / wallDecor`。
- `IndoorRoomTemplate.editableLayers.floor` 支持 `brushAssetIds`，Token 中心地板笔刷改为引用注册资产。

详细说明见：

```txt
packages/visual/docs/indoor_asset_registry.md
```
