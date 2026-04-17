# DeepSolo 战斗系统设计

> 直接搬 JYQXZ（金庸群侠传）的回合制战棋：武侠属性、武功、特效。
> 策略 NPC = 武侠角色，每策略一个武功 + 普通攻击，固定一张战场地图。
> MVP 目标：能打、能掉血、能打完一整场。

---

## 1. JYQXZ 战斗系统原貌

### 1.1 核心循环（`WarMain()` at jywar.lua:9365）

```
WarMain(warid)
  ├─ WarLoad(warid)           // 加载战斗数据
  ├─ WarSelectTeam()          // 选择我方角色
  ├─ WarSelectEnemy()         // 选择敌方角色
  ├─ WarLoadMap(mapId)        // 加载战场地图（64x64 等距网格）
  ├─ WarPersonSort()          // 按轻功排序（决定行动顺序）
  │
  └─ while true:              // ★ 主循环
       ├─ 遍历所有 Person:
       │   ├─ Person.Time += 轻功值
       │   ├─ if Time > 1000:  // 该角色行动
       │   │   ├─ 计算移动范围（BFS 扩散）
       │   │   ├─ 选择行动（手动/自动 AI）
       │   │   │   ├─ 移动 → War_MovePerson()
       │   │   │   ├─ 攻击 → War_Fight_Sub() → War_WugongHurtLife()
       │   │   │   ├─ 用药 / 医疗 / 休息
       │   │   │   └─ 自动 AI → War_Think() 决策树
       │   │   ├─ 播放战斗动画 → War_ShowFight()
       │   │   └─ Person.Time -= 1000
       │   └─ War_isEnd()      // 检查是否一方全灭
       └─ WarPersonSort()      // 重新排序
```

### 1.2 角色属性（`CC.Person_S`，每角色 182 字节）

| 属性 | 字段 | 说明 |
|------|------|------|
| 生命 | HP / 生命最大值 | 归零 = 死亡 |
| 内力 | MP / 内力最大值 | 释放武功消耗 |
| 攻击力 | 攻击 | 基础伤害系数 |
| 防御力 | 防御 | 减伤系数 |
| 轻功 | 轻功 | 决定行动顺序 + 移动范围 |
| 攻击范围 | 攻击力 | 攻击距离 |
| 医疗能力 | 医疗能力 | 治疗量 |
| 抗毒/抗乱/抗伤 | 抗毒能力/抗混乱能力/抗内伤能力 | 状态抗性 |
| 拳掌/御剑/耍刀/特殊/兵器 | 五系功夫等级 | 影响对应武功伤害 |
| 武功1~10 | 武功i / 武功等级i | 角色所会武功及其等级 |
| 等级 | 等级 | 角色等级 |
| 经验 | 经验 | 升级用 |

### 1.3 武功数据（`CC.Wugong_S`，每武功 136 字节）

| 属性 | 说明 |
|------|------|
| 名称 | 武功名 |
| 音效 | 播放音效 ID |
| 武功类型 | 拳掌=0, 利剑=1, 耍刀=2, 特殊=3, 内功=4, 吸星=5,解毒=6, 医疗=7 |
| 伤害类型 | 0=纯伤害, 1=吸内力, 2=吸生命, ... |
| 攻击范围 | 攻击范围形状 |
| 内力消耗下限 | 最低内力要求 |
| 攻击范围带毒概率 | 附加中毒概率 |
| 等级1~10 | 每级: 威力, 移动范围, 杀伤范围, 准确率, 杀人数 |

### 1.4 伤害公式（`War_WugongHurtLife()` at line 1287）

```
简化版核心逻辑:

1. 有效武功等级 = min(角色等级要求, 当前等级)
2. 基础伤害 = 武功威力[等级]
3. 内功反伤判定（被攻击方有内功类武功时概率触发）
4. 最终伤害受 攻击力/防御力/武功类型/随机浮动 影响
5. 暴击/连击/反击 等特殊判定
```

### 1.5 战场地图（WMap，7 层）

| 层 | 内容 |
|-----|------|
| 0 | 地面瓦片 |
| 1 | 建筑/障碍 |
| 2 | 角色索引（-1=空） |
| 3 | 移动消耗（255=不可通行） |
| 4 | 攻击效果叠加 |
| 5 | 角色朝向 |
| 6 | 阵营标记 |

### 1.6 移动系统

- `War_CalMoveStep()` — BFS 扩散计算移动范围
- `War_MovePerson()` — 按路径逐步移动精灵
- 移动力 = f(轻功) - 中毒/受伤 debuff，最小为 1

---

## 2. DeepSolo 战斗系统 MVP

### 2.1 目标

在 DeepSolo 的 Phaser 3 像素世界中实现 JYQXZ 风格的回合制战棋：

1. 两个策略 Agent 在固定战场地图上对打
2. 每个角色有 JYQXZ 式属性（生命/内力/攻击/防御/轻功）
3. 每个角色一个专属武功 + 普通攻击
4. 自动 AI 对战（观察者观战）
5. 打到一方 HP≤0 → 战斗结束 → 显示结算

### 2.2 简化范围（MVP 不做）

- 不做：手动操控、物品使用、毒/混乱等状态、合击、反击、轻功跑动
- 不做：内功反伤系统、连击系统、阵法系统
- 不做：地图障碍物移动限制（先用平地）
- 不做：经验升级（后续再做）

---

## 3. 数据模型

### 3.1 战斗角色属性

直接沿用 JYQXZ 的属性体系，每个策略 Agent 内置一组初始属性：

```typescript
// types.ts 新增

/** 战斗角色 — 直接沿用 JYQXZ 属性体系 */
export interface BattlePerson {
  id: string;                // Agent ID
  name: string;              // 显示名
  team: 'red' | 'blue';     // 阵营

  // ── JYQXZ 式基础属性 ──
  hp: number;                // 当前生命
  maxHp: number;             // 生命上限
  mp: number;                // 当前内力
  maxMp: number;             // 内力上限
  attack: number;            // 攻击力
  defense: number;           // 防御力
  speed: number;             // 轻功（决定行动顺序和移动范围）
  moveRange: number;         // 移动力（每回合可移动格数）

  // ── 武功 ──
  wugong: WugongDef;         // 专属武功
  // 普通攻击内置，不需定义

  // ── 战斗状态 ──
  pos: { x: number; y: number };   // 战场坐标
  facing: Direction;                // 朝向
  alive: boolean;                   // 是否存活
}
```

### 3.2 武功定义

```typescript
/** 武功定义 — 沿用 JYQXZ 武功结构（简化版） */
export interface WugongDef {
  id: string;
  name: string;              // 如"六脉神剑""降龙十八掌"
  type: WugongType;          // 拳掌/剑/刀/特殊/内功
  mpCost: number;            // 内力消耗
  power: number;             // 威力
  hitRate: number;           // 命中率 (0~100)
  attackRange: number;       // 攻击距离（格子数）
  effectId: string;          // 特效 ID（用于播放动画）
}

export enum WugongType {
  Fist = 0,       // 拳掌
  Sword = 1,      // 御剑
  Blade = 2,      // 耍刀
  Special = 3,    // 特殊
  Neigong = 4,    // 内功
}
```

### 3.3 普通攻击

每个角色都有，不消耗内力，固定参数：

```typescript
const NORMAL_ATTACK: WugongDef = {
  id: 'normal_attack',
  name: '普通攻击',
  type: WugongType.Fist,
  mpCost: 0,
  power: 40,
  hitRate: 90,
  attackRange: 1,       // 只能打相邻格
  effectId: 'fx_normal',
};
```

### 3.4 初始属性表

6 个基础策略 Agent 的内置初始属性（硬编码，平衡设计）：

| Agent | 生命 | 内力 | 攻击 | 防御 | 轻功 | 移动 | 专属武功 | 武功类型 |
|-------|------|------|------|------|------|------|----------|----------|
| 人气追涨 | 800 | 300 | 65 | 35 | 40 | 5 | 追魂剑法 | 剑 |
| 妖股追涨 | 600 | 400 | 75 | 25 | 55 | 6 | 疯魔杖法 | 特殊 |
| 上影线追涨 | 750 | 350 | 55 | 45 | 35 | 4 | 太极拳 | 拳掌 |
| 分时大票 | 1000 | 250 | 50 | 60 | 30 | 3 | 金刚伏魔功 | 内功 |
| 多信号综合 | 700 | 500 | 60 | 40 | 45 | 5 | 落英神剑掌 | 拳掌 |
| 早盘强势 | 850 | 300 | 70 | 30 | 50 | 5 | 独孤九剑 | 剑 |

衍生 NPC 属性：继承父母平均 + 随机偏移 ±10%

### 3.5 专属武功详表

```typescript
const WUGONG_DEFS: Record<string, WugongDef> = {
  'zhuihun_jian': {
    id: 'zhuihun_jian', name: '追魂剑法', type: WugongType.Sword,
    mpCost: 30, power: 120, hitRate: 85, attackRange: 2, effectId: 'fx_sword_1',
  },
  'fengmo_zhang': {
    id: 'fengmo_zhang', name: '疯魔杖法', type: WugongType.Special,
    mpCost: 40, power: 150, hitRate: 75, attackRange: 1, effectId: 'fx_blunt_1',
  },
  'taiji_quan': {
    id: 'taiji_quan', name: '太极拳', type: WugongType.Fist,
    mpCost: 25, power: 90, hitRate: 95, attackRange: 1, effectId: 'fx_fist_1',
  },
  'jingang_fumo': {
    id: 'jingang_fumo', name: '金刚伏魔功', type: WugongType.Neigong,
    mpCost: 50, power: 100, hitRate: 90, attackRange: 3, effectId: 'fx_neigong_1',
  },
  'luoying_shenjian': {
    id: 'luoying_shenjian', name: '落英神剑掌', type: WugongType.Fist,
    mpCost: 35, power: 130, hitRate: 80, attackRange: 2, effectId: 'fx_fist_2',
  },
  'dugu_jiujian': {
    id: 'dugu_jiujian', name: '独孤九剑', type: WugongType.Sword,
    mpCost: 45, power: 160, hitRate: 80, attackRange: 2, effectId: 'fx_sword_2',
  },
};
```

---

## 4. 战场地图

### 4.1 固定单张地图

一张 10×10 的等距瓦片战场，平地无障碍。用 DeepSolo 现有的等距瓦片渲染。

```
坐标体系（左上为 0,0）:

    0  1  2  3  4  5  6  7  8  9
  ┌─────────────────────────────┐
0 │  .  .  .  R  R  .  .  .  . │  红方出生区 (0,3)(0,4)
1 │  .  .  .  .  .  .  .  .  . │
2 │  .  .  .  .  .  .  .  .  . │
3 │  .  .  .  .  .  .  .  .  . │
4 │  .  .  .  .  .  .  .  .  . │
5 │  .  .  .  .  .  .  .  .  . │
6 │  .  .  .  .  .  .  .  .  . │
7 │  .  .  .  .  .  .  .  .  . │
8 │  .  .  .  .  .  .  .  .  . │
9 │  .  .  .  B  B  .  .  .  . │  蓝方出生区 (9,3)(9,4)
  └─────────────────────────────┘

红方初始位置: (1,3), (1,4)
蓝方初始位置: (8,3), (8,4)
（1v1 时只用一组，2v2 时两组都上）
```

### 4.2 地图渲染

复用 DeepSolo 现有的 `IsoProjection` + 等距瓦片系统，只是换一套战场瓦片资源：

- 地面：浅色石砖瓦片（从 JYQXZ 的 `wmap` 资源中提取）
- 边框：战场边界标识
- 格子高亮：移动范围（蓝色）、攻击范围（红色）

---

## 5. 伤害计算

### 5.1 简化公式

参考 JYQXZ `War_WugongHurtLife()`，简化为：

```
基础伤害 = 武功威力 * (攻击方.attack / (攻击方.attack + 防御方.defense + 50))

命中判定 = random(100) < 武功.hitRate

内力判定 = 攻击方.mp >= 武功.mpCost（不够则降级为普通攻击）

随机波动 = 0.85 + random(0.30)    // ±15%

最终伤害 = round(基础伤害 * 随机波动)  // 命中时
最终伤害 = 0                          // 未命中时

最低保底伤害 = 1（命中时）
```

### 5.2 伤害数字弹出

命中后在目标头上弹出伤害数字（红色/白色），持续 800ms 后消失。
暴击（伤害 > 基础伤害 * 1.2）时显示金色大字"暴击"。

---

## 6. AI 决策

### 6.1 简化版决策树（参考 JYQXZ `War_Think()`）

```typescript
function battleAI(person: BattlePerson, battle: BattleState): BattleAction {
  const enemy = getNearestEnemy(person, battle);

  // 1. 如果敌人不在攻击范围内 → 朝敌人移动
  const dist = manhattanDist(person.pos, enemy.pos);
  if (dist > person.wugong.attackRange) {
    return { type: 'move', target: moveToward(person, enemy, battle) };
  }

  // 2. 敌人在攻击范围内
  // 2a. 内力充足 → 使用专属武功
  if (person.mp >= person.wugong.mpCost) {
    return { type: 'attack', skill: person.wugong, targetId: enemy.id };
  }

  // 2b. 内力不足 → 使用普通攻击
  return { type: 'attack', skill: NORMAL_ATTACK, targetId: enemy.id };
}
```

### 6.2 移动策略

```typescript
function moveToward(person: BattlePerson, enemy: BattlePerson, battle: BattleState): Point {
  // BFS 计算可达范围
  const reachable = calcMoveRange(person.pos, person.moveRange, battle.map);

  // 选择离敌人最近的可达点
  let best = person.pos;
  let bestDist = Infinity;
  for (const pos of reachable) {
    const d = manhattanDist(pos, enemy.pos);
    if (d < bestDist) {
      bestDist = d;
      best = pos;
    }
  }
  return best;
}
```

---

## 7. 战斗流程

### 7.1 完整时序

```
1. 战斗触发
   ├─ 选择两个 Agent（手动或自动匹配）
   ├─ 构建 BattlePerson（从内置属性表读取）
   └─ 初始化战场

2. 进入战斗场景 (ArenaScene)
   ├─ 显示战场地图
   ├─ 放置双方角色精灵
   ├─ 显示双方信息面板
   └─ "战斗开始！" 提示

3. 回合循环 (while !isEnd)
   ├─ 按轻功排序确定行动顺序
   │
   ├─ 角色行动:
   │   ├─ AI 决策（move + attack）
   │   ├─ 播放移动动画（tween 精灵移到目标格）
   │   ├─ 播放攻击动画（角色朝向 + 挥动帧）
   │   ├─ 计算伤害 → 目标 HP 扣减
   │   ├─ 显示伤害数字弹出
   │   ├─ 显示气泡台词（如"吃我一剑！"）
   │   ├─ 更新 HP/MP 条
   │   └─ 等待动画播放完毕
   │
   ├─ 检查胜负:
   │   ├─ 一方 HP ≤ 0 → 战斗结束
   │   └─ 双方都活 → 下一角色行动
   │
   └─ 所有角色行动完 → 新一轮重新排序

4. 战斗结束
   ├─ 显示胜负画面（胜者名字 + 统计）
   ├─ 记录事件到 events.json
   ├─ 等 3 秒
   └─ 返回世界地图
```

### 7.2 胜负条件

```typescript
function checkBattleEnd(persons: BattlePerson[]): BattleResult | null {
  const redAlive = persons.filter(p => p.team === 'red' && p.alive);
  const blueAlive = persons.filter(p => p.team === 'blue' && p.alive);

  if (redAlive.length === 0) return { winner: 'blue', loser: 'red' };
  if (blueAlive.length === 0) return { winner: 'red', loser: 'blue' };
  return null; // 继续打
}
```

### 7.3 伪代码（主循环）

```typescript
async function runBattle(red: BattlePerson, blue: BattlePerson): Promise<BattleResult> {
  const persons = [red, blue];

  // 初始放置
  red.pos = { x: 1, y: 4 };
  blue.pos = { x: 8, y: 4 };

  while (true) {
    // 按轻功排序（高先动）
    persons.sort((a, b) => b.speed - a.speed);

    for (const person of persons) {
      if (!person.alive) continue;

      // AI 决策
      const action = battleAI(person, { persons });

      // 执行移动
      if (action.type === 'move') {
        await playMoveAnimation(person, action.target);
        person.pos = action.target;
      }

      // 执行攻击
      if (action.type === 'attack') {
        const target = persons.find(p => p.id === action.targetId)!;
        await playAttackAnimation(person, target, action.skill);

        // 伤害计算
        const damage = calcDamage(person, target, action.skill);
        if (damage > 0) {
          target.hp = Math.max(0, target.hp - damage);
          await showDamageNumber(target, damage);
        } else {
          await showMiss(target);
        }

        // 消耗内力
        person.mp = Math.max(0, person.mp - action.skill.mpCost);

        // 更新 UI
        updateHPBar(target);
        updateMPBar(person);

        // 检查死亡
        if (target.hp <= 0) {
          target.alive = false;
          await playDeathAnimation(target);
        }
      }

      // 检查胜负
      const result = checkBattleEnd(persons);
      if (result) return result;
    }
  }
}
```

---

## 8. 战斗场景 UI

### 8.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│ [红方头像]  人气追涨        VS        分时大票  [蓝方头像]   │
│ HP ████████████░░░  85%          HP ██████████░░░░  72%      │
│ MP ██████░░░░░░░░  42%          MP █████████░░░░░  55%      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                      10 × 10 等距战场                        │
│                                                              │
│          🔴(红方精灵)                         🔵(蓝方精灵)   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 回合 3  │  人气追涨 使用 [追魂剑法]！造成 87 伤害！         │
│         │  分时大票 使用 [普通攻击]！造成 32 伤害！          │
│         │  分时大票 HP: 613 → 526                            │
├──────────────────────────────────────────────────────────────┤
│                    [退出观战]  [加速 1x/2x]                   │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 视觉元素

| 元素 | 实现方式 |
|------|----------|
| 战场地图 | 等距瓦片（复用 IsoProjection） |
| 角色精灵 | 复用现有 Agent 精灵图 |
| HP/MP 条 | Phaser Graphics（矩形 + 颜色填充） |
| 移动动画 | Phaser Tween（精灵位移） |
| 攻击动画 | 精灵换帧（攻击帧） + 目标闪红 |
| 伤害数字 | BitmapText 弹出（tween y + alpha） |
| 气泡台词 | 复用 BubbleFactory |
| 战斗日志 | 底部文本框滚动显示 |

### 8.3 战斗结束画面

```
┌────────────────────────────┐
│                            │
│      ★ 战斗结束 ★          │
│                            │
│   🏆 胜者：人气追涨        │
│                            │
│   总回合：12               │
│   造成伤害：876            │
│   承受伤害：423            │
│   使用武功：追魂剑法 x5    │
│                            │
│   [点击返回]               │
│                            │
└────────────────────────────┘
```

---

## 9. EventBus 事件

```typescript
// 新增到 GameEvents

'battle:start': {
  battleId: string;
  red: BattlePerson;
  blue: BattlePerson;
};
'battle:action': {
  battleId: string;
  actorId: string;
  action: BattleAction;
  result: {
    damage: number;
    hit: boolean;
    targetHp: number;
    targetAlive: boolean;
  };
};
'battle:end': {
  battleId: string;
  winnerId: string;
  loserId: string;
  rounds: number;
};
```

---

## 10. 文件结构

```
packages/visual/src/
├── scenes/
│   └── ArenaScene.ts              # 新增：战斗场景（Phaser Scene）
├── systems/
│   └── BattleSystem.ts            # 新增：战斗引擎（循环+伤害+AI）
├── data/
│   ├── BattleData.ts              # 新增：初始属性表 + 武功表
│   └── ArenaMapData.ts            # 新增：固定战场地图数据
├── ui/
│   └── BattleUI.ts                # 新增：战斗 HUD
└── types.ts                       # 修改：新增 BattlePerson, WugongDef 等
```

后端（MVP 不需要，战斗完全在前端运行）：

```
scripts/
└── trigger_battle.py              # 新增：手动触发战斗的脚本（写入 events.json）
```

---

## 11. 触发方式

### MVP 阶段

1. **键盘快捷键**：在世界地图按 `B` 键，随机选两个 Agent 进入战斗
2. **脚本触发**：`python scripts/trigger_battle.py hv1 hv4`

### 后续

3. 竞技场建筑入口
4. 后端定时排位匹配
5. 讨论衍生前切磋

---

## 12. 实现步骤（MVP）

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | `types.ts` 新增 `BattlePerson`, `WugongDef` 等类型 | 无 |
| 2 | `BattleData.ts` 内置 6 个策略的初始属性 + 6 个武功定义 | 1 |
| 3 | `ArenaMapData.ts` 固定 10x10 战场数据 | 无 |
| 4 | `BattleSystem.ts` 核心引擎：回合循环 + 伤害计算 + AI | 1 |
| 5 | `ArenaScene.ts` 战斗场景：地图渲染 + 精灵放置 + HP条 | 2,3,4 |
| 6 | `BattleUI.ts` 战斗 HUD：信息面板 + 战斗日志 | 5 |
| 7 | 移动动画 + 攻击动画 + 伤害数字弹出 | 5 |
| 8 | 战斗结束画面 + 返回世界地图 | 5 |
| 9 | 世界地图按 `B` 触发入口 | 8 |
