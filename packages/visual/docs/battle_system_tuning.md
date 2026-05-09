# 战斗系统调优说明

本文记录当前战斗系统的配置入口，方便后续继续调整站位、战斗 UI、角色动作和武功表现。

## 当前完成状态

- 大地图靠近 Agent 后可进入玩家手动战斗。
- 战斗画面采用“四角 HUD + 中心战场”：左上状态、右上战局、左下日志、右下命令、底部出手顺序。
- 玩家生命/内力直接读取个人属性面板当前值和上限，战斗结束后直接回写，不再做 5 倍缩放。
- 战斗移动有碰撞，不允许穿过其他角色；移动动画按 BFS 路径逐格行走。
- 角色77主角与角色148数字掌门已接入横版 batch frames：idle/run/attack/hit/defense/dead 都走同一套帧动画管线。
- 横版打击增加了命中帧同步、目标受击动作、斩击线、屏幕闪白和战斗层震动，伤害数字会区分护盾、闪避和会心。
- 普通攻击是单格单体攻击，并接入熟练度成长和等级视觉阶段。
- 武功表现已抽到配置层，后续特效、招式字、震动、命中停顿可以不改主流程直接调配置。
- Vite 大 chunk 警告已通过 `vite.config.ts` 的 `chunkSizeWarningLimit` 处理，当前 build 无警告。

## 关键文件

- `src/systems/BattleSystem.ts`
  - 战斗流程、回合、移动、攻击、HUD 布局和 Phaser 画面渲染。
- `src/systems/sidebattle/SideBattleSystem.ts`
  - 当前横版切磋主流程，负责横版角色站位、出招节奏、命中反馈、HUD 和开发预览。
- `src/content/BattleActors.ts`
  - 战斗角色动作资源配置。当前 `fight000` 攻击/站立使用 `12_fight/Fight000/0040.png-0087.png`，移动使用 `16_walk/2501.png-2528.png`。
- `src/content/BattleAssetCatalog.ts`
  - 横版战斗角色资源目录、锚点、显示高度、动作帧数与命中帧配置。当前玩家映射角色77，数字掌门映射角色148。
- `src/systems/BattleAnimator.ts`
  - 旧 JYQXZ 战斗角色动画播放封装，作为未接入 batch frames 的兜底。
- `src/content/BattleSkillVisuals.ts`
  - 武功表现配置：单体/群攻、特效编号、特效大小、招式字、震动、命中停顿、等级阶段。
- `src/data/BattleData.ts`
  - 武功规则数据：基础威力、命中率、攻击距离、内力消耗、aoeSize。
- `src/content/PlayerMartialArts.ts`
  - 玩家武功成长规则：等级上限、升级熟练度、威力倍率。
- `src/config.ts`
  - 战斗棋盘缩放 `BATTLE_TILE_SCALE`、动画速度、回合间隔等全局常量。

## 战斗画面布局

当前战斗页面改为参考图式的“四角 HUD + 中心战场”：

- 中心：等距战斗棋盘、角色、移动范围、攻击范围、特效。
- 左上：玩家/敌人状态卡。
- 右上：战局、回合、按键提示。
- 左下：战斗记录。
- 右下：行动命令/武功选择。
- 底部中间：简易出手顺序条。
- 视觉原则：战斗地图是主角，HUD 是四角浮层；不要再做整条右侧后台面板。

如果要调整布局，优先改 `BattleSystem.ts` 中这些方法：

- `getBoardCenter()`：控制战斗棋盘中心点。
- `getBattleInfoRect()`：控制右上战局提示。
- `getStatusPanelRect(person)`：控制双方状态卡位置。
- `getLogPanelRect()`：控制左下战斗记录区域。
- `getCommandAreaRect()`：控制右下行动命令/武功选择区域。
- `renderHUD()`：控制四角 HUD、状态卡、日志和出手顺序条。
- `showActionMenu()` / `updateMenuHighlight()`：控制右下行动命令。
- `renderWugongMenu()`：控制右下武功卡片列表。

当前 HUD 的核心常量在 `BattleSystem.ts` 顶部：

```ts
const BATTLE_STATUS_PANEL_W = 360;
const BATTLE_STATUS_PANEL_H = 86;
const BATTLE_HUD_MARGIN = 16;
const BATTLE_COMMAND_COLS = 2;
const BATTLE_COMMAND_ITEM_H = 36;
const BATTLE_MOVE_STEP_DURATION = 260;
```

- 想让左上状态卡更宽/更高：调整 `BATTLE_STATUS_PANEL_W/H`。
- 想让四角 HUD 更贴边：调小 `BATTLE_HUD_MARGIN`。
- 想调整行动按钮：改 `BATTLE_COMMAND_COLS` 和 `BATTLE_COMMAND_ITEM_H`，再检查 `getCommandAreaRect()` 的高度是否够。
- 想移动日志区：改 `getLogPanelRect()` 的 `y` 和 `h`。
- 想让战斗走路更慢/更快：调整 `BATTLE_MOVE_STEP_DURATION`。

## 棋盘大小

棋盘大小由 `src/config.ts` 控制：

```ts
export const BATTLE_TILE_SCALE = 2.25;
```

调大后，棋盘和高亮格都会变大；如果太靠右或太靠左，需要同步调整 `BattleSystem.ts` 的 `getBoardCenter()`。

当前 `getBoardCenter()` 让棋盘回到屏幕中心，略向下压：

```ts
x: Math.round(SCREEN_WIDTH / 2)
y: Math.round(SCREEN_HEIGHT / 2 + 24)
```

如果以后底部 HUD 压住棋盘，可以把 `y` 调小；如果顶部标题压住棋盘，可以把 `y` 调大。

## 初始站位

玩家挑战 Agent 时，站位在 `BattleSystem.startPlayerVsAgent()` 中：

```ts
player: { x: 5, y: 8 }
enemy:  { x: 3, y: 1 }
```

这组坐标在等距投影下呈斜 45 度对位。注意：等距屏幕坐标大致为：

```txt
screenX ~= (x - y)
screenY ~= (x + y)
```

所以如果两个点的 `x + y` 相同，会看起来水平对位。

## 移动与碰撞

移动范围和路径在 `BattleSystem.ts`：

- `calcMoveRange()`：计算可移动格子，避开其他存活角色占据格。
- `calcMovePath()`：计算逐格移动路径，避免动画直线穿人。
- `animateMove()`：按路径逐格移动，同时播放 `16_walk/2501-2528` 走路帧。

当前走路帧配置在 `BattleActors.ts`：

```ts
walk: {
  upRight: { start: 2501, end: 2507, frameIntervalMs: 120, loop: true },
  downRight: { start: 2508, end: 2514, frameIntervalMs: 120, loop: true },
  upLeft: { start: 2515, end: 2521, frameIntervalMs: 120, loop: true },
  downLeft: { start: 2522, end: 2528, frameIntervalMs: 120, loop: true },
}
```

如果走路抖动太快/太慢，调 `frameIntervalMs`；如果每格移动太快导致看不到腿部动作，调 `BattleSystem.ts` 顶部的 `BATTLE_MOVE_STEP_DURATION`；如果角色走路时大小不合适，调 `walkScale`；停下后会自动恢复 `Fight000` 站立帧。

## 玩家属性同步

玩家进入战斗时由 `BattleData.ts#createPlayerBattlePerson()` 从长期档案创建战斗角色：

```ts
hp: progress.vitals.hp
maxHp: progress.vitals.maxHp
mp: progress.vitals.mp
maxMp: progress.vitals.maxMp
```

战斗结束后由 `BattleSystem.ts#syncPlayerVitalsAfterBattle()` 回写：

```ts
this.store.setPlayerVitals(hp, mp);
```

注意：现在生命/内力不再乘以 5。如果个人属性面板生命上限是 `100`，战斗 HUD 也应显示 `100`。

## 武功规则 vs 武功表现

武功拆成两层：

### 规则层：`BattleData.ts`

```ts
export const NORMAL_ATTACK: WugongDef = {
  id: 'normal_attack',
  name: '普通攻击',
  mpCost: 0,
  power: 40,
  hitRate: 90,
  attackRange: 1,
  effectId: '003',
  aoeSize: 1,
};
```

这些字段影响战斗规则：距离、伤害、命中、内力消耗。

### 表现层：`BattleSkillVisuals.ts`

```ts
normal_attack: {
  targetMode: 'single',
  rangeShape: 'diamond',
  effectId: '003',
  effectScale: 0.75,
  castText: '普通攻击',
  showCastText: false,
  hitStopMs: 50,
  cameraShake: false,
}
```

这些字段影响视觉：特效、招式字、缩放、震动、命中停顿。

## 普通攻击等级表现

普通攻击已配置等级阶段：

- Lv.1：`003`，小特效，不显示招式字。
- Lv.4：`004`，显示 `拳风初成`。
- Lv.7：`006`，显示 `拳劲纵横`，带震动。
- Lv.10：`009`，显示 `登峰一击`，更大特效、震动和更长命中停顿。

如需继续调特效，改 `BattleSkillVisuals.ts` 的 `tiers`。

## 建议后续优化

1. 给 `BattleAssetCatalog.ts` 增加更多 batch frame 角色映射，统一主角、掌门和后续敌人的动作规格。
2. 给 `BattleSkillVisuals.ts` 增加 `line`、`fan` 等范围形状。
3. 战斗菜单支持鼠标点击。
4. 物品菜单接入回血/回内力。
5. 战斗地板从单一瓦片升级为专用战斗场景背景。

## 横版战斗预览

开发模式下可以用 URL 直接进入战斗预览，方便截图验收：

```bash
npm run dev
# 打开 http://127.0.0.1:3456/?battlePreview=digital_master
```

## 构建验证

当前验证命令：

```bash
cd packages/visual && npm run build
```

当前状态：构建通过，无 Vite 大 chunk 警告。`vite.config.ts` 中保留：

```ts
chunkSizeWarningLimit: 2000
```

这是因为 Phaser 单页游戏运行时代码本身较大，当前阶段不做运行时代码拆包。
