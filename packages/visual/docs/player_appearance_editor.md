# 玩家人物编辑模式

更新时间：2026-05-06 12:37:11 CST

## 目标

玩家人物外观不再硬编码在 `Player.ts` 里。主角行走精灵图、方向行、帧数、缩放、原点和室内/室外偏移统一由人物外观配置管理，后续新增主角皮肤只需要注册一条配置并放入对应 spritesheet。

## 当前入口

- 按 `F4` 打开/关闭人物编辑模式。
- 点击面板中的人物卡片，会立即替换当前玩家在大地图和室内地图上的行走精灵图。
- 选择会自动保存到浏览器 localStorage，刷新后保留。
- `Esc` 可关闭人物编辑面板。
- 面板下半部分提供调参：
  - `缩放`：控制角色显示大小。
  - `脚底锚点`：控制 `originY`，用于对齐脚底落点。
  - `大地图Y / 室内Y`：分别控制世界/室内的 sprite y 偏移。
  - `上/下/左/右 行`：控制每个朝向取 spritesheet 的哪一行。
  - `行走序列`：控制走路时按哪些帧循环，例如 `0,1,0,2`。

当前内置两个外观：

- `observer_robed`：默认观察者道袍，使用 `assets/characters/player/player_walk1.png`。
- `lpc_swordsman`：LPC 游侠，使用 `assets/characters/lpc/char01-walk-4dir.png`。
- `player2_daoshi`：青袍道长，使用 `assets/characters/player2/道长行走图.png`。
- `player3_white_swordsman`：白衣少侠，由 `assets/characters/player3/frame_000.png` 到 `frame_011.png` 合成为 `player3_walk.png`。

## 模块划分

- `src/content/PlayerAppearanceCatalog.ts`
  - 注册可选人物外观。
  - 定义每套 spritesheet 的帧宽高、帧数、方向行、缩放、原点和偏移。
- `src/systems/player/PlayerAppearanceStore.ts`
  - 管理当前选择的人物外观。
  - 写入 localStorage。
  - 提供订阅机制，让玩家实体实时换装。
  - 保存每套外观的本地 tuning override：方向行、行走序列、缩放、锚点和偏移。
- `src/systems/player/PlayerSpriteAnimator.ts`
  - 根据当前外观、方向和移动状态计算行走帧。
  - 支持 `frameSequence`，例如 3 帧走路图可用 `[0, 1, 0, 2]` 形成更自然的循环。
  - 负责把 texture/frame/scale/origin 应用到玩家 sprite。
- `src/ui/PlayerAppearanceOverlay.ts`
  - `F4` 人物编辑面板。
  - 显示所有可选人物卡片并触发切换。
- `src/entities/Player.ts`
  - 不再直接硬编码 `player_walk` 行走帧。
  - 订阅 `PlayerAppearanceStore`，外观变更后立即更新当前 sprite。

## 新增外观规范

新增人物 spritesheet 时：

1. 把图片放入 `packages/visual/public/assets/characters/<group>/`。
2. 在 `PlayerAppearanceCatalog.ts` 里新增一条 `PlayerAppearanceDef`。
3. 设置 `textureKey`、`src`、`frameWidth`、`frameHeight`、`frameCount`。
4. 按图片实际方向设置 `directionRows`。
5. 调整 `scale`、`originY`、`worldOffsetY`、`indoorOffsetY`，确保脚底落点稳定。
6. 如果单方向只有 3 帧，建议配置 `frameSequence: [0, 1, 0, 2]`，让站立帧穿插在左右脚之间。

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

## player3 合成记录

`packages/visual/public/assets/characters/player3/` 中原始资源是 12 张单帧：

- `frame_000.png` 到 `frame_002.png`：向下。
- `frame_003.png` 到 `frame_005.png`：向上。
- `frame_006.png` 到 `frame_008.png`：向左。
- `frame_009.png` 到 `frame_011.png`：向右。

已合成为：

```txt
packages/visual/public/assets/characters/player3/player3_walk.png
```

合成后规格：

- 单帧 `22 x 50`。
- 每方向 `3` 帧。
- 总图 `66 x 200`。

## 后续路线

这版先做“开发/玩家可见的外观切换”。后续建议：

1. 增加“保存到源码”或账号字段，把选择固化到玩家档案。
2. 外观增加解锁条件、拥有关系、价格和稀有度。
3. 面板增加搜索、分类、旋转预览和行走预览。
4. 战斗场景读取同一套玩家外观，避免大地图/战斗角色不一致。
