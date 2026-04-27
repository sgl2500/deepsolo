# 观察者小屋家具调参说明

本文记录观察者小屋室内家具的调参方法。目标是：不修改原始 PNG，只通过配置控制家具的位置、视觉偏移、碰撞和遮挡。

## 相关文件

- 家具主配置：`packages/visual/src/content/IndoorFurnitureLayout.ts`
- 家具碰撞逻辑：`packages/visual/src/content/IndoorFurnitureCollision.ts`
- 家具渲染逻辑：`packages/visual/src/systems/MapRenderer.ts`
- 室内交互点：`packages/visual/src/content/IndoorInteractables.ts`

通常只需要改 `IndoorFurnitureLayout.ts`。

## 坐标体系

观察者小屋使用两套坐标：

- `mapX/mapY`：游戏真实地图坐标。
- `localX/localY`：房间内侧坐标，方便人工调家具。

观察者小屋围墙内侧原点对应真实地图 `(3, 3)`，所以：

```ts
mapX = localX + 3
mapY = localY + 3
```

页面调试信息会显示：

```text
map:真实地图坐标 local:房间内坐标 [室内]
```

调家具时优先看 `local`。

## 调试叠层说明

室内已经加了调试叠层：

- 蓝色菱形：真实地图格子。
- 黄色坐标字：真实地图坐标。
- 红色框：家具碰撞范围。
- 黄色圆环：家具锚点，也就是 `localX/localY` 对应的位置。
- 紫色实心点：家具遮挡排序点，也就是 `depthLocalX/depthLocalY` 对应的位置。若与黄色圆环重合，会显示在圆环内部。
- 橙色点/面：家具多边形遮挡 mask，只在 mask 编辑模式下调整。
- 青色框/点：室内可交互区域，比如床正面休息范围、书架翻看范围。
- 绿色点/圈：玩家脚点，碰撞判断实际使用这个点。

判断碰撞时看绿色点是否进入红框，不要看角色整张图片。

点选规则：

- 黄色圆环和紫色实心点重合时，普通拖动优先移动黄色锚点。
- 按住 `Shift` 拖动重合点时，优先移动紫色遮挡排序点。
- 橙色 mask 点被选中后会显示白色外圈。
- 拖青色中心点可以整体移动交互区域，拖青色四角可以调整触发范围。

编辑模式左下角会显示中文操作说明，点击面板标题或按 `H` 可以收起/展开；左上角只显示当前选中家具的实时参数。

## 家具配置字段

家具配置示例：

```ts
{
  buildingId: 'birth_house',
  id: 'bed',
  textureKey: 'birth_house_decor_bed',
  localX: 2.3,
  localY: 10.3,
  scale: 0.5,
  pixelOffsetX: 0,
  pixelOffsetY: 0,
  depthLocalX: 1.5,
  depthLocalY: 9.2,
  collider: { minLocalX: 0, maxLocalX: 2.5, minLocalY: 7.2, maxLocalY: 11.1 },
  occluderMask: [
    { px: 30, py: 120 },
    { px: 260, py: 120 },
    { px: 260, py: 210 },
    { px: 30, py: 210 },
  ],
}
```

### `localX/localY`：逻辑位置

控制家具锚点在房间内的位置。

等距坐标方向：

- `localX` 变大：视觉上往右下方向移动。
- `localX` 变小：视觉上往左上方向移动。
- `localY` 变大：视觉上往左下方向移动。
- `localY` 变小：视觉上往右上方向移动。

如果想整体移动家具，先调这两个。

### `scale`：图片大小

控制家具图片缩放。

- 变大：家具变大。
- 变小：家具变小。

建议每次改 `0.02` 到 `0.04`。

### `pixelOffsetX/pixelOffsetY`：视觉偏移

只移动图片，不移动锚点、碰撞框、交互点。

用于处理 PNG 不是标准等距锚点图的问题。

- `pixelOffsetX > 0`：图片往右。
- `pixelOffsetX < 0`：图片往左。
- `pixelOffsetY > 0`：图片往下。
- `pixelOffsetY < 0`：图片往上。

如果红框位置对，但图片和红框对不上，就调这个。

### `collider`：禁止玩家进入的区域

红色框来自 `collider`。

```ts
collider: {
  minLocalX: 0,
  maxLocalX: 2.5,
  minLocalY: 7.2,
  maxLocalY: 11.1,
}
```

含义：玩家脚点进入这个区域，就不能继续移动。

如果你有四个点：

```text
3.7,10.1  5.8,10.1
3.7,14.6  5.8,14.6
```

就写成：

```ts
collider: {
  minLocalX: 3.7,
  maxLocalX: 5.8,
  minLocalY: 10.1,
  maxLocalY: 14.6,
}
```

注意：`collider` 是房间内侧绝对坐标，不是相对 `localX/localY` 的偏移。

### `depthLocalX/depthLocalY`：遮挡排序点

控制家具和玩家谁盖住谁。

玩家的遮挡值大致是：

```ts
playerDepth = playerLocalX + playerLocalY
```

家具的遮挡值是：

```ts
furnitureDepth = depthLocalX + depthLocalY
```

谁的值更大，谁更靠前。

现象判断：

- 玩家在家具侧边/前面，却被家具盖住：家具 depth 太大，调小 `depthLocalX/depthLocalY`。
- 玩家在家具后面，却盖住家具：家具 depth 太小，调大 `depthLocalX/depthLocalY`。

对大 sprite，不能总取碰撞框最前角。因为整张图片只有一个 depth，取最前角会让家具在侧边也过度盖住玩家。

### `occluderMask`：未来局部遮挡区域

`occluderMask` 是图片像素坐标，表示家具原 PNG 上哪一块可以作为“前景遮挡层”。

```ts
occluderMask: [
  { px: 30, py: 120 },
  { px: 260, py: 120 },
  { px: 260, py: 210 },
  { px: 30, py: 210 },
]
```

坐标含义：

- `px`：从 PNG 左边缘往右的像素。
- `py`：从 PNG 上边缘往下的像素。
- 它不受 `localX/localY` 影响，也不是地图坐标。
- 它会跟着 `scale` 缩放，所以适合长期保存。

编辑方法：

1. `F2` 打开编辑模式。
2. 点选一个家具，按 `M` 打开 mask 模式。
3. 在家具图片上点击，新增橙色点。
4. 拖动橙色点，调整多边形范围。
5. `Alt` + 点击橙色点，或右键橙色点，删除指定点。
6. `Backspace` / `Delete` 删除当前选中点；没有选中点时删除最后一个点，`C` 清空。
7. 让玩家走到家具前后，直接观察橙色区域对应的前景遮挡是否自然。

当前 mask 是所见即所得的运行时效果：同一家具会多渲染一层前景裁剪贴图，只显示 `occluderMask` 圈出的区域，并盖在玩家上方。

## 编辑器自动保存

编辑模式下的家具位置、碰撞框、遮挡排序点、`occluderMask` 和青色交互区域会自动保存到浏览器 `localStorage`。

保存时机：

- 拖动锚点、深度点或碰撞框后，松开鼠标时保存。
- 新增、拖动、删除或清空 mask 点后保存。
- 刷新页面后，进入观察者小屋会自动恢复上次保存的布局。

保存 key：

```text
deepsolo_furniture_editor_layouts:birth_house
deepsolo_interactable_editor_layouts:birth_house
```

如果想丢弃浏览器里的调参结果，按 `F2` 进入编辑模式后按 `R`，会清空当前房间的本地保存，并恢复 `IndoorFurnitureLayout.ts` 里的默认参数。

注意：自动保存只写浏览器，不会改源码文件。确认效果稳定后，再把参数整理回配置文件或后续 JSON 数据源。

## 床当前参数解释

当前床参数：

```ts
localX: 2.3,
localY: 10.3,
scale: 0.5,
depthLocalX: 1.5,
depthLocalY: 9.2,
collider: { minLocalX: 0, maxLocalX: 2.5, minLocalY: 7.2, maxLocalY: 11.1 },
```

含义：

- 床锚点在房间内侧 `(2.3, 10.3)`。
- 玩家不能进入 `(0, 7.2)` 到 `(2.5, 11.1)` 的区域。
- 床遮挡排序使用 `(1.5, 9.2)`，depth 为 `10.7`。

为什么不用碰撞框最前角 `(2.5, 11.1)`？

因为它的 depth 是 `13.6`，太靠前。床会在侧边也盖住玩家。现在改成 `(1.5, 9.2)`，让玩家在床侧边更容易显示在床上方，视觉更自然。

## 推荐调参顺序

每个家具按这个顺序调：

1. 调 `localX/localY`：先把家具放到大概位置。
2. 调 `scale`：确认大小。
3. 调 `collider`：让玩家脚点刚好不能进入家具占地区域。
4. 调 `pixelOffsetX/Y`：如果图片和红框对不上，只移动图片。
5. 调 `depthLocalX/Y`：最后处理遮挡。
6. 如果单个 depth 仍然不够，用 `occluderMask` 标出真正需要盖住玩家的前景部分。

不要用 `localX/localY` 去修遮挡，也不要用 `collider` 去修图片视觉偏移。

## 常见问题

### 改了碰撞框没变化

先把某个家具的 `collider` 临时改大：

```ts
collider: { minLocalX: 0, maxLocalX: 20, minLocalY: 0, maxLocalY: 20 }
```

如果玩家几乎走不动，说明碰撞生效，原先只是框没覆盖到玩家脚点。

### 人物身体和家具重叠了，但没被挡

碰撞判断用的是绿色脚点，不是人物整张图。只要脚点没进红框，就不会被挡。

### 图片和红框对不上

用 `pixelOffsetX/Y` 调图片，不要改 `collider`。

### 遮挡某些位置永远不完美

单张家具 sprite 只有一个 depth。大件家具，如床，可能无法在所有边缘都完美遮挡。如果需要更精细效果，需要把家具拆成前后两层 sprite。

## 验证

修改后刷新：

```text
http://127.0.0.1:3456/
```

如热更新没生效，重新启动：

```bash
cd /Users/sunguanlong/Desktop/AIGC/deepsolo/packages/visual
npm run dev
```
