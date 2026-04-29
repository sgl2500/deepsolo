# Token 中心 — 功能设计文档

## 1. 概述

在 DeepSolo 像素社区中新增 **Token 中心** 场景。单个观察者（玩家）拥有个人账户（余额 + 个人信息），可以持有和管理自己的 Token，在 Token 中心标价上架售卖 Token、取消挂单、查看账户信息和交易记录。

**当前版本聚焦单观察者视角**，不涉及多观察者交易。

---

## 2. 核心概念

| 概念 | 说明 |
|------|------|
| **观察者** | 玩家角色（Player），拥有唯一的账户中心。 |
| **Token** | 观察者持有的虚拟资产，有名称、描述、稀有度等属性。 |
| **账户中心** | 个人钱包：余额、个人信息、持有 Token 列表。 |
| **Token 中心** | 世界地图上的新建筑 (40, 85)，进入后管理 Token。 |
| **挂单 (Listing)** | 观察者将 Token 标价上架。 |
| **操作记录** | 每次上架/取消操作的记录。 |

---

## 3. 数据模型

### 3.1 ObserverAccount（观察者账户）

```typescript
export interface ObserverAccount {
  id: string;          // 固定 'observer_001'
  name: string;
  balance: number;     // 当前余额
  bio: string;         // 个人简介
  tokenIds: string[];  // 持有的 Token ID
  createdAt: string;
}
```

### 3.2 Token

```typescript
export type TokenRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Token {
  id: string;
  name: string;
  description: string;
  rarity: TokenRarity;
  iconKey: string;
  createdAt: string;
}
```

### 3.3 TokenListing（挂单）

```typescript
export interface TokenListing {
  id: string;
  tokenId: string;
  tokenName: string;
  tokenRarity: TokenRarity;
  price: number;
  listedAt: string;
  status: 'active' | 'cancelled';
}
```

### 3.4 Transaction（操作记录）

```typescript
export interface Transaction {
  id: string;
  type: 'list' | 'cancel';
  tokenId: string;
  tokenName: string;
  price: number;
  timestamp: string;
}
```

---

## 4. UI 设计（3 个 Tab）

进入 Token 中心建筑后，右侧面板切换为 Token 管理界面：

### 4.1 我的 Token

- 显示余额
- 列出所有持有的 Token（排除已上架的）
- 每个 Token 卡片显示名称、稀有度、描述
- "上架售卖" 按钮触发 Conversation 输入弹窗

### 4.2 我的挂单

- 显示活跃挂单数量
- 列出所有 `status: active` 的挂单
- 每个挂单显示 Token 名称、价格、上架时间
- "取消挂单" 按钮（确认后执行）

### 4.3 账户中心

- 显示名称、余额、持有数量、活跃挂单数、注册时间
- 个人简介
- 最近 10 条操作记录（上架/取消）
- "重置数据" 按钮（恢复初始状态）

---

## 5. 核心流程

### 5.1 上架售卖

```
我的 Token Tab → 点击 [上架售卖]
  → 通过 ConversationPanel 打开输入对话（inputMode: 'text', inputType: 'number'）
  → 用户输入价格，按回车
  → TokenCenterUI 监听 conv:send 获取价格
  → 校验价格 > 0
  → store.listToken(tokenId, price)
    → 从 tokenIds 移除该 Token
    → 创建 TokenListing（status: active）
    → 记录 Transaction（type: list）
    → persist 到 localStorage
    → emit token:listed
    → emit conv:close
  → 刷新 UI
```

### 5.2 取消挂单

```
我的挂单 Tab → 点击 [取消挂单]
  → confirm 确认
  → store.cancelListing(listingId)
    → 挂单 status 改为 'cancelled'
    → Token 回到 tokenIds
    → 记录 Transaction（type: cancel）
    → persist 到 localStorage
    → emit token:cancel
  → 刷新 UI
```

---

## 6. 数据存储（前端 localStorage）

| Key | 数据 |
|-----|------|
| `deepsolo_account` | ObserverAccount JSON |
| `deepsolo_tokens` | Token[] JSON |
| `deepsolo_listings` | TokenListing[] JSON |
| `deepsolo_transactions` | Transaction[] JSON |

首次加载时从 `public/data/token_center/` 的 JSON 文件初始化，之后全部走 localStorage。

---

## 7. 场景与建筑

### 7.1 注册

| 文件 | 改动 |
|------|------|
| `src/data/SceneData.ts` | 新增 `{ id: 'token_center', name: 'Token中心', x: 40, y: 85 }` |
| `src/data/BuildingData.ts` | 新增 `makeSimpleIndoor('token_center', 40, 85)` |
| `public/assets/maps/indoor/indoor_token_center.json` | 标准室内地图 (40×40) |

### 7.2 室内地图

遵循 `docs/大地图新增室内场景流程.md` 规范：

- 40×40 网格，房间 1~19 行 × 1~19 列
- 地板 588，侧墙 837，横墙 838，四角 845/846/847/869
- 出口 307（双格门），spawn (9,9)，exit (10,17)
- BootScene 自动加载，无需改动

### 7.3 NPC

| NPC | mapId | 坐标 | charKey | dialogueId |
|-----|-------|------|---------|------------|
| 赵馆长 | token_center | (10,6) | npc_1020 | curator_zhao_intro |

赵馆长对话脚本提供：Token 介绍、售卖教程、账户管理介绍。

---

## 8. 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/core/TokenStore.ts` | Token 状态管理（localStorage 读写） |
| `src/ui/TokenCenterUI.ts` | Token 中心 UI 面板（3 Tab） |
| `public/data/token_center/account.json` | 初始账户数据 |
| `public/data/token_center/tokens.json` | 初始 Token 池（5 个 Token） |
| `public/data/token_center/listings.json` | 初始空挂单 `[]` |
| `public/data/token_center/transactions.json` | 初始空记录 `[]` |
| `public/assets/maps/indoor/indoor_token_center.json` | 室内地图 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types.ts` | 新增 Token/Account/Listing/Transaction 类型 + GameEvents |
| `src/config.ts` | 新增 Token 常量（URL、稀有度、localStorage key） |
| `src/data/SceneData.ts` | 新增 token_center 场景 |
| `src/data/BuildingData.ts` | 新增 token_center 建筑 |
| `src/data/NPCData.ts` | 新增赵馆长 NPC |
| `src/data/DialogueScripts.ts` | 新增 curator_zhao_intro 对话脚本 |
| `src/ui/UIManager.ts` | 集成 TokenCenterUI + TokenStore，场景切换面板 |
| `src/ui/styles.css` | 新增 Token 中心样式（.tc-*） |

### 初始 Token 数据

| ID | 名称 | 稀有度 | 描述 |
|----|------|--------|------|
| token_001 | 策略之光 | 史诗 | 追涨策略的精髓 Token |
| token_002 | 回测大师 | 稀有 | 精准回测能力的证明 |
| token_003 | 新手护符 | 普通 | 初入市场的幸运护符 |
| token_004 | 风控之盾 | 稀有 | 稳健风控策略的象征 |
| token_005 | 进化之心 | 传说 | 策略进化系统的核心 Token |
