// ============================================================
// BootScene.ts — 资源预加载
// ============================================================

import Phaser from 'phaser';
import { BUILDINGS } from '../data/BuildingData';
import { NPC_DEFS } from '../data/NPCData';
import { EFT_FRAME_COUNTS } from '../data/BattleData';
import { preloadAgentProfiles } from '../data/agents';

const BIRTH_HOUSE_DECOR_ASSETS = [
  { key: 'birth_house_room_shell', file: 'room_shell.png' },
  { key: 'birth_house_decor_bookshelf', file: 'bookshelf.png' },
  { key: 'birth_house_decor_screen', file: 'screen.png' },
  { key: 'birth_house_decor_bed', file: 'bed.png' },
  { key: 'birth_house_decor_chest', file: 'chest.png' },
  { key: 'birth_house_decor_lantern', file: 'lantern.png' },
  { key: 'birth_house_decor_table', file: 'table.png' },
] as const;

/** 收集所有室内地图需要的 smap 瓦片 ID */
function collectSmapTileIds(): number[] {
  const ids = new Set<number>();
  // 室内地图通用瓦片
  [307, 588, 589, 590, 836, 837, 838, 839, 840, 841, 843, 844, 845, 846, 847, 848, 849, 850, 851, 852, 853, 854, 855, 856, 857, 858, 859, 860, 861, 862, 864, 865, 866, 867, 868, 869, 2557].forEach(id => ids.add(id));
  // 出生场景瓦片（观察者小屋）
  [6, 307, 622, 810, 817, 819, 833, 834, 837, 839, 846, 848].forEach(id => ids.add(id));
  // 黑木崖瓦片（JYQXZ 场景 82，36 个）
  [1134, 1138, 1148, 1150, 1158, 1160, 1162, 1164, 1166, 1168, 1170, 1172, 1174, 1710, 1712, 1818, 1840, 1948, 1950, 1952, 1954, 2404, 2590, 2676, 2748, 2750, 2752, 2910, 2914, 4410, 4412, 4414, 4424, 4438, 4884, 7058].forEach(id => ids.add(id));
  return Array.from(ids).sort((a, b) => a - b);
}

/** 收集所有需要的 NPC 头像 ID */
function collectPortraitIds(): string[] {
  const ids = new Set<string>();
  NPC_DEFS.forEach(npc => {
    // dialogueId 用于查找对应的头像，这里先从硬编码列表中取
  });
  // 从对话脚本中收集头像 key（这里直接列出需要的）
  return ['0', '1', '10'];
}

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

    // === 世界地图资源 ===
    this.load.atlas('tiles', 'assets/tile_atlas.png', 'assets/tile_atlas.json');
    this.load.json('map', 'assets/map_data.json');
    this.load.json('tmeta', 'assets/tile_meta.json');
    this.load.atlas('chars', 'assets/char_atlas.png?v=3', 'assets/char_atlas.json?v=3');
    this.load.spritesheet('player_walk', 'assets/player_walk1.png', { frameWidth: 28, frameHeight: 45 });
    this.load.json('charmeta', 'assets/char_meta.json?v=3');
    this.load.spritesheet('lpc_e2', 'assets/char01-walk-4dir.png', { frameWidth: 64, frameHeight: 64 });

    // === 室内地图数据 ===
    for (const b of BUILDINGS) {
      this.load.json(b.indoorMapKey, `assets/indoor_maps/${b.indoorMapKey}.json?v=10`);
    }
    for (const asset of BIRTH_HOUSE_DECOR_ASSETS) {
      this.load.image(asset.key, `assets/observer_house_v2/runtime/${asset.file}?v=2`);
    }

    // === Smap 瓦片 (JYQXZ 室内场景) ===
    // 加载 smap _info.json 用于瓦片偏移
    this.load.json('smap_info', 'assets/jy-assets/10_smap/_info.json');
    // 逐个加载需要的 smap 瓦片图片
    const smapIds = collectSmapTileIds();
    for (const id of smapIds) {
      const padded = String(id).padStart(4, '0');
      this.load.image(`smap_${id}`, `assets/jy-assets/10_smap/${padded}.png`);
    }

    // === NPC 头像 (JYQXZ 14_head) ===
    const portraitIds = collectPortraitIds();
    for (const id of portraitIds) {
      this.load.image(`portrait_${id}`, `assets/jy-assets/14_head/${id}.png`);
    }

    // === 战斗精灵 (JYQXZ 12_fight/Fight000) ===
    // 加载 Attack Type 0: 4 方向 × 12 帧 (frame 40-87)
    for (let i = 40; i <= 87; i++) {
      const padded = String(i).padStart(4, '0');
      this.load.image(`fight000_${padded}`, `assets/jy-assets/12_fight/Fight000/${padded}.png`);
    }
    // 加载 Fight000 的帧偏移数据
    this.load.json('fight000_info', 'assets/jy-assets/12_fight/Fight000/_info.json');

    // === 武功特效贴图 (JYQXZ 13_eft) ===
    for (const [eftId, count] of Object.entries(EFT_FRAME_COUNTS)) {
      for (let i = 0; i < count; i++) {
        const padded = String(i).padStart(4, '0');
        this.load.image(
          `eft_${eftId}_${padded}`,
          `assets/jy-assets/13_eft/${eftId}/${padded}.png`,
        );
      }
      // 加载每帧偏移数据（xoff/yoff 定义锚点位置）
      this.load.json(`eft_${eftId}_info`, `assets/jy-assets/13_eft/${eftId}/_info.json`);
    }

    // === NPC 地图精灵 (JYQXZ 17_npc_map) ===
    const npcCharKeys = new Set(NPC_DEFS.map(n => n.charKey));
    for (const key of npcCharKeys) {
      // smap_ 前缀的 key 已在上面的 smap 瓦片加载中处理，跳过
      if (key.startsWith('smap_')) continue;
      this.load.image(key, `assets/jy-assets/17_npc_map/${key}.png`);
    }

    this.load.on('loaderror', (f: any) => console.error('Load error:', f.key));
  }

  create(): void {
    preloadAgentProfiles().then(() => {
      this.scene.start('WorldScene');
    });
  }
}
