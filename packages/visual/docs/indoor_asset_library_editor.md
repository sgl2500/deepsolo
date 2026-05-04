# 室内素材库编辑器说明

## 目标

室内编辑模式不再只编辑源码里已有的贴图实例，而是提供一个可复用素材库。编辑者可以在任意室内场景中从素材库放置人物或墙面贴图，再继续拖动位置、depth 和碰撞框。

第一版支持两种放置方式：

- 点击素材，再点击场景放置。
- 从素材库按住素材拖到场景，松手放置。

## 素材库配置

素材库定义在：

```ts
packages/visual/src/content/IndoorAssetLibrary.ts
```

当前支持两类素材：

- `character`：人物贴图，放置后进入人物编辑系统，带默认碰撞框。
- `wallDecor`：墙面贴图，放置后进入家具/墙贴编辑系统，使用 `renderLayer: 'wall'`，不会遮挡玩家。

示例：

```ts
{
  id: 'character_dashixiong',
  name: '大师兄',
  kind: 'character',
  textureKey: 'token_center_dashixiong',
  src: 'assets/renwu/大师兄.png',
  defaultScale: 0.54,
  defaultColliderSize: { width: 1.2, height: 1.2 },
}
```

`BootScene` 会遍历素材库并预加载贴图：

```ts
for (const asset of INDOOR_ASSET_LIBRARY) {
  this.load.image(asset.textureKey, `${asset.src}?v=1`);
}
```

## 使用方式

1. 进入室内场景。
2. 按 `F2` 开启室内编辑模式。
3. 右侧会出现“室内素材库”面板。
4. 点击一个素材，面板和左侧提示会显示“待放置素材”。
5. 在场景中点击地面，创建一个新实例。
6. 也可以按住素材拖到场景中，松手直接创建实例。
7. 新实例会自动选中，并自动保存到 localStorage。

放置后仍使用原编辑规则：

- 人物：绿色圆环移动，蓝色点调 depth，绿色矩形调碰撞。
- 墙贴：黄色圆环移动，紫色点调 depth；墙贴层级固定在玩家下方。
- 删除：选中人物/墙贴/家具后按 `Backspace` 或 `Delete`。
- `R` 清空本地保存时，会删除素材库放置出来的额外实例，恢复源码默认状态。

## 保存与固化

素材库放置出来的实例会保存到浏览器 localStorage：

- 人物：`deepsolo_indoor_character_editor_layouts:<buildingId>`
- 家具/墙贴：`deepsolo_furniture_editor_layouts:<buildingId>`

这属于编辑草稿：

- 刷新页面会保留。
- 删除操作也会保存；被删除的默认对象刷新后不会自动回来，按 `R` 可恢复源码默认状态。
- 清理浏览器站点数据会丢。
- 换浏览器或换端口可能丢。

固化方式：

- 人物实例：按 `Cmd/Ctrl+Shift+C` 导出人物配置，再写回 `IndoorCharacterLayout.ts`。
- 家具/墙贴实例：调用已有家具导出逻辑或从 localStorage 抄回 `IndoorFurnitureLayout.ts`。

## 当前收录素材

- 人物：大师兄、归海一刀、师叔、孙大娘。
- 墙贴：门派背景、左侧贴图。

## 后续扩展

- 素材分类折叠、搜索、缩略图网格。
- 选中实例删除。
- 家具、人物、墙贴统一实例系统。
- 一键保存到源码文件。
