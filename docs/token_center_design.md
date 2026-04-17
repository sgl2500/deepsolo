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
| **Token 中心** | 世界地图上的新建筑，进入后管理 Token。 |
| **挂单 (Listing)** | 观察者将 Token 标价上架。 |
| **交易记录** | 每次上架/取消操作的记录。 |

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

```
┌─────────────────────────────────┐
│ 💰 余额: 10,000 金币            │
│─────────────────────────────────│
│ ┌─────────────────────────────┐ │
│ │ 🟣 策略之光                  │ │
│ │ 史诗 · 追涨策略的精髓 Token   │ │
│ │          [上架售卖]           │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🔵 回测大师                  │ │
│ │ 稀有 · 精准回测能力的证明     │ │
│ │          [上架售卖]           │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ⚪ 新手护符                  │ │
│ │ 普通 · 初入市场的幸运护符     │ │
│ │          [上架售卖]           │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 4.2 我的挂单

```
┌─────────────────────────────────┐
│ 活跃挂单 (2)                     │
│─────────────────────────────────│
│ ┌─────────────────────────────┐ │
│ │ 🟣 策略之光                  │ │
│ │ 💰 800 金币                  │ │
│ │ 上架: 12:30                  │ │
│ │        [取消挂单]             │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ⚪ 新手护符                  │ │
│ │ 💰 100 金币                  │ │
│ │ 上架: 11:20                  │ │
│ │        [取消挂单]             │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 4.3 账户中心

```
┌─────────────────────────────────┐
│ 👤 账户中心                      │
│─────────────────────────────────│
│ 名称: 观察者                     │
│ 余额: 10,000 金币                │
│ 持有 Token: 3 个                 │
│ 活跃挂单: 0 个                   │
│─────────────────────────────────│
│ 操作记录:                        │
│ ↑ 上架 "策略之光" 800金币        │
│ ↓ 取消 "回测大师" 挂单           │
└─────────────────────────────────┘
```

---

## 5. 核心流程

### 5.1 上架售卖

```
我的 Token Tab → 点击 [上架售卖]
  → 弹出价格输入框
  → 输入价格，确认
  → 从 tokenIds 移除该 Token
  → 创建 TokenListing（status: active）
  → 记录 Transaction（type: list）
  → 刷新 UI
```

### 5.2 取消挂单

```
我的挂单 Tab → 点击 [取消挂单]
  → 确认取消
  → Token 回到 tokenIds
  → 挂单状态改为 'cancelled'
  → 记录 Transaction（type: cancel）
  → 刷新 UI
```

---

## 6. 数据存储（前端 localStorage）

单观察者场景下，数据存在浏览器 localStorage 中：

- `deepsolo_account` → ObserverAccount JSON
- `deepsolo_tokens` → Token[] JSON
- `deepsolo_listings` → TokenListing[] JSON
- `deepsolo_transactions` → Transaction[] JSON

首次加载时从 `public/data/token_center/` 的 JSON 文件初始化，之后全部走 localStorage。

---

## 7. 新增/修改文件清单

### 新增

| 文件 | 说明 |
|------|------|
| `src/core/TokenStore.ts` | Token 状态管理（localStorage 读写） |
| `src/ui/TokenCenterUI.ts` | Token 中心 UI 面板（3 Tab） |
| `public/data/token_center/account.json` | 初始账户数据 |
| `public/data/token_center/tokens.json` | 初始 Token 池 |
| `public/data/token_center/listings.json` | 初始空挂单 `[]` |
| `public/data/token_center/transactions.json` | 初始空记录 `[]` |

### 修改

| 文件 | 改动 |
|------|------|
| `src/types.ts` | 新增 Token 相关类型 + GameEvents |
| `src/config.ts` | 新增 Token 常量 |
| `src/data/SceneData.ts` | 新增 token_center 场景 |
| `src/data/BuildingData.ts` | 新增 token_center 建筑 |
| `src/data/NPCData.ts` | 新增赵馆长 NPC |
| `src/data/DialogueScripts.ts` | 新增赵馆长对话 |
| `src/ui/UIManager.ts` | 集成 TokenCenterUI |
| `src/ui/styles.css` | 新增 Token 中心样式 |
