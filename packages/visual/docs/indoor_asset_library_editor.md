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

## 架构升级说明

当前 `IndoorAssetLibrary.ts` 已经变成兼容层，真实素材数据来自：

```ts
packages/visual/src/content/AssetCatalog.ts
```

以后新增同类素材，优先加到 `AssetCatalog.ts`。室内编辑器会从全局 catalog 里筛选：

- `category: 'indoor.character'` -> 人物素材。
- `category: 'indoor.wallDecor'` -> 墙面贴图素材。

这样后续大地图建筑、地块装饰、玩家住宅家具都可以继续放进同一个素材目录，再由不同编辑器 adapter 根据场景类型过滤。

长期目标见：

```txt
packages/visual/docs/plans/2026-05-05-extensible-scene-editor-architecture.md
```

## 统一场景快照导出

为了向未来数据库保存靠拢，室内编辑器现在支持导出完整 `EditableSceneSnapshot`：

1. 进入室内场景。
2. 按 `F2` 开启编辑模式。
3. 按 `Cmd/Ctrl+Shift+S`。
4. 当前室内场景 JSON 会复制到剪贴板，并输出到 console.info。

这份 JSON 会把当前室内的对象统一成一份 scene state：

- 家具和普通物体：`kind: 'indoorFurniture'`，`layer: 'object'`。
- 墙面贴图：`kind: 'wallDecor'`，`layer: 'wall'`，`depth.mode: 'behindActor'`。
- 人物 NPC：`kind: 'indoorCharacter'`，`layer: 'character'`。
- 交互区域：`kind: 'interactable'`，`layer: 'interaction'`。

这个格式对应未来数据库里的：

- `scenes`
- `scene_objects`
- `asset_catalog`

所以后续可以从 localStorage 草稿逐步迁移到服务端保存，而不用重做编辑器数据结构。

## LocalSceneRepository 草稿保存

统一场景快照现在已经接入 `LocalSceneRepository`：

```ts
packages/visual/src/editor/core/SceneRepository.ts
```

保存 key 格式：

```txt
deepsolo_scene_editor_drafts:<sceneType>:<sceneId>
```

例如 Token 中心：

```txt
deepsolo_scene_editor_drafts:indoor:token_center
```

触发保存的时机：

- 进入室内时会生成一次统一 scene draft。
- 拖动家具、人物、交互区松手后会自动保存。
- 从素材库新增、复制、删除对象后会自动保存。
- 按 `Cmd/Ctrl+Shift+S` 会保存并导出当前统一快照。
- 按 `R` 恢复默认布局时，会清理旧 draft 并保存恢复后的默认快照。

这一步仍然不会强依赖数据库运行，但 `SceneRepository` 接口已经把未来 API/数据库保存的边界留出来。后续只需要新增 `ApiSceneRepository`，就可以把 localStorage 草稿切到服务端。

## 场景对象面板

`F2` 编辑模式右侧现在除了素材库，还会显示“当前场景对象”面板。这个面板直接读取统一 `EditableSceneSnapshot`，用于把底层抽象显性化到 UI：

- 显示当前 sceneId / sceneType / 未来表名 `scene_objects`。
- 显示统一草稿保存时间和对象数量。
- 列出当前场景里的人物、墙贴、家具、交互区。
- 点击列表项会选中对应对象，并同步左侧调试框和场景中的编辑锚点。

这一步的目标是让编辑器从“只靠画面拖拽”开始过渡到“对象化管理”。后续可以在这个面板上继续加搜索、滚动、删除按钮、复制按钮、锁定/隐藏、图层切换和属性面板。

## 建造模式 UI v1

`F2` 现在会打开新的 DOM 建造模式 UI，而不是继续依赖 Phaser 文本面板堆信息：

- 顶部工具栏：选择、碰撞/遮挡、预览、导出 JSON、高级调试、退出。
- 左侧素材库：按人物、墙贴分组，点击素材后再点击场景放置。
- 右侧属性面板：显示当前对象类型、名称、位置、图层、缩放和碰撞状态。
- 右侧对象列表：列出当前 `EditableSceneSnapshot.objects`，点击即可选中对象。
- 底部状态条：显示自动保存时间、对象数量，并提供复制、删除、恢复默认。

普通建造模式默认隐藏旧的开发者文本说明；点击“高级调试”才会显示旧的 schema/debug 辅助信息和 Phaser 右侧调试列表。这样玩家布置体验和开发调试信息被分开了。

## 建造模式 UI v2

在 v1 的基础上，右侧面板继续补了两个核心能力：

- 属性面板现在支持直接编辑 `X / Y / scale / depthX / depthY / rotation`。
- 家具、墙贴仍可切换 `object / wall` 图层；人物和交互区会显示只读图层，避免误解。
- 碰撞开关仍然支持家具和人物；交互区会明确提示它走的是 `interaction zone`，不是实体碰撞。
- 对象列表增加搜索框，可按名称、`id`、素材 `assetId`、图层、对象类型过滤。

这一层的目的，是把编辑器从“只能拖拽试错”往“对象属性可控、可检索”推进一步：

- 当墙贴遮挡、NPC depth、碰撞框跟视觉锚点不一致时，不用再反复拖调试点。
- 当一个室内场景对象变多时，不用肉眼在画面里找，直接在右侧列表搜索并选中。

当前仍然保持自动保存逻辑不变：

- 属性面板改值后，仍会立即写回原有 localStorage 草稿。
- 统一 `EditableSceneSnapshot` 草稿也会同步更新。

## 建造模式 UI v3

这一版继续补编辑效率：

- 左侧素材库增加搜索框，可按素材名称、`id`、类型、`textureKey` 过滤。
- 右侧属性面板增加碰撞框编辑，可直接改 `minX / maxX / minY / maxY`。
- 方向键可以微调当前选中对象的 `localX / localY`，步长 `0.1`。
- `Alt+方向键` 可以快速移动当前选中对象，步长 `1`。
- 底部“复制”和 `Cmd/Ctrl/Shift+D` 现在按当前选中对象类型复制，支持人物、家具和墙贴。

方向键微调支持家具、墙贴、人物和交互区：

- 家具/墙贴移动时，锚点、已有碰撞框和已有 depth 点会一起平移。
- 人物移动时，锚点、碰撞框和已有 depth 点会一起平移。
- 交互区移动时，移动的是 interaction zone 的中心。

`Shift+方向键` 仍保留给家具旋转中心 `origin` 微调，不和对象移动冲突。

当前交互区仍不支持复制，因为交互区后续应该绑定行为脚本、对白或传送目标，不能只复制位置和框。

## 建造模式 UI v4

这一版把交互区也拉进统一 inspector：

- 交互区现在可以直接编辑 `X / Y`、`interactRadius`，以及 `interaction zone` 的 `minX / maxX / minY / maxY`。
- 如果交互区原本只有中心点和半径，没有矩形 zone，第一次改 zone 四边时会自动创建一个默认 `1x1` 本地格矩形。
- 交互区的行为信息会显示在右侧，包括触发类型、目标、提示文案和底层 action 类型。

当前行为信息仍然是只读的，这是有意控制范围：

- 现有 localStorage 持久化只稳定保存位置、半径和 `interactionZone`。
- `dialogueId`、`discover_manual`、`rest` 这类行为配置后续应单独进入“行为编辑”层，而不是先在这版 UI 里做出可改但不持久化的假象。

## 建造模式 UI v5

这一版开始引入双模式编辑：

- `对象` 模式：继续编辑人物、家具、墙贴、交互区。
- `瓦片` 模式：第一版只开放 `floor` 层单点刷和橡皮。

当前瓦片模式的实现边界：

- 只对带 `fixedRoom.floorTiles` 模板的室内场景开放。
- 点击单个地板格，会写入一个 `floor tile override`。
- 橡皮会删除 override，恢复模板默认地板瓦片。
- override 会单独保存到 localStorage，并同步进统一 `EditableSceneSnapshot.metadata`。

这一层还没有开放：

- 墙体 `wallTiles` 编辑。
- 矩形刷、拖刷、填充、吸管。
- 自动拼边和门洞规则。

这是刻意收口。地板层和墙体层本质是瓦片层，不应该直接混入现有人物/家具对象编辑链。先把 `floor overrides` 跑通，后面再把 `wall` 层和更完整的 brush 系统加进来。
