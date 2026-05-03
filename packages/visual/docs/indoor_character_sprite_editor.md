# 室内人物贴图编辑说明

## 背景

室内场景现在有三类视觉对象：

- 家具/墙贴：配置在 `src/content/IndoorFurnitureLayout.ts`，可编辑位置、碰撞、遮挡、mask。
- 墙面贴图：仍属于家具配置，但使用 `renderLayer: 'wall'`，固定在玩家和 NPC 下方。
- 人物贴图：配置在 `src/content/IndoorCharacterLayout.ts`，用于纯人物立绘或站立人物，不混入家具碰撞和 mask 系统。

人物贴图第一版用于 Token 中心的 `大师兄.png`，后续可继续追加同类室内人物。

## 配置入口

人物贴图定义在：

```ts
packages/visual/src/content/IndoorCharacterLayout.ts
```

示例：

```ts
{
  buildingId: 'token_center',
  id: 'token_center_dashixiong',
  textureKey: 'token_center_dashixiong',
  localX: 20,
  localY: 12,
  scale: 0.54,
  collider: { minLocalX: 19.4, maxLocalX: 20.6, minLocalY: 11.4, maxLocalY: 12.6 },
}
```

贴图资源在 `BootScene` 中预加载：

```ts
this.load.image('token_center_dashixiong', 'assets/renwu/大师兄.png?v=1');
```

## 编辑方式

进入对应室内场景后：

- 按 `F2` 开启室内编辑模式。
- 绿色圆环表示人物锚点，拖动它移动人物位置。
- 蓝色点表示人物 depth 点，拖动它调整人物与玩家、墙体的遮挡排序。
- 绿色矩形表示人物碰撞框，玩家不能走进这个区域。
- 拖绿色矩形四角，可调整人物阻挡区域。
- 如果锚点和 depth 点重合，按住 `Shift` 再拖动可优先选中 depth 点。
- 松开鼠标后自动保存到浏览器 localStorage。
- 刷新页面会恢复上次编辑的人物位置。
- 按 `R` 会清空本地保存，并恢复代码默认值。
- 按 `Cmd/Ctrl+Shift+C` 导出当前室内人物配置到剪贴板和 console。

人物贴图不参与：

- 家具局部 mask。
- 家具复制功能。
- 可交互区域触发。

人物贴图会参与玩家碰撞：

- `collider` 使用室内 local 坐标。
- 人物锚点拖动时，碰撞框会跟着平移。
- 拖动绿色矩形四角可以单独调整碰撞框大小。
- 保存到 localStorage 后，刷新页面会恢复碰撞框。

## 层级规则

人物贴图使用动态实体层：

```ts
INDOOR_ACTOR_DEPTH_BASE + mapX + mapY + depthBias
```

这意味着：

- 人物和玩家会按等距坐标互相排序。
- 右侧墙、底边墙仍位于前景墙层，可正常遮挡人物。
- 墙面贴图位于墙面层，始终在人物和玩家下方。

## 本地保存

人物编辑结果保存到：

```ts
deepsolo_indoor_character_editor_layouts:<buildingId>
```

当前保存字段包括：

- `id`
- `localX`, `localY`
- `scale`, `alpha`
- `originX`, `originY`
- `pixelOffsetX`, `pixelOffsetY`
- `depthLocalX`, `depthLocalY`
- `depthBias`
- `collider`

如果需要把浏览器中调好的位置固化进源码，可以按 `Cmd/Ctrl+Shift+C` 导出当前人物配置，然后把对应条目抄回 `IndoorCharacterLayout.ts`。

## 后续扩展建议

下一步可以扩展：

- 人物复制/删除。
- 人物缩放快捷键。
- 人物名称标签。
- 人物绑定 `dialogueId`，升级为可交互室内 NPC。
- 人物资源自动注册表，减少 `BootScene` 手动加载。
