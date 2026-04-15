// ============================================================
// main.ts — 入口
// ============================================================

import Phaser from 'phaser';
import { SCREEN_WIDTH, SCREEN_HEIGHT, WS_URL } from './config';
import { EventBus } from './core/EventBus';
import { GameStore } from './core/GameStore';
import { UIManager } from './ui/UIManager';
import { ChatService } from './services/ChatService';
import { BootScene } from './scenes/BootScene';
import { WorldScene, setWorldContext } from './scenes/WorldScene';

// 创建核心
const eventBus = new EventBus();
const store = new GameStore(eventBus);

// 创建 ChatService
const chatService = new ChatService(WS_URL);
chatService.connect();

// 创建 UI（DOM 层）
const ui = new UIManager(eventBus, store, chatService);

// 注入共享上下文给 WorldScene
setWorldContext(eventBus, store);

// 启动 Phaser
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#0a0e1a',
  scene: [BootScene, WorldScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
};

const game = new Phaser.Game(config);
