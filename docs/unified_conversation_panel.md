# 统一对话组件 (ConversationPanel) 重构文档

## 1. 背景

项目原有 3 种独立的对话/交互 UI，各自管理 overlay、关闭逻辑、按钮样式：

| 交互场景 | 原实现 | 问题 |
|---------|--------|------|
| NPC 预设对话 | `DialoguePanel.scriptedPanel` | 头像 + 打字机 + 选项，独立 overlay |
| 策略 Agent 聊天 | `DialoguePanel.chatPanel` | 聊天气泡 + 输入框，独立 overlay |
| Token 上架弹窗 | `TokenCenterUI.showListDialog` | 确认弹窗 + 输入框，独立 overlay |

三者 DOM 结构、事件流、样式完全独立，每次新增交互都要从零写弹窗。

重构目标：**统一为一个 `Conversation` 数据模型 + `ConversationPanel` 渲染组件**。

---

## 2. 核心模型

```typescript
/** 对话选项 */
export interface ConvChoice {
  text: string;
  value: string;
}

/** 对话消息 */
export interface ConvMessage {
  id: string;
  role: 'npc' | 'user' | 'assistant' | 'system';
  speakerName?: string;
  portraitKey?: string;
  text: string;
  choices?: ConvChoice[];
}

/** 输入模式 */
export type ConvInputMode = 'none' | 'choices' | 'text';

/** 对话 */
export interface Conversation {
  id: string;
  title: string;
  portraitKey?: string;
  messages: ConvMessage[];
  inputMode: ConvInputMode;
  inputPlaceholder?: string;
  inputType?: 'text' | 'number';
}
```

### 场景映射

| 场景 | inputMode | messages 来源 | 触发 |
|------|-----------|---------------|------|
| NPC 预设对话 | `none` → `choices` | DialogueSystem 节点推送 | SPACE 靠近室内 NPC |
| Agent 聊天 | `text` | WebSocket 双向消息 | SPACE 靠近世界 Agent |
| Token 上架 | `text` | 单轮系统消息 | 点击"上架售卖" |

---

## 3. 事件流

### EventBus 事件

```typescript
// 新增的 conv:* 事件
'conv:open': Conversation;       // 打开对话
'conv:message': ConvMessage;     // 追加消息
'conv:update-last': {            // 更新最后一条消息（打字机效果）
  text: string;
  choices?: ConvChoice[];
  inputMode?: ConvInputMode;
};
'conv:close': void;              // 关闭对话
'conv:choice': string;           // 用户选择了选项 (value)
'conv:send': string;             // 用户输入了文字
```

### 废弃事件

以下事件已从 `GameEvents` 中移除：

```
'dialogue:show' | 'dialogue:text-update' | 'dialogue:hide'
'dialogue:choice' | 'dialogue:advance'
'npc:interact' | 'chat:open' | 'chat:close'
```

### 调用链

#### NPC 预设对话

```
SPACE 靠近 NPC
  → WorldScene: sceneManager.startDialogue()
  → WorldScene: dialogueSystem.startDialogue(dialogueId)
      → DialogueSystem: emit 'conv:open' (空 Conversation)
      → DialogueSystem.showNode(firstNode)
          → emit 'conv:message' { role:'npc', text:'' }
          → startTypewriter()
              → 每 tick: emit 'conv:update-last' { text: partialText }
              → 完成有 choices: emit 'conv:update-last' { text, choices, inputMode:'choices' }
  用户点选项
      → ConversationPanel: emit 'conv:choice' (value)
      → DialogueSystem.choose(value) → showNode(next)
  节点结束
      → DialogueSystem.endDialogue() → emit 'conv:close'
```

#### Agent 聊天

```
SPACE 靠近 Agent
  → WorldScene.openAgentChat(strategy)
      → sceneManager.startDialogue()
      → emit 'conv:open' { inputMode:'text', messages:[system] }
      → chatService.requestHistory(agentId)
  后端返回 history
      → WorldScene: 逐条 emit 'conv:message' { role: user/assistant }
  用户输入
      → ConversationPanel: emit 'conv:send' (text)
      → WorldScene: emit 'conv:message' { role:'user' }
      → chatService.send(agentId, text)
  后端回复
      → WorldScene: emit 'conv:message' { role:'assistant', text }
  ESC 或 X 关闭
      → ConversationPanel.close() → emit 'conv:close'
```

#### Token 上架

```
点击 [上架售卖]
  → TokenCenterUI.showListDialog(token)
      → emit 'conv:open' { inputMode:'text', inputType:'number', messages:[system] }
      → 注册一次性 conv:send 监听
  用户输入价格
      → ConversationPanel: emit 'conv:send' (text)
      → TokenCenterUI handler: 校验价格 → store.listToken() → emit 'conv:close'
```

---

## 4. 架构

### 组件关系

```
ConversationPanel (DOM)
  ├── conv-overlay (全屏遮罩)
  └── conv-panel (面板主体)
      ├── conv-header (标题 + 关闭按钮)
      ├── conv-messages (消息列表，可滚动)
      │   └── conv-msg[data-role] × N (npc/user/assistant/system)
      └── conv-input-area (底部输入区)
          ├── choices 模式: 由消息内 conv-msg-choices 渲染
          ├── text 模式:   input + 发送按钮
          └── none 模式:   提示文字

DialogueSystem (引擎)
  ├── 保留打字机效果
  ├── 保留节点遍历逻辑
  ├── 输出改为 emit conv:message / conv:update-last
  ├── forceEnd() 不触发事件（用于外部强制关闭）
  └── endDialogue() 触发 conv:close

WorldScene (协调者)
  ├── 监听 conv:open → 锁定玩家 (sceneManager.startDialogue)
  ├── 监听 conv:close → 解锁玩家 (sceneManager.endDialogue)
  ├── 监听 conv:send → 转发给 ChatService
  ├── ChatService reply → emit conv:message
  └── conv:open handler 用 isPlayerLocked() 守卫，防止重复 startDialogue
```

---

## 5. 样式体系

统一的 `.conv-*` CSS 类替代了原有的 `.dialogue-*` + `.chat-*` + `.tc-dialog-*`：

| 新类名 | 用途 |
|--------|------|
| `.conv-overlay` | 全屏遮罩 |
| `.conv-panel` | 面板主体 |
| `.conv-header` / `.conv-title` / `.conv-close-btn` | 头部 |
| `.conv-messages` | 消息滚动区 |
| `.conv-msg-npc` | NPC 消息（左侧，带头像+名字） |
| `.conv-msg-user` | 用户消息（右侧，蓝色背景） |
| `.conv-msg-assistant` | 助手消息（左侧，深色背景） |
| `.conv-msg-system` | 系统消息（居中，灰色） |
| `.conv-msg-choices` / `.conv-choice-btn` | 选项按钮 |
| `.conv-input-area` / `.conv-text-input` / `.conv-send-btn` | 文本输入区 |
| `.conv-hint` | 提示文字 |

---

## 6. 踩坑记录

### 6.1 玩家锁定不解除

**现象：** 关闭对话后玩家无法移动。

**原因：** `conv:open` handler 中无条件调用 `sceneManager.startDialogue()`，而调用方（如 `openAgentChat`）已经调过一次。`startDialogue()` 会覆写 `prevSceneState`，导致第二次调用后 `prevSceneState = Dialogue`，`endDialogue()` 恢复的也是 `Dialogue`。

**修复：** `conv:open` handler 用 `isPlayerLocked()` 守卫：
```typescript
if (!this.sceneManager.isPlayerLocked()) {
  this.sceneManager.startDialogue();
}
```

### 6.2 DialogueSystem 强制关闭递归

**现象：** 关闭对话时 `conv:close` 被无限触发。

**原因：** `DialogueSystem.endDialogue()` 会 emit `conv:close`，而 `conv:close` handler 中调用 `forceEnd()` 或 `endDialogue()` 都可能造成递归。

**修复：** 新增 `forceEnd()` 方法，只清理状态不触发事件：
```typescript
forceEnd(): void {
  this.cleanup(); // 不 emit conv:close
}
```

### 6.3 聊天历史丢失

**现象：** 打开 Agent 聊天后没有历史消息。

**原因：** 重构时 `ChatService` 的 `history` 回调写成了空 `return`，没有将历史消息通过 `conv:message` 推送到面板。

**修复：** 在 history 回调中逐条 emit：
```typescript
if (data.type === 'history' && data.messages) {
  data.messages.forEach(m => {
    _eventBus.emit('conv:message', {
      role: m.role === 'user' ? 'user' : 'assistant',
      text: m.text,
    });
  });
}
```

---

## 7. 文件变更清单

### 新增

| 文件 | 说明 |
|------|------|
| `src/ui/ConversationPanel.ts` | 统一对话面板 |

### 修改

| 文件 | 改动 |
|------|------|
| `src/types.ts` | 新增 ConvChoice/ConvMessage/ConvInputMode/Conversation 类型，新增 conv:* 事件，移除旧的 dialogue:*/chat:* 事件 |
| `src/systems/DialogueSystem.ts` | 输出改为 conv:message/conv:update-last/conv:open/conv:close，新增 forceEnd() |
| `src/scenes/WorldScene.ts` | 统一通过 Conversation 模型触发对话，处理 ChatService history/reply |
| `src/ui/TokenCenterUI.ts` | showListDialog 改为 conv:open + conv:send |
| `src/ui/UIManager.ts` | 替换 DialoguePanel 为 ConversationPanel |
| `src/ui/styles.css` | .conv-* 替换 .dialogue-* + .chat-* + .tc-dialog-* |
| `src/main.ts` | 导出 setChatService 给 WorldScene |

### 删除

| 文件 | 说明 |
|------|------|
| `src/ui/DialoguePanel.ts` | 被 ConversationPanel.ts 替代 |
