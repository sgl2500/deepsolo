# 大地图建筑贴图说明

本文记录大地图建筑入口贴图的资源、映射和后续调参方式。

## 资源来源

原始资源目录：

```txt
packages/visual/public/assets/ai-resource/
```

当前使用的原图：

- `A股门派.png`
- `数字币门派.png`
- `美股门派.png`
- `黄金门派.png`

为了方便 Phaser 加载、避免中文路径/透明背景问题，并避免浏览器把 1000+ 像素大图实时缩小导致发糊，已生成游戏内显示尺寸的运行时贴图：

```txt
packages/visual/public/assets/ai-resource/runtime/ai_building_a_share.png
packages/visual/public/assets/ai-resource/runtime/ai_building_crypto.png
packages/visual/public/assets/ai-resource/runtime/ai_building_us.png
packages/visual/public/assets/ai-resource/runtime/ai_building_gold.png
```

说明：`美股门派.png` 原图带棋盘格底，运行时版本已做边缘白/灰棋盘格透明处理；其他图也做了透明裁剪，原图不改动。

## 加载入口

资源在 `src/scenes/BootScene.ts` 预加载：

```ts
const WORLD_BUILDING_ASSETS = [
  { key: 'world_building_a_share', file: 'ai_building_a_share.png' },
  { key: 'world_building_crypto', file: 'ai_building_crypto.png' },
  { key: 'world_building_us', file: 'ai_building_us.png' },
  { key: 'world_building_gold', file: 'ai_building_gold.png' },
];
```

## 建筑映射

大地图入口渲染在 `src/systems/BuildingMarkers.ts`。

当前映射：

```ts
birth_house   -> world_building_a_share
exchange      -> world_building_a_share
teahouse      -> world_building_gold
news          -> world_building_us
token_center  -> world_building_crypto
heimu_cliff   -> world_building_gold
```

如果后续要给观察者小屋、黑木崖等做专属贴图，只需要新增 runtime 贴图并改 `WORLD_BUILDING_VISUALS`。

## 调参入口

在 `BuildingMarkers.ts` 里调：

```ts
type WorldBuildingVisual = {
  textureKey: string;
  scale: number;
  offsetY: number;
  labelY: number;
};
```

- `textureKey`：使用哪个贴图。
- `originY`：建筑贴图锚点。当前约 `0.88-0.9`，让门口/台阶贴近入口点，避免漂浮。
- `offsetY`：建筑锚点相对入口点的像素偏移。当前为 `0`，不要轻易设成负数，否则会漂浮。
- `labelY`：建筑名字标签的高度。

注意：运行时贴图已经是游戏内目标尺寸，所以 `BuildingMarkers.ts` 中建筑 `scale` 固定为 `1`。如果要改显示大小，优先重新生成 runtime 贴图，不建议在 Phaser 里大比例缩放。

当前建筑容器会随玩家视角移动，并使用 `entryY + 0.25` 做深度，让玩家靠近时有基本前后遮挡关系。建筑本体不做任何 tween，避免渲染层看起来晃动；只有入口小光点保留脉冲提示。
