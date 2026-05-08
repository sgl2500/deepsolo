// ============================================================
// main.ts — 入口
// ============================================================

import Phaser from 'phaser';
import { SCREEN_WIDTH, SCREEN_HEIGHT, WS_URL } from './config';
import { EventBus } from './core/EventBus';
import { AuthStore } from './core/AuthStore';
import { GameStore } from './core/GameStore';
import { UIManager } from './ui/UIManager';
import { AuthOverlay } from './ui/AuthOverlay';
import { ChatService } from './services/ChatService';
import { BootScene } from './scenes/BootScene';
import { WorldScene, setWorldContext, setChatService } from './scenes/WorldScene';

const eventBus = new EventBus();
const authStore = new AuthStore(eventBus);
let gameStarted = false;

function startGame(): void {
  if (gameStarted) return;
  gameStarted = true;

  // 创建核心
  const store = new GameStore(eventBus, authStore.session?.username ?? null);

  // 创建 ChatService
  const chatService = new ChatService(WS_URL);
  chatService.connect();

  // 创建 UI（DOM 层）
  new UIManager(eventBus, store, chatService, authStore);

  // 注入共享上下文给 WorldScene
  setWorldContext(eventBus, store);
  setChatService(chatService);

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
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  new Phaser.Game(config);
}

eventBus.on('auth:logout', () => {
  window.location.reload();
});

if (authStore.isAuthenticated()) {
  startGame();
} else {
  const app = document.getElementById('app')!;
  new AuthOverlay(app, authStore, startGame);
}
