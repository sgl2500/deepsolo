# 室内编辑器素材注册与目录规范

更新时间：2026-05-06 00:17:51 CST

## 目标

室内编辑器后续要支持玩家装修、资产等级、市场/奖励解锁和服务端校验，所以素材不能继续散落在 `rooms/`、`renwu/`、`maps/qiangti/`、`maps/dizhuan/`、`maps/ditan/` 这些历史目录里。

本轮先统一两件事：

1. 运行时可编辑素材统一放入 `public/assets/indoor/`。
2. 所有可编辑素材统一注册到 `packages/visual/src/content/AssetCatalog.ts`。

## 目录规范

```text
packages/visual/public/assets/indoor/
  furniture/
    observer-house/
    token-center/
  characters/
  wall-decor/
    token-center/
  tiles/
    floor/
      token-center/
    rug/
```

当前已迁移：

- 观察者小屋家具：床、书架、木箱、灯笼、屏风、茶桌。
- Token 中心装饰：掌门像。
- 室内人物：大师兄、归海一刀、师叔、孙大娘、和尚。
- 墙贴：门派背景、左侧贴图。
- 地板/地毯瓦片：Token 中心地板、地毯 0306-0313 / 0330。

`jy-runtime/10_smap/` 暂时保留为 JYQXZ 传统瓦片运行时子集；它属于 legacy tile provider，不在这轮物理迁移里。

## 注册规范

新增可编辑素材时，先把最终运行时 PNG 放到 `public/assets/indoor/` 对应分类，再注册到：

```txt
packages/visual/src/content/AssetCatalog.ts
```

对象素材至少包含：

- `id`：稳定资产 ID，未来服务端/数据库也用这个。
- `category`：例如 `indoor.furniture`、`indoor.character`、`indoor.wallDecor`。
- `kind`：落到场景对象类型，例如 `indoorFurniture`、`indoorCharacter`、`wallDecor`。
- `textureKey`：Phaser 纹理 key。
- `src`：运行时图片路径。
- `defaultLayer`：默认图层。
- `tags`：用于房间模板过滤、搜索和后续权限。
- `economy`：未来用于 `default / owned / market / reward`、价格和稀有度。

瓦片素材使用：

- `category: 'indoor.floorTile'` 或 `category: 'indoor.rugTile'`。
- `kind: 'floorDecor'`。
- `defaultLayer: 'floor'` 或 `defaultLayer: 'rug'`。

房间模板优先通过 `brushAssetIds` 引用瓦片素材，避免继续把图片路径散落到模板或渲染器里。

## 当前边界

- `AssetCatalog` 已成为对象素材、瓦片笔刷和预加载的统一入口。
- `BootScene` 会遍历 `ASSET_CATALOG` 预加载注册素材。
- `IndoorAssetLibrary` 仍是兼容层，给现有建造 UI 提供人物/家具/墙贴对象素材。
- `IndoorRoomTemplates` 已可用 `brushAssetIds` 配置地板笔刷。
- 资产等级、拥有关系、市场购买和服务端校验还只是 schema 预留，尚未接运行时。
