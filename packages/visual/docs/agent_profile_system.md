# DeepSolo Agent 角色档案系统

## 概述

每个策略 Agent 拥有独立的目录和属性文件，战斗属性存储在 `battle.json` 中。属性直接影响战斗系统中的角色能力。衍生 Agent（策略杂交产生）的属性从父母之间随机插值生成。

## 数据文件结构

```
data/agents/
├── hv1/
│   ├── profile.json    — 身份信息（name, persona, category, parents...）
│   ├── battle.json     — 战斗属性（HP, MP, ATK, DEF, SPD, MV, 武功）
│   ├── strategy/       — 策略代码
│   └── memory/         — 记忆文件
├── hv2/
├── hv3/
├── hv4/
├── nv1/
├── nv2/
├── e3/                 — 衍生 Agent（无 battle.json 时从父母插值）
│   ├── profile.json
│   └── ...
...
```

## 前端代码结构

```
packages/visual/src/data/agents/
└── index.ts            — BattleStats 类型 + 加载逻辑 + 衍生算法
```

## battle.json 格式

```json
{
  "maxHp": 1000,
  "maxMp": 250,
  "attack": 50,
  "defense": 60,
  "speed": 30,
  "moveRange": 3,
  "wugongId": "jingang_fumo"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxHp` | number | 生命值 |
| `maxMp` | number | 内力值（释放武功消耗） |
| `attack` | number | 攻击力（影响伤害） |
| `defense` | number | 防御力（减少受伤） |
| `speed` | number | 轻功（决定回合出手顺序） |
| `moveRange` | number | 移动力（每回合可走格数） |
| `wugongId` | string | 专属武功 ID（对应 BattleData.ts 中的 WUGONG_DEFS） |

## 初始角色属性

| 策略 ID | 名称 | HP | MP | 攻击 | 防御 | 轻功 | 移动力 | 专属武功 | 定位 |
|---------|------|----|----|------|------|------|--------|----------|------|
| hv1 | 人气追涨 | 800 | 300 | 65 | 35 | 40 | 5 | 追魂剑法 | 均衡 |
| hv2 | 妖股追涨 | 600 | 400 | 75 | 25 | 55 | 6 | 疯魔杖法 | 高攻脆皮 |
| hv3 | 上影线追涨 | 750 | 350 | 55 | 45 | 35 | 4 | 太极拳 | 高防 |
| hv4 | 分时大票 | 1000 | 250 | 50 | 60 | 30 | 3 | 金刚伏魔功 | 肉盾坦克 |
| nv1 | 多信号综合 | 700 | 500 | 60 | 40 | 45 | 5 | 落英神剑掌 | 高内力 |
| nv2 | 早盘强势 | 850 | 300 | 70 | 30 | 50 | 5 | 独孤九剑 | 高攻 |

## 数据加载流程

```
BootScene.create()
  → preloadAgentProfiles()          // 并行 fetch 6 个 battle.json
    → battleCache (内存缓存)
  → this.scene.start('WorldScene')

战斗触发时:
  getAvailableFighterIds()           // 从 battleCache 返回已加载的 ID
  createBattlePerson(agentId, ...)   // 从 battleCache 读取属性
```

- `preloadAgentProfiles()` 在 BootScene 中调用，确保进入游戏前属性已就绪
- 数据从 `public/data/agents/` 加载（需从 `data/agents/` 同步）
- 使用内存缓存 `battleCache`，避免重复请求

## 衍生 Agent 属性生成

当两个策略杂交产生新策略时，通过 `deriveBattleStats()` 从父母之间随机生成：

### 算法

```typescript
deriveBattleStats(parentA, parentB, wugongId):
  对每项数值属性（HP/MP/ATK/DEF/SPD）:
    1. lerp: 随机权重 t ∈ [0,1]，取 parentA × (1-t) + parentB × t
    2. jitter: 在插值结果上 ± 随机偏移（HP±50, MP±30, ATK/DEF±5, SPD±3）
    3. 下限保护: 所有属性 ≥ 1，移动力限制在 [2, 6]

  移动力: lerp 后 clamp(2, 6)
  武功: 从全部武功列表中随机选择
```

### 示例

```
父母: hv2 (ATK75, DEF25) × hv4 (ATK50, DEF60)
  → t=0.3 → ATK = 75×0.7 + 50×0.3 = 67.5 → jitter +3 → 71
  → t=0.6 → DEF = 25×0.4 + 60×0.6 = 46   → jitter -2 → 44
```

### 回退策略

如果衍生 Agent 的父母中至少一方没有 `battle.json`，则使用完全随机属性：
- HP: 600~1000
- MP: 200~500
- ATK: 40~80
- DEF: 20~60
- SPD: 25~60
- MV: 3~6
- 武功: 随机

## 公共 API

### `preloadAgentProfiles(): Promise<void>`

预加载所有基础 Agent 的 battle.json 到内存缓存。

### `getBattleStats(id: string): BattleStats | undefined`

获取指定 Agent 的战斗属性（从缓存）。

### `getKnownAgentIds(): string[]`

返回所有已加载属性的 Agent ID 列表。

### `loadBattleStats(id: string): Promise<BattleStats | undefined>`

加载单个 Agent 的 battle.json（衍生 Agent 可能在运行时出现时使用）。

### `deriveBattleStats(parentA, parentB, wugongId): BattleStats`

从父母属性生成衍生属性。

## 与战斗系统的关系

```
data/agents/{id}/battle.json ──→ public/data/agents/ ──→ preloadAgentProfiles()
                                                              ↓
                                                         battleCache
                                                              ↓
                                                    BattleData.ts (createBattlePerson)
                                                              ↓
                                                    BattleSystem.ts (战斗引擎)
```

## 扩展方式

**新增基础 Agent**：在 `data/agents/{id}/` 下创建目录，添加 `profile.json` 和 `battle.json`，然后同步到 `public/data/agents/`。

**新增衍生 Agent**：无需手动添加 `battle.json`，系统自动从父母属性插值生成。也可事后补 `battle.json` 固化属性。

**新增属性维度**：在 `battle.json` 中添加新字段，在 `agents/index.ts` 的 `BattleStats` 接口中添加对应字段，在 `deriveBattleStats()` 中补充插值逻辑。

**属性挂钩策略表现**：后续可在 `BattleStats` 基础上添加动态修正函数，根据 `returnPct`、`winRate` 等实时数据调整战斗属性。
