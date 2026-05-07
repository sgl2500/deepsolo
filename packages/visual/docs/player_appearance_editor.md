# 玩家人物编辑模式

更新时间：2026-05-07 16:02:00 CST

## 目标

玩家人物外观不再使用多套传统行走帧切换。当前主角统一使用 `player003` 五视图低分辨率 sprite，由引擎根据等距移动方向切换视图，并在移动时叠加上下浮动、轻微左右摆和脚底阴影变化形成伪行走。

## 当前入口

- 按 `F4` 打开/关闭人物编辑模式。
- 点击面板中的人物卡片，会立即替换当前玩家在大地图和室内地图上的外观；当前只保留一套五视图外观。
- 选择会自动保存到浏览器 localStorage，刷新后保留。
- `Esc` 可关闭人物编辑面板。
- 面板下半部分提供调参：
  - `缩放`：控制角色显示大小。
  - `脚底锚点`：控制 `originY`，用于对齐脚底落点。
  - `大地图Y / 室内Y`：分别控制世界/室内的 sprite y 偏移。
  - `上/下/左/右 行`：保留给传统 spritesheet 外观；当前五视图外观不依赖方向行。
  - `行走序列`：保留给传统逐帧行走；当前五视图外观不切换行走帧。

当前内置一套外观：

- `player3_iso_five_view_pseudo_walk`：默认白衣少侠等距五视图，使用 `assets/characters/player3/player3_iso_five_view_pseudo_walk.png`，引擎负责方向映射和伪行走。

## 模块划分

- `src/content/PlayerAppearanceCatalog.ts`
  - 注册当前主角外观。
  - 定义五视图帧宽高、缩放、脚底锚点、偏移、等距方向映射和伪行走参数。
- `src/systems/player/PlayerAppearanceStore.ts`
  - 管理当前选择的人物外观。
  - 写入 localStorage。
  - 提供订阅机制，让玩家实体实时换装。
  - 保存每套外观的本地 tuning override：方向行、行走序列、缩放、锚点和偏移。
- `src/systems/player/PlayerSpriteAnimator.ts`
  - 根据当前外观和移动向量选择五视图方向帧。
  - 兼容传统 `frameSequence`，但当前默认模式使用静态五视图。
  - 负责把 texture/frame/scale/origin 应用到玩家 sprite。
- `src/ui/PlayerAppearanceOverlay.ts`
  - `F4` 人物编辑面板。
  - 显示所有可选人物卡片并触发切换。
- `src/entities/Player.ts`
  - 不再直接硬编码传统 `player_walk` 行走帧。
  - 订阅 `PlayerAppearanceStore`，外观变更后立即更新当前 sprite。
  - 对当前五视图外观叠加伪行走视觉偏移和阴影。

## 新增外观规范

如果后续要新增人物 spritesheet：

1. 每个角色独立目录：`packages/visual/public/assets/characters/<character_id>/`。
2. 五视图伪行走文件统一命名：`<character_id>_iso_five_view_pseudo_walk.png`。
3. `PlayerAppearanceDef.id` 和 `textureKey` 与文件主名保持一致，例如 `player3_iso_five_view_pseudo_walk`。
4. 在 `PlayerAppearanceCatalog.ts` 里新增一条 `PlayerAppearanceDef`。
5. 设置 `src`、`frameWidth`、`frameHeight`、`frameCount`。
6. 传统逐帧外观按图片实际方向设置 `directionRows`；五视图外观设置 `isoStaticFrames`。
7. 调整 `scale`、`originY`、`worldOffsetY`、`indoorOffsetY`，确保脚底落点稳定。
8. 如果使用五视图伪行走，配置 `pseudoWalk`；如果使用传统 3 帧行走，配置 `frameSequence: [0, 1, 0, 2]`。

命名示例：

```txt
assets/characters/player4/player4_iso_five_view_pseudo_walk.png
id:         player4_iso_five_view_pseudo_walk
textureKey: player4_iso_five_view_pseudo_walk
```

`BootScene` 会遍历 `getPlayerAppearanceAssets()` 自动预加载所有人物外观 spritesheet。

## F4 调参草稿

F4 面板里的调参不会直接改 `PlayerAppearanceCatalog.ts`，而是写入：

```txt
localStorage: deepsolo_player_appearance
```

这样可以在游戏里先试效果，避免一边改源码一边刷新。调满意后，再把这些参数抄回对应 `PlayerAppearanceDef`：

```ts
frameSequence: [0, 1, 0, 2],
directionRows: {
  [Direction.Up]: 1,
  [Direction.Right]: 3,
  [Direction.Left]: 2,
  [Direction.Down]: 0,
},
scale: 2.6,
originY: 0.95,
worldOffsetY: 10,
indoorOffsetY: 0,
```

“恢复默认”会清掉当前外观的本地调参草稿，回到源码注册表里的默认值。

## player3 五视图记录

当前只保留运行时使用的低分辨率五视图：

```txt
packages/visual/public/assets/characters/player3/player3_iso_five_view_pseudo_walk.png
```

规格：

- 单帧 `80 x 160`。
- 总图 `400 x 160`。
- 运行时使用 `scale: 0.95` 放大显示，以获得更粗的像素感。
- 方向使用 `isoStaticFrames` 映射，左右方向通过 `flipX` 镜像复用。

## 后续路线

这版先固定为“五视图伪行走”主角方案。后续建议：

1. 继续微调 `isoStaticFrames` 的方向映射和 `pseudoWalk` 幅度。
2. 战斗场景读取同一套玩家外观，避免大地图/战斗角色不一致。
3. 如果未来恢复多外观系统，再重新加入外观解锁、分类和预览。
