# Visual 包治理说明

`packages/visual` 是 DeepSolo 当前最活跃的前端游戏包，包含 Phaser 场景、DOM UI、游戏状态、战斗、室内外编辑器和资源加载。

## 常用命令

```bash
npm run dev              # 本地开发，默认 3456 端口
npm run typecheck        # TypeScript 类型检查
npm run test:unit        # 纯函数/数据模块单元测试
npm run build            # 类型检查 + Vite 构建
npm run check            # 正式交付前门禁：typecheck + test:unit + build
npm run audit:governance # 治理巡检，输出风险提示
```

## 模块边界

| 模块 | 位置 | 责任 |
| --- | --- | --- |
| 场景协调 | `src/scenes/WorldScene.ts` | 创建系统、协调输入、调度世界/室内/战斗 |
| 场景状态 | `src/systems/SceneManager.ts` | 世界地图、室内、对话、战斗状态切换 |
| 世界建筑 | `src/data/BuildingData.ts`、`src/systems/BuildingMarkers.ts` | 建筑配置、贴图、入口光点 |
| 大地图编辑器 | `src/systems/WorldMapEditor.ts` | 建筑锚点、入口、多边形碰撞编辑 |
| 室内渲染 | `src/systems/MapRenderer.ts` | 室内地图、家具、遮挡、编辑器 |
| 战斗 | `src/systems/BattleSystem.ts`、`src/systems/BattleAnimator.ts` | 战斗状态、行动、动画、HUD |
| 玩家数据 | `src/core/GameStore.ts`、`src/ui/PlayerPanel.ts` | 玩家属性、武功、物品、面板 |
| 类型定义 | `src/types.ts`、`src/types/*` | `src/types.ts` 只做兼容出口，领域类型放入 `src/types/*` |

## 类型边界

- `src/types.ts` 是兼容 barrel，只负责 re-export。
- 新增类型优先落到 `src/types/*` 对应领域文件，例如 `battle.ts`、`world.ts`、`player.ts`。
- 新模块内部可以继续从 `../types` 导入，避免一次性大范围改 import。
- 如果某个类型文件超过 300 行，应继续按子领域拆分。

## 编辑器模式约定

- 普通模式：不显示坐标、点位、碰撞、遮挡、mask、后台参数。
- 编辑模式：在画面内直接拖点，左下角中文说明可以收起。
- 编辑结果可以暂存在 localStorage，但完成后应固化到配置文件。
- 快捷键只作为辅助，主要交互尽量鼠标完成。

## 大地图建筑数据约定

- `visualX/visualY`：建筑贴图锚点，黄色点控制。
- `depthX/depthY`：建筑遮挡排序点，紫色点控制。
- `entryX/entryY/entryRadius`：进入建筑的绿色入口圈。
- `collisionPolygon`：橙色不规则碰撞多边形，优先用于玩家阻挡。
- `collisionX/collisionY/collisionRadius`：旧圆形碰撞兜底字段，不作为主要编辑对象。

## 回归场景

每次改 Visual 包后，至少手动验证：

1. 从观察者小屋进入大地图。
2. 大地图普通模式没有后台坐标。
3. `F3` 大地图编辑模式可以拖建筑、紫色遮挡点、入口和橙色碰撞点。
4. 进入观察者小屋后，大地图策略排行和小地图隐藏。
5. 室内 `F2` 家具编辑器只在编辑模式显示点位。
6. 床休息、书架秘籍、背包/武功面板流程正常。
7. 发起战斗后，玩家血量来自个人属性，移动/攻击/休息/物品流程正常。


## 自动化测试

- `npm run test:unit` 使用 `scripts/run_visual_unit_tests.mjs` 调用 esbuild 打包并运行 TypeScript 单元测试，不额外引入测试框架。
- 当前覆盖 `BattleRules`、`IndoorCoordinateMapper`、`IndoorEditorPersistence`。
- 新增纯规则、坐标换算、持久化快照、配置迁移时，应优先补单元测试。
- `npm run check` 已串联 `typecheck`、`test:unit` 和 `build`，作为交付前门禁。

## 大文件治理

当前 Visual 包原有两个重点治理对象，均已降至 1500 行以内：

- `src/systems/BattleSystem.ts`：已抽出规则、AI、输入、棋盘和 HUD；后续可继续拆动画调度。
- `src/systems/MapRenderer.ts`：已抽出世界地图 canvas、室内坐标、室内图层、家具遮挡和编辑器持久化；后续可继续拆家具 base sprite 与编辑器交互。

规则：新增战斗或室内渲染功能前，先判断是否能落到计划中的子模块；不要继续把新职责直接堆进主类。

## 调试输出

- 普通体验版不允许直接新增 `console.log`。
- 需要开发态调试输出时使用 `src/utils/DebugLogger.ts`。
- 调试输出默认关闭，可在浏览器控制台执行 `localStorage.setItem('deepsolo:debugLogs', '1')` 后刷新开启。
- 用户主动触发的导出、复制等操作可以用 `console.info` 作为显式反馈，但应避免高频输出。
