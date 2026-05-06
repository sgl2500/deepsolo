# 通用室内房间模板与编辑器抽象

更新时间：2026-05-06 00:43:23 CST

## 目标

室内编辑器不能继续把瓦片能力写死在 `birth_house`。后续玩家住宅、官方室内场景和多人访问都应共用同一套抽象：

- `IndoorRoomTemplate`：开发者定义的房间模板，描述地图、局部坐标原点、可编辑瓦片区域和固定房间渲染配置。
- `IndoorRoomInstance`：未来玩家或编辑器保存的房间实例，描述对象、地板覆盖、交互区、碰撞和发布状态。

本次先落地模板层，不重写现有编辑器核心，保证出生小屋和 Token 中心现有渲染路径可继续运行。

## 本次已落地

新增模板入口：

```txt
packages/visual/src/content/IndoorRoomTemplates.ts
```

当前模板：

- `birth_house`：保留原固定房间配置，地板可编辑区域为 `col/row 3..22`。
- `token_center`：新增地板可编辑区域，内部地板为 `col/row 4..36`，避免直接覆盖墙体边缘。

`MapRenderer` 现在通过模板读取：

- 固定房间渲染配置：`template.fixedRoom`。
- 地板瓦片编辑区域：`template.editableLayers.floor`。
- 地板笔刷候选：模板配置的 `textureKeys` 加地图里已有 floor/surface 瓦片。
- 地板笔刷注册：模板优先使用 `brushAssetIds` 引用 `AssetCatalog` 里的瓦片素材。

普通室内 tilemap 现在也能应用 `floor tile overrides`，不再只服务固定房间地板。

## 当前边界

这一步仍然是“模板抽象 v1”，不是完整玩家装修系统：

- 只开放 `floor` 层的单点刷和橡皮。
- `wall`、`rug`、矩形刷、拖刷、吸管、自动拼边还未接入。
- 统一 `EditableSceneSnapshot` 仍是导出/草稿格式，尚未成为唯一运行时数据源。
- 玩家权限、资产拥有、服务端保存、发布访问还未实现。

## 后续建议

配套素材注册规范见：

```txt
packages/visual/docs/indoor_asset_registry.md
```

下一步应继续把室内编辑器从“开发调参工具”推进到“可开放给玩家的装修系统”：

1. 定义 `IndoorRoomInstance`，把对象、瓦片覆盖、交互区和碰撞都收进同一份实例数据。
2. 新增 `IndoorSceneAdapter`，负责模板/实例和当前运行时家具、人物、交互区、瓦片数据之间的转换。
3. 玩家装修模式只开放对象、墙贴、地毯和白名单地板替换；开发者模式才开放墙体、出口、出生点和核心碰撞。
4. `LocalSceneRepository` 先保存统一实例，旧 localStorage key 只做兼容迁移。
