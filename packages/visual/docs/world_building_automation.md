# 大地图建筑与室内装修自动化

更新时间：2026-05-06 09:53:23 CST

## 目标

新增一座可进入的大地图建筑，不应该再手工同时改 `BuildingData`、`SceneData`、`BuildingMarkers`、`BootScene`、`IndoorRoomTemplates` 和室内家具配置。现在新增建筑走一份生成注册表：

```txt
packages/visual/src/content/generated_buildings.json
```

运行时会自动把这份注册表接入：

- 大地图建筑入口：`src/data/BuildingData.ts`
- 场景坐标索引：`src/data/SceneData.ts`
- 大地图建筑贴图：`src/systems/BuildingMarkers.ts`
- 世界建筑资源预加载：`src/scenes/BootScene.ts`
- 室内房间模板和地板编辑区：`src/content/IndoorRoomTemplates.ts`
- 室内默认家具/墙贴：`src/content/IndoorFurnitureLayout.ts`

## 游戏内放置

大地图按 `F3` 进入编辑模式后，右上角策略排行和小地图会自动隐藏，避免挡住建筑编辑工具。右上会出现“新增建筑”面板：

- `宅邸`：玩家住宅外观，带默认家具。
- `商铺`：交易所外观，带默认家具。
- `展馆`：Token 中心外观，空房间。
- `取消放置`
- `删除选中建筑`：只删除玩家新增/自动注册建筑，不会删除出生小屋等固定建筑。

操作流程：

1. 按 `F3` 打开大地图编辑模式。
2. 在右上“新增建筑”面板里选择建筑类型。
3. 移动鼠标查看半透明建筑预览、入口落点和坐标。
4. 在大地图上点击目标位置。
5. 如果选错了，按 `Esc`、右键地图或 `Alt+点击` 取消当前待放置建筑。
6. 编辑器会立即新增建筑，并自动生成入口、碰撞多边形、室内模板和默认装饰。
7. 玩家走到绿色入口进入室内后，按 `F2` 继续装修室内。
8. 按 `Cmd/Ctrl+S` 可以把当前建筑布局和新增建筑注册保存到源码 JSON。

删除流程：

1. 按 `F3` 打开大地图编辑模式。
2. 点击要删除的新增建筑，让它成为当前选中建筑。
3. 点右上“删除选中建筑”，或按 `Shift+Delete`。
4. 删除只会先写入浏览器本地状态；按 `Cmd/Ctrl+S` 后才会同步删除源码里的 `generated_buildings.json` 注册。

游戏内放置新增的建筑会先写入浏览器 localStorage，刷新后仍会存在。保存到源码时会同步写入：

```txt
packages/visual/src/content/generated_buildings.json
packages/visual/src/data/world_layout_override.json
packages/visual/src/content/generated_indoor_layouts.json
```

进入室内 `F2` 装修后，顶部工具栏也有 `保存到源码`。它会把当前室内的家具、人物、交互区、碰撞、遮挡 Mask 和地板瓦片 override 保存到 `generated_indoor_layouts.json`，并保留一份统一 `EditableSceneSnapshot`，方便后续迁移到服务端/数据库。

当前游戏内放置复用已预加载的室内地图模板，例如 `indoor_news` 或 `indoor_token_center`。不同建筑会使用不同 `buildingId` 保存室内装修草稿，所以即使共用底图，家具、地板和碰撞编辑结果也互不影响。

## 自动化命令

新增建筑使用脚本：

```bash
node scripts/register_indoor_building.mjs --id player_shop --name 玩家商铺 --x 64 --y 88
```

脚本会做两件事：

1. 写入或更新 `generated_buildings.json`。
2. 从已有室内地图复制一份新地图到：

```txt
packages/visual/public/assets/maps/indoor/indoor_<id>.json
```

默认会复制 `indoor_news.json` 作为室内底图，并放入一套 starter decor：茶桌、书架、木箱。进入房间后按 `F2` 可以继续用室内建造模式调整家具、碰撞、遮挡和地板。

常用参数：

```bash
node scripts/register_indoor_building.mjs \
  --id player_gallery \
  --name 玩家展馆 \
  --x 66 \
  --y 88 \
  --source-map indoor_news \
  --visual-key world_building_a_share \
  --floor-brushes tile_floor_token_center_0514,tile_rug_0309,tile_rug_0313
```

如果要使用新的大地图建筑图片，把 PNG 放到：

```txt
packages/visual/public/assets/world/buildings/
```

然后加：

```bash
--visual-key world_building_player_gallery --visual-file player_gallery.png
```

## 当前已注册示例

本轮新增了一个示例建筑：

```txt
id: player_manor
name: 玩家宅邸
world: (60, 88)
indoorMapKey: indoor_player_manor
```

它复用现有 `world_building_a_share` 大地图建筑贴图，室内地图复制自 `indoor_news`，默认开放 `col/row 4..34` 的地板装修区域。

## 后续路线

这版是自动化注册，不是最终玩家住宅系统。下一步建议：

1. 把 `generated_buildings.json` 从开发脚本生成，升级为游戏内“新增建筑”面板写入。
2. 室内保存从 localStorage 草稿迁移到统一 `SceneRepository` / 服务端实例。
3. 新增建筑权限、建筑皮肤拥有关系、家具拥有关系和发布状态。
4. 将 starter decor 变成可选模板，例如 `empty`、`tea_room`、`shop`、`gallery`。
