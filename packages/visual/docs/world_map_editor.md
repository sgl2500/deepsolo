# 大地图编辑模式说明

本文记录大地图入口与碰撞编辑器的使用方式和代码入口。

## 设计目标

大地图编辑器采用和室内观察者小屋家具编辑器一致的方式：只在编辑模式显示辅助点位，在游戏画面里直接拖点调整，所见即所得，不再放右侧后台参数面板。

- 普通模式：只保留玩家游玩体验，不暴露入口、碰撞、坐标数据。
- 编辑模式：显示所有建筑入口、碰撞范围和左下角中文操作说明。
- 调整即时生效：入口触发范围、玩家碰撞都会立刻更新；建筑贴图本体默认固定不跟入口点移动。
- 编辑结果自动保存到浏览器 `localStorage`，刷新后继续使用。

## 开关入口

进入大地图后：

- `F3`：开启/关闭大地图编辑模式。
- `H`：收起/展开左下角操作说明。

编辑器只在大地图启用。进入室内、战斗或对话场景时会自动隐藏。

## 鼠标操作

颜色含义：

- 黄色圆点/建筑本体：建筑贴图锚点，拖动它或直接拖建筑主体可以移动整栋建筑。
- 紫色圆点：建筑遮挡排序点，只影响建筑和玩家谁盖住谁，不移动贴图。
- 绿色椭圆：建筑入口触发区。
- 绿色圆点：入口中心，拖动后只移动入口触发点，建筑贴图本体不移动。
- 绿色方块：入口半径手柄，拖动后入口圈变大或变小。
- 橙色多边形：建筑真实碰撞阻挡区。
- 橙色圆点：碰撞多边形顶点，拖动后改变不规则轮廓。
- `Shift + 点击`：在当前建筑碰撞多边形边附近新增顶点；点太远不会新增，避免误操作。
- 右键/`Alt + 点击` 橙色点：删除指定顶点。
- 黄色高亮：当前选中的建筑。

常用流程：

1. 点击建筑主体、入口点、碰撞点或建筑文字附近，选中建筑。
2. 拖黄色点或建筑主体，先把整栋建筑贴图放到合适位置。
3. 拖紫色点，把遮挡排序点放到建筑脚底前沿或门槛地面线附近。
4. 拖绿色圆点，把入口放到门口前方。
5. 拖绿色方块，让入口范围刚好覆盖玩家应该能进门的位置。
6. 拖橙色点，把碰撞多边形贴合建筑外轮廓。
7. 需要更细的形状时，按住 `Shift` 点击多边形边附近新增顶点；必须靠近边线才会生效。
8. 右键或 `Alt + 点击` 橙色点，删除多余顶点。

鼠标滚轮也可辅助微调：

- 普通滚轮：调整当前建筑入口半径。
- 旧圆形碰撞只作为历史数据兜底；新建筑主要编辑橙色多边形。

## 快捷键补充

鼠标是主要操作方式，快捷键只用于辅助：

- `[` / `]`：减小/增大入口半径。
- `-` / `=`：减小/增大旧圆形碰撞半径，仅用于历史兜底。
- `Delete`：清除当前建筑碰撞多边形。
- `R`：清空大地图编辑器本地保存，恢复代码默认入口/碰撞配置。


## 建筑贴图和入口的关系

现在建筑贴图和入口点已经拆开：

- `visualX / visualY`：建筑贴图本体锚点，用来决定建筑画在哪里；编辑模式下拖黄色点或建筑主体会修改它。
- `depthX / depthY`：建筑遮挡排序点，用来决定建筑和玩家谁显示在上层；编辑模式下拖紫色点修改它。
- `entryX / entryY / entryRadius`：绿色入口触发区，用来决定玩家走到哪里进入建筑。
- `collisionPolygon`：橙色不规则碰撞多边形，用来决定玩家不能走进哪里。
- `collisionX / collisionY / collisionRadius`：旧圆形碰撞兜底字段，只有没有多边形时才使用。

因此拖绿色点只会调整入口，不会再拖动整栋建筑。

旧版浏览器本地保存可能没有多边形数据，编辑器会迁移旧数据：保留你之前调过的入口和建筑位置，同时使用代码默认多边形碰撞，所以橙色顶点会显示出来。

## 代码入口

- `src/systems/WorldMapEditor.ts`
  - 大地图编辑器主体：绘制 overlay、拖拽建筑锚点、入口点、多边形碰撞顶点、左下角说明、保存 localStorage。
- `src/scenes/WorldScene.ts`
  - 创建 `WorldMapEditor`，绑定 `F3/H/R/Delete` 等按键，在大地图状态下调用 `update()`。
- `src/systems/BuildingMarkers.ts`
  - 建筑贴图位置每帧读取 `BUILDINGS.visualX / visualY`，遮挡排序读取 `BUILDINGS.depthX / depthY`；没有配置时才回退到贴图锚点和入口坐标。
- `src/systems/SceneManager.ts`
  - 进入建筑读取 `BUILDINGS.entryX / entryY / entryRadius`，所以入口编辑会即时影响进入触发。
- `src/content/WorldBuildingCollision.ts`
  - 玩家大地图建筑碰撞检测。
- `src/entities/Player.ts`
  - 世界地图移动时调用 `isBlockedByWorldBuildingCollision()`。
- `src/types.ts`
  - `BuildingDef` 包含：`visualX`、`visualY`、`depthX`、`depthY`、`collisionPolygon`、`collisionX`、`collisionY`、`collisionRadius`。
- `src/config.ts`
  - `LS_KEY_WORLD_MAP_EDITOR_LAYOUTS = 'deepsolo_world_map_editor_layouts'`。

## 数据保存格式

localStorage key：

```ts
deepsolo_world_map_editor_layouts
```

数据结构：

```ts
{
  version: 5,
  savedAt: number,
  items: [
    {
      id: string,
      entryX: number,
      entryY: number,
      entryRadius: number,
      visualX?: number,
      visualY?: number,
      // v5 开始保存建筑遮挡排序点。
      depthX?: number,
      depthY?: number,
      // v4 开始保存不规则碰撞多边形。
      collisionPolygon?: Array<{ x: number, y: number }>,
      // 旧圆形碰撞兜底字段。
      collisionX?: number,
      collisionY?: number,
      collisionRadius?: number
    }
  ]
}
```

## 碰撞规则

大地图碰撞优先使用 `collisionPolygon`。当建筑没有多边形时，才退回旧的 `collisionRadius > 0` 圆形碰撞。

为了避免入口被碰撞圈挡住，检测逻辑会跳过入口触发区：

```ts
if (distanceToEntry <= entryRadius) continue;
```

也就是说：

- 入口圈内允许玩家进入建筑。
- 橙色多边形区域会阻挡玩家。

如果感觉进不去建筑，优先检查：

1. 入口半径是否太小。
2. 橙色多边形是否压住了入口路径。
3. 多边形顶点是否包住了不该阻挡的位置。
4. 入口圈是否在建筑门口前方，而不是建筑主体里面。

## 后续可优化

1. 支持新增/删除建筑入口，而不只是编辑现有 `BUILDINGS`。
2. 支持导出 JSON 文件，正式固化到代码配置。
3. 支持单独编辑建筑贴图锚点、标签位置和显示大小。
