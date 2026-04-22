# 金庸群侠传（JYQXZ）剧情系统完整分析

## 一、整体架构

JYQXZ 是一个 **Lua 脚本驱动的 RPG 引擎**，C/C++ 核心（LDCR_WIN.exe）通过 `lib` 命名空间暴露底层 API（渲染、文件 I/O、输入）给 Lua 层。所有游戏逻辑——剧情、对话、事件、战斗、菜单——全部用 Lua 编写。

系统有**两代事件脚本**：
- **旧版二进制事件系统**（`readkdef.lua`）：解码并执行字节码式的指令，数据存储在 `kdef.grp/kdef.idx`
- **新版 Lua 事件系统**（`CEvent/*.lua`）：每个事件一个独立的 Lua 脚本，通过 `dofile()` 加载

引擎优先尝试新版 Lua 脚本，找不到则回退到旧版二进制。

## 二、目录结构

```
Release/
├── CONFIG.lua              -- 配置（路径、分辨率、按键绑定）
└── SCRIPT/
    ├── jymain.lua          -- 主游戏循环、所有 instruct_* 函数、对话、UI（~5981 行）
    ├── jyconst.lua         -- 常量、数据结构、人物定义（~1228 行）
    ├── jywar.lua           -- 战斗系统（~12882 行）
    ├── readkdef.lua        -- 旧版二进制事件解释器（~997 行）
    ├── MyOEvent.lua        -- 自定义事件函数（传送、练功、装备等，~884 行）
    ├── AStar.lua           -- A* 寻路（~314 行）
    └── CEvent/             -- 103 个独立剧情事件脚本
        ├── 691.lua         -- 新游戏开场
        ├── 2002.lua        -- 开场过场动画
        ├── 301.lua         -- 大型剧情推进（38KB，最大脚本）
        ├── 4100.lua        -- 多条件奖励分发（27KB）
        ├── 8001-8018.lua   -- 段誉任务链
        ├── 8201-8208.lua   -- 故事事件
        ├── 8301-8306.lua   -- 故事事件
        ├── 8601-8615.lua   -- 大型任务线
        └── ...             -- 约 100 个其他事件脚本

DATA/
├── talk.grp / talk.idx     -- 对话文本数据（二进制编码，4024 条对话）
├── kdef.grp / kdef.idx     -- 旧版事件指令数据（1089 个事件）
├── Alldef.grp / Alldef.idx -- 场景事件定义数据（D* 记录）
├── Allsin.grp / Allsin.idx -- 场景地图数据（S* 记录）
├── Mmap.grp / Mmap.idx     -- 主地图瓦片
├── SMAP.GRP / SMAP.IDX     -- 子场景瓦片
├── WMAP.GRP / WMAP.IDX     -- 战斗地图瓦片
├── THING.GRP / THING.IDX   -- 物品图形
├── War.sta                 -- 战斗配置
└── eft/ fight/ head/       -- 特效/战斗/头像子目录
```

## 三、游戏状态机

```lua
GAME_START     = 0   -- 开始菜单
GAME_FIRSTMMAP = 1   -- 首次显示主地图
GAME_MMAP      = 2   -- 主地图（世界地图导航）
GAME_FIRSTSMAP = 3   -- 首次显示子场景
GAME_SMAP      = 4   -- 子场景（室内、城镇、迷宫，大部分剧情在此发生）
GAME_WMAP      = 5   -- 战斗地图
GAME_DEAD      = 6   -- 游戏结束
GAME_END       = 7   -- 退出
```

主循环 `Game_Cycle()`（jymain.lua 第 663 行）根据 `JY.Status` 分发到 `Game_MMap()` 或 `Game_SMap()`。

## 四、S/D 数据系统（核心状态追踪）

这是剧情系统的**核心数据基础设施**。

### S-data（场景地图数据）

每个场景有 4 层瓦片网格：

| 层 | 内容 |
|----|------|
| Level 0 | 地面瓦片图索引 |
| Level 1 | 建筑/物体瓦片（非零=不可通过） |
| Level 2 | 建筑辅助数据 |
| Level 3 | **事件 ID**（-1=无事件，≥0=D-data 中的事件索引） |

```lua
GetS(scene_id, x, y, level)    -- 读取
SetS(scene_id, x, y, level, v) -- 写入
```

### D-data（动态事件数据）

每个场景有 200 个 D 记录，每个记录 11 个字段：

| 字段 | 内容 |
|------|------|
| D[0] | 阻挡标志（0=可通过，非零=阻挡） |
| D[1] | 未使用 |
| D[2] | **空格键触发的事件脚本 ID** |
| D[3] | **物品使用触发的事件脚本 ID** |
| D[4] | **踩上去触发的事件脚本 ID** |
| D[5] | 动画起始帧 |
| D[6] | 动画结束帧 |
| D[7] | 当前动画帧 |
| D[8] | 动画延迟 |
| D[9] | S-map 上的 X 坐标 |
| D[10] | S-map 上的 Y 坐标 |

```lua
GetD(scene_id, event_id, field_index)
SetD(scene_id, event_id, field_index, value)
```

### 剧情状态追踪模式

用特定场景的 S-data 格子当"全局变量"：

```lua
-- 标记"华山论剑已完成"
SetS(10, 0, 7, 0, 1)

-- 后续事件检查，防止重复触发
if GetS(10, 0, 7, 0) == 1 then return end
```

这种模式将 S-data 基础设施同时用于地图数据和持久化故事标记——特定的"离屏"场景（如场景 10）作为布尔标记和计数器的暂存空间。

## 五、事件触发系统

### 三种触发方式

| 触发类型 | flag | 说明 | 代码位置 |
|----------|------|------|----------|
| **空格键** | 1 | 面对NPC/物体按空格 | Game_SMap 第 2087 行 |
| **物品使用** | 2 | 对着某处使用物品 | D[3] 字段 |
| **踩上去** | 3 | 走到特定格子 | Game_SMap 第 2019 行 |

### 空格键触发（面对 NPC 按空格）

```lua
-- Game_SMap() 第 2087 行
elseif keypress == VK_SPACE or keypress == VK_RETURN then
    if JY.Base["人物方向"] >= 0 then
        -- 读取面前格子的 S-data 层3（事件ID）
        local d_num = GetS(JY.SubScene,
                          JY.Base["主X1"] + CC.DirectX[JY.Base["人物方向"]+1],
                          JY.Base["主Y1"] + CC.DirectY[JY.Base["人物方向"]+1], 3)
        if d_num >= 0 then
            EventExecute(d_num, 1)   -- flag=1 表示空格键触发
        end
    end
```

### 踩上去触发（走到事件格子）

```lua
-- Game_SMap() 第 2019 行
local d_pass = GetS(JY.SubScene, JY.Base["主X1"], JY.Base["主Y1"], 3)
if d_pass >= 0 then
    if d_pass ~= JY.OldDPass then
        EventExecute(d_pass, 3)   -- flag=3 表示踩上去
        JY.OldDPass = d_pass
    end
end
```

### 事件执行链

```
EventExecute(id, flag)
  ├─ JY.SceneNewEventFunction[sceneId](flag)   -- 优先：自定义场景处理器
  └─ oldEventExecute(flag)                      -- 默认路径
       └─ eventnum = GetD(scene, currentD, flag+1)
            ├─ CallCEvent(eventnum)             -- 优先：Lua 脚本
            │    └─ dofile("CEvent/{eventnum}.lua")
            └─ oldCallEvent(eventnum)            -- 回退：二进制 KDEF
                 └─ ReadKDEF(eventnum)           -- 解码执行字节码
```

### NEvent 自定义事件钩子

除了 S/D 数据驱动的事件，还有一套 NEvent 系统：

```lua
-- jymain.lua 第 5753 行
function NEvent(keypress)
    NEvent2(keypress)   -- 场景70：拾得兵器
    NEvent3(keypress)   -- 场景24：医术学习
    NEvent4(keypress)   -- 场景7：降龙十二掌
    NEvent5(keypress)   -- 场景28：山洞事件
    NEvent6(keypress)   -- 场景10/59：地图调整
    NEvent7(keypress)   -- 场景80：华山论剑
    NEvent8(keypress)   -- 场景43：战后奖励
    NEvent9(keypress)   -- 场景25：少林
    NEvent10(keypress)  -- 场景25：特殊SYP事件
    NEvent11(keypress)  -- 场景104：蝴蝶岛
    NEvent12(keypress)  -- 场景95：装备清理
end
```

`NEvent()` 在每次 `Game_SMap` 移动后调用（第 2127 行），每个 NEvent 函数检查**场景+位置+方向+按键+剧情标记+物品**的组合条件。

## 六、对话系统

### 三代对话函数

#### 1. `instruct_1(talkid, headid, flag)` — 旧版二进制对话

```lua
function instruct_1(talkid, headid, flag)
    local s = ReadTalk(talkid)    -- 从 talk.grp 读取文本
    TalkEx(s, headid, flag)       -- 显示对话框
end
```

`ReadTalk(id)` 从二进制文件读取文本，解码方式：`byte = 255 - (byte % 256)`。

#### 2. `TalkEx(s, headid, flag)` — 标准对话显示

- `s`：文本字符串，`*` 为换行符
- `headid`：角色头像 ID
- `flag`：0-5，控制对话框位置（上左/下右/上右/下左等）
- 每页显示 3 行，按任意键翻页
- 文字**即时显示**（无打字效果）

#### 3. `say(s, pid, flag, name)` — 高级打字机对话

这是新版事件脚本的主要对话函数：

```lua
say("对话文本", personId, positionFlag, "角色名")
```

支持的**内联控制字符**：

| 控制符 | 功能 |
|--------|------|
| `*` | 换行 |
| 特殊字符1 | 清屏换页 |
| 特殊字符2 | 显示并等待按键 |
| 速度控制符 | 10 个等级，控制打字延迟（0~450ms） |
| 颜色控制符 | 红/金/黑/白/橙 五种颜色 |
| 字体控制符 | 宋/黑/楷 三种字体 |
| 名字替换符 | `他`→玩家名，`我`→说话者名 |

**逐字打字机效果**：每个字符按设定延迟逐个显示。

#### 4. UI 辅助函数

| 函数 | 说明 |
|------|------|
| `DrawStrBox(x, y, str, color, size)` | 简单文本框 |
| `DrawStrBoxWaitKey(s, color, size)` | 显示文本，等待按键 |
| `DrawStrBoxYesNo(x, y, str, color, size)` | 是/否选择框，返回 true/false |
| `JYMsgBox(title, str, button, num, headid, isEsc)` | 多按钮对话框 |
| `ShowMenu(menuItem, numItem, ...)` | 通用菜单 |
| `QZXS(s)` | 金色通知文本（"重要消息"） |

## 七、指令系统（instruct_* 脚本原语）

### 核心指令一览

| 指令 | 函数签名 | 说明 |
|------|----------|------|
| `instruct_0` | `()` | 清屏 |
| `instruct_1` | `(talkid, headid, flag)` | 显示对话（从二进制读取） |
| `instruct_2` | `(thingid, num)` | 获得/失去物品（显示消息） |
| `instruct_3` | `(sceneid, id, v0..v10)` | **修改事件数据**（最重要的指令） |
| `instruct_5` | `()` | 是/否选择（"是否讲和？"） |
| `instruct_6` | `(warid, ...)` | **进入战斗** |
| `instruct_9` | `()` | 是/否选择（"是否加入？"） |
| `instruct_10` | `(personid)` | 加入队伍 |
| `instruct_11` | `()` | 通用是/否选择 |
| `instruct_13` | `()` | 淡入（从黑屏） |
| `instruct_14` | `()` | 淡出（到黑屏） |
| `instruct_15` | `()` | 游戏结束 |
| `instruct_16` | `(personid)` | 检查是否在队伍中（`inteam()`） |
| `instruct_17` | `(scene, level, x, y, v)` | 设置 S-map 瓦片值 |
| `instruct_18` | `(thingid)` | 检查是否拥有物品 |
| `instruct_19` | `(x, y)` | 设置玩家位置 |
| `instruct_20` | `()` | 检查队伍是否已满 |
| `instruct_21` | `(personid)` | 离开队伍 |
| `instruct_25` | `(x1, y1, x2, y2)` | 镜头平滑移动 |
| `instruct_27` | `(id, startpic, endpic)` | 播放 NPC 动画 |
| `instruct_30` | `(x1, y1, x2, y2)` | 移动玩家（带走路动画） |
| `instruct_33` | `(personid, wugongid, flag)` | 学习/遗忘武功 |
| `instruct_37` | `(v)` | 增减道德值 |
| `instruct_38` | `(scene, level, oldpic, newpic)` | 替换场景瓦片（开门、变化等） |
| `instruct_39` | `(sceneid)` | 开启场景入口 |
| `instruct_40` | `(direction)` | 设置玩家朝向 |
| `instruct_41` | `(personid, thingid, num)` | 修改角色携带物品 |
| `instruct_47` | `(id, value)` | 增加攻击力 |
| `instruct_58` | `()` | 擂台赛（5 轮淘汰） |
| `instruct_64` | `()` | 商店系统 |
| `instruct_66` | `(id)` | 播放 MIDI 音乐 |

### 指令 50（扩展指令集）

`instruct_50` 是最复杂的指令，包含 44 个子操作码（`newinstruct_50_sub[0..43]`）：

| 子操作码 | 功能 |
|----------|------|
| [0] | 直接赋值：`x50[e1] = e2` |
| [1] | 索引存储：`x50[e3+e4] = e5` |
| [2] | 索引读取：`x50[e5] = x50[e3+e4]` |
| [3] | 算术运算：加/减/乘/除/取模 |
| [4] | 比较运算：<, <=, ==, !=, >=, > |
| [5] | 清除所有 x50 变量 |
| [8] | 读取对话字符串存入 x50 |
| [9] | 字符串格式化 |
| [10] | 获取字符串长度 |
| [11] | 字符串拼接 |
| [16] | 直接写入内存（Person/Thing/Scene/Wugong 数据） |
| [17] | 从内存读取 |
| [18-19] | 队伍成员读写 |
| [20] | 查找物品数量 |
| [21-22] | D-data 读写 |
| [23-24] | S-data 读写 |
| [25-26] | 内存映射地址读写 |
| [27] | 读取实体名称字符串 |
| [32] | 运行时修改事件指令 |
| [33-34] | 在屏幕绘制文本/方框 |
| [35] | 等待按键 |
| [37] | 延迟 |
| [38] | 随机数 |
| [39-40] | 显示菜单 |
| [41] | 加载并显示图片 |

## 八、剧情脚本实例分析

### 实例 1：开场过场（CEvent/2002.lua）

典型的电影式过场事件：

```lua
-- 播放背景音乐
PlayMIDI(3)

-- 旁白对话
say("场景描述文字...", 0, 1)    -- personId=0 表示旁白

-- NPC 走路动画（逐帧移动精灵）
for i = 45, 25, -1 do
    SetS(80, i+1, 41, 1, 0)     -- 清除旧位置
    SetS(80, i, 41, 1, 7094)    -- 设置新位置精灵
    DrawSMap()
    ShowScreen()
    lib.Delay(1)
end

-- 显示标题
DrawStrBox(-1, -1, "轮回非梦", C_GOLD, CC.DefaultFont)
ShowScreen(); WaitKey()

-- 角色对话
say("对话内容...", 553, 4, "???")     -- 神秘角色
say("对话内容...", JY.MyPic, 1)        -- 玩家

-- 链接到下一个事件
instruct_3(-2, 0, ...)                  -- 设置后续事件
```

### 实例 2：多分支任务（CEvent/8601.lua）

复杂的分支任务：

```lua
-- 1. 检查完成标记
if GetS(86, 40, 40, 5) == 1 then return end

-- 2. 角色对话（动态插入玩家名）
local playername = JY.Person[0]["名字"]
say(string.format("...%s...", playername), 0, 1)

-- 3. 玩家选择
local choice = DrawStrBoxYesNo(-1, -1, "是否...")

-- 4. 分支 A：同意
if choice == true then
    say("...", 0, 1)
    -- 进入战斗
    if WarMain(92, 1) then
        -- 战斗胜利：获得物品、设置后续事件
        instruct_2(230, 1)                      -- 获得物品
        instruct_3(70, 61, 1, 0, 8602, ...)     -- 设置后续事件
        instruct_37(2)                            -- 道德+2
    end
-- 5. 分支 B：拒绝
else
    -- 仍然被迫战斗
    if WarMain(92, 1) then
        instruct_39(15)       -- 开启新地图区域
        instruct_37(-2)       -- 道德-2
    end
end

-- 6. 设置完成标记
SetS(86, 40, 40, 5, 1)
```

### 实例 3：大型剧情推进（CEvent/301.lua，38KB）

最大型的事件脚本，包含三个分支：

**分支 1 — 角色加入**：
```lua
-- 检查位置和条件
if instruct_60(-2, 38, 2286, 0, 46) then   -- 检查瓦片图索引
    if instruct_16(49, 0, 42) then          -- 角色在队伍中
        instruct_3(-2, 38, ...)             -- 修改事件（移除NPC）
        instruct_1(2599, 49, 0)             -- 角色对话
        instruct_21(49)                     -- 离开队伍
        instruct_37(10)                     -- 道德+10
    end
end
```

**分支 2 — 强盗袭击场景**：
- 用 `instruct_3()` 放置数十个 NPC
- 用 `instruct_30()` 编排走路路径
- 多角色对话（玩家、角色70、神秘人物"???"、谢逊等）
- 战斗：`instruct_6(80,1,0,1)`

**分支 3 — 英雄大会（主线高潮）**：
- 设置竞技场场景，约 40+ NPC
- **连续 5 场战斗**：
  ```
  instruct_6(197,4,0,0)  → instruct_6(198,4,0,0) →
  instruct_6(199,4,0,0)  → instruct_6(200,4,0,0) → instruct_6(81,4,0,0)
  ```
- 战斗间穿插对话，涉及乔峰、慕容复等角色
- 最终奖励：物品和人参丹

### 实例 4：任务链（8001-8006，段誉线）

```
8001.lua  包头遇见宝宝（触发条件：段誉在队中）
  ├─ 对话 → 选择是否战斗
  ├─ 战斗胜利 → 获得200银
  └─ 设置事件 8002（开封客栈）

8002.lua  开封客栈路遇（触发条件：段誉在队中）
  ├─ 水灵、旷小儿登场
  ├─ 讨论"血菩提果"
  ├─ 血菩提魔出现（反派）
  ├─ 段誉离队
  └─ 设置雪山事件标记

8003.lua  雪山战后
  ├─ 战斗胜利 → 段誉归队
  └─ 水灵不加入

8004.lua  程宝宝复仇事件
  ├─ 属性翻倍的程宝宝（临时 NPC）
  ├─ 战斗（失败=游戏结束）
  └─ 战后剧情对话

8005.lua  水灵入队事件

8006.lua  水灵离队/加入选择
  ├─ 队伍未满 → 水灵加入
  └─ 队伍已满 → "队伍已满"
```

任务链的模式：每个事件末尾通过 `instruct_3()` 设置后续事件的 D-data，形成链条。

## 九、NewGame 初始化

`NewGame()` 函数（jymain.lua 第 245-590 行）展示了游戏状态如何初始化：

1. **难度选择**：通过 `JYMsgBox` 让玩家选择难度
2. **角色选择**：3 个预设角色或自定义角色
3. **初始属性**：HP=50/100、攻击=30、防御=30、轻功=30 等
4. **事件放置**：
   ```lua
   -- 在场景13设置踩上去触发的事件
   SetS(13, 18, 28, 3, 101)   -- 踩到(18,28)触发事件101
   SetS(13, 18, 29, 3, 102)   -- 踩到(18,29)触发事件102
   ```
5. **敌人难度缩放**：根据选择的难度设置所有NPC的武功等级和HP上限
6. **初始场景**：`CC.NewGameSceneID=70, NewGameSceneX=16, NewGameSceneY=31, NewGameEvent=691`

## 十、全局数据结构

### CC.Person_S（角色数据，182 字节/角色）

| 字段 | 说明 |
|------|------|
| 编号, 头像编号 | 角色唯一标识 |
| 性别, 等级, 门派 | 基本属性 |
| 生命, 生命最大值 | HP |
| 内力 | MP |
| 攻击程度, 防御, 防御最大值 | 战斗属性 |
| 拳掌功夫, 御剑能力, 耍刀技巧, 特殊兵器 | 武器技能 |
| 医疗, 用毒, 解毒 | 特殊能力 |
| 轻功, 武学常识, 品德 | 角色属性 |
| 武功1-10, 武功等级1-10 | 已学武功 |
| 携带物品1-4, 携带物品数量1-4 | 装备 |

### CC.Thing_S（物品数据，190 字节/物品）

| 字段 | 说明 |
|------|------|
| 名称, 名称2, 物品说明 | 基本信息 |
| 练出武功, 练出武功最大等级 | 练功关联 |
| 装备类型, 类别 | 物品分类 |
| 攻击力, 防御力 | 装备属性 |
| 增加各种属性×2 | 详细属性加成 |
| 需要物品1-5, 需要物品数量1-5 | 合成配方 |

### CC.Scene_S（场景数据，52 字节/场景）

| 字段 | 说明 |
|------|------|
| 名称 | 场景名 |
| 进场景编号, 出场景编号 | 场景连接 |
| 地图类型 | 室内/室外 |
| 进X, 进Y | 入口坐标 |
| 退X1/X2/X3, 退Y1/Y2/Y3 | 出口坐标 |

### CC.Wugong_S（武功数据，136 字节/武功）

| 字段 | 说明 |
|------|------|
| 名称 | 武功名 |
| 武功类型, 伤害类型 | 分类 |
| 攻击范围 | 射程 |
| 10级攻击力, 移动范围, 杀人范围 | 成长属性 |

## 十一、剧情脚本设计模式总结

### 1. 事件 ID 间接寻址

D-data 存储事件脚本 ID。修改 D 记录的事件 ID 字段即可改变该位置发生的事情——无需修改地图，即可实现任务状态推进。

### 2. 状态持久化

通过 S/D 数据修改追踪：
- D-data 修改（移除/添加 NPC、改变阻挡状态）
- S-data 瓦片变化（放置/移除事件标记）
- 队伍成员（`JY.Base["队员N"]`）
- 物品栏（`JY.Base["物品N"]`）
- 全局标记存储在特定场景的 S-data 中

### 3. 事件链

- 单个 CEvent 文件内：指令从上到下顺序执行
- 分支：`if/else` 基于 `WarMain()` 结果、`DrawStrBoxYesNo()` 响应、`instruct_16()` 队伍检查
- 跨事件：`instruct_3()` 在目标场景设置后续事件的 D-data

### 4. 角色临时创建

动态临时 NPC 通过克隆现有角色数据到 `JY.Person[9999]` 并修改属性实现：
```lua
-- 创建强化版角色
JY.Person[9999] = ClonePerson(140)
JY.Person[9999]["名字"] = "复仇宝宝"
JY.Person[9999]["攻击"] = JY.Person[9999]["攻击"] * 2
```

### 5. 地图实时修改

通过 `SetS()` 和 `instruct_38()` 在事件中实时修改地图：
- 开门/关门：替换瓦片图索引
- NPC 出现/消失：设置/清除 S-data 层1 和层3
- 场景变化：大面积替换瓦片

## 十二、与 DeepSolo 的映射关系

| JYQXZ 概念 | DeepSolo 对应 |
|-------------|---------------|
| S-data 层3（事件ID） | NPC 的 `dialogueId` 字段 / 场景事件注册 |
| D-data（事件记录） | NPC 交互距离检测 + DialogueSystem |
| `say()` 对话 | ConversationPanel（已有 conv:open/message 事件） |
| `DrawStrBoxYesNo()` | ConvChoice（选项分支） |
| `WarMain()` | BattleSystem.start() |
| `SetS/GetS` 标记 | GameStore 或后端状态 |
| `instruct_3()` 放置NPC | EntitySystem.createNPCs() |
| CEvent/*.lua | 后端 Python 驱动的事件 JSON + 前端事件脚本 |
| 物品/武功系统 | Token 中心 / 策略属性 |
