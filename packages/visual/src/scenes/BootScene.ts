// ============================================================
// BootScene.ts — 资源预加载
// ============================================================

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // 显示加载进度
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 40, '加载中...', {
      fontSize: '16px',
      color: '#e5e7eb',
      fontFamily: 'PingFang SC, monospace',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontSize: '14px',
      color: '#fbbf24',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(Math.round(value * 100) + '%');
      progressBar.clear();
      progressBar.fillStyle(0xfbbf24, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // 加载资源
    this.load.atlas('tiles', 'assets/tile_atlas.png', 'assets/tile_atlas.json');
    this.load.json('map', 'assets/map_data.json');
    this.load.json('tmeta', 'assets/tile_meta.json');
    this.load.atlas('chars', 'assets/char_atlas.png?v=3', 'assets/char_atlas.json?v=3');
    this.load.json('charmeta', 'assets/char_meta.json?v=3');
    // LPC 精灵图（变异二号专用）: 8列×4行, 每帧 64×64
    this.load.spritesheet('lpc_e2', 'assets/char01-walk-4dir.png', { frameWidth: 64, frameHeight: 64 });

    this.load.on('loaderror', (f: any) => console.error('Load error:', f.key));
  }

  create(): void {
    this.scene.start('WorldScene');
  }
}
