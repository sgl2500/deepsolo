#!/usr/bin/env node
// ============================================================
// extract_game_data.js — 从 JYQXZ 源数据提取地图/场景 JSON
// 用法: node scripts/extract_game_data.js
// ============================================================

const fs = require('fs');
const path = require('path');

// ---- Paths ----
const DATA_DIR = path.resolve(__dirname, '../../JYQXZ/jyqxz/Release/DATA');
const OUT_DIR = path.resolve(__dirname, '../packages/visual/public/assets');
const INDOOR_DIR = path.join(OUT_DIR, 'indoor_maps');

// ---- Ensure output dirs ----
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(INDOOR_DIR, { recursive: true });

// ============================================================
// 1. World Map 5 Layers (.002 files)
// ============================================================
function extractWorldMap() {
  console.log('=== Extracting World Map (5 layers, 480x480) ===');
  const W = 480, H = 480;
  const layers = ['Earth', 'Surface', 'Building', 'Buildx', 'Buildy'];
  const result = {
    width: W, height: H, cx: 250, cy: 250,
    earth: [], surface: [], building: [], buildx: [], buildy: []
  };

  for (const layerName of layers) {
    const filePath = path.join(DATA_DIR, `${layerName}.002`);
    const buf = fs.readFileSync(filePath);
    if (buf.length !== W * H * 2) {
      throw new Error(`${layerName}.002 size mismatch: ${buf.length} != ${W * H * 2}`);
    }
    const key = layerName.toLowerCase();
    const grid = [];
    for (let r = 0; r < H; r++) {
      const row = [];
      for (let c = 0; c < W; c++) {
        let val = buf.readUInt16LE((r * W + c) * 2);
        // Earth layer: tile index = value >> 1
        if (key === 'earth') val = val >> 1;
        row.push(val);
      }
      grid.push(row);
    }
    result[key] = grid;

    // Stats
    let nonZero = 0;
    for (const row of grid) for (const v of row) if (v !== 0) nonZero++;
    console.log(`  ${layerName}: ${nonZero} non-zero tiles`);
  }

  const outPath = path.join(OUT_DIR, 'world_map_5layers.json');
  fs.writeFileSync(outPath, JSON.stringify(result));
  const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`  -> ${outPath} (${size} MB)`);
}

// ============================================================
// 2. Scene Definitions (ranger.grp)
// ============================================================
function extractSceneDefinitions() {
  console.log('\n=== Extracting Scene Definitions (ranger.grp) ===');
  const idxBuf = fs.readFileSync(path.join(DATA_DIR, 'Ranger.idx'));
  const grpBuf = fs.readFileSync(path.join(DATA_DIR, 'Ranger.grp'));

  // Read 6 section offsets
  const offsets = [];
  for (let i = 0; i < 6; i++) offsets.push(idxBuf.readUInt32LE(i * 4));

  const sceneStart = offsets[3];
  const sceneEnd = offsets[4];
  const SCENE_SIZE = 52;
  const numScenes = Math.floor((sceneEnd - sceneStart) / SCENE_SIZE);
  console.log(`  ${numScenes} scenes (${sceneStart}-${sceneEnd})`);

  const scenes = [];
  for (let s = 0; s < numScenes; s++) {
    const base = sceneStart + s * SCENE_SIZE;
    // Read name as 10 raw bytes (GB2312), try to decode
    const nameBytes = grpBuf.slice(base + 2, base + 12);
    let name = '';
    try {
      // Try to decode as GB2312/GBK via TextDecoder (Node 12.12+)
      if (typeof TextDecoder !== 'undefined') {
        const td = new TextDecoder('gbk');
        name = td.decode(nameBytes).replace(/\0/g, '').trim();
      }
    } catch (e) { /* fallback: hex */ }
    if (!name) {
      // Fallback: check if all printable GB2312
      name = '';
      for (let i = 0; i < 10; i += 2) {
        const b1 = nameBytes[i], b2 = nameBytes[i + 1];
        if (b1 === 0 && b2 === 0) break;
        if (b1 >= 0xA1 && b2 >= 0xA1) {
          // GB2312 double-byte char — store as hex placeholder
          name += `[${b1.toString(16)}${b2.toString(16)}]`;
        } else if (b1 >= 0x20 && b1 < 0x7F && b2 === 0) {
          name += String.fromCharCode(b1);
        }
      }
    }

    const scene = {
      id: s,
      name: name || `场景${s}`,
      entryType: grpBuf.readInt16LE(base + 12),
      subScene: grpBuf.readInt16LE(base + 14),
      transferTarget: grpBuf.readInt16LE(base + 16),
      music: grpBuf.readInt16LE(base + 18),
      worldX1: grpBuf.readInt16LE(base + 20),
      worldY1: grpBuf.readInt16LE(base + 22),
      worldX2: grpBuf.readInt16LE(base + 24),
      worldY2: grpBuf.readInt16LE(base + 26),
      entryX: grpBuf.readInt16LE(base + 28),
      entryY: grpBuf.readInt16LE(base + 30),
      exitX1: grpBuf.readInt16LE(base + 32),
      exitX2: grpBuf.readInt16LE(base + 34),
      exitX3: grpBuf.readInt16LE(base + 36),
      exitY1: grpBuf.readInt16LE(base + 38),
      exitY2: grpBuf.readInt16LE(base + 40),
      exitY3: grpBuf.readInt16LE(base + 42),
      transferX1: grpBuf.readInt16LE(base + 44),
      transferY1: grpBuf.readInt16LE(base + 46),
      transferX2: grpBuf.readInt16LE(base + 48),
      transferY2: grpBuf.readInt16LE(base + 50),
    };
    scenes.push(scene);
  }

  const outPath = path.join(OUT_DIR, 'scene_definitions.json');
  fs.writeFileSync(outPath, JSON.stringify(scenes, null, 2));
  const size = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`  -> ${outPath} (${size} KB)`);

  // Print a few known scenes
  const known = [1, 3, 4, 10, 39, 40, 60, 61, 65, 70, 86, 94, 103, 104];
  for (const id of known) {
    if (id < scenes.length) {
      const s = scenes[id];
      console.log(`  Scene ${id}: name="${s.name}" entry=(${s.entryX},${s.entryY}) exit=(${s.exitX1},${s.exitY1}) world=(${s.worldX1},${s.worldY1})-(${s.worldX2},${s.worldY2})`);
    }
  }
}

// ============================================================
// 3. Indoor Scene S* Data (allsin.grp)
// ============================================================
function extractIndoorScenes() {
  console.log('\n=== Extracting Indoor Scenes (allsin.grp, 107 scenes) ===');
  const buf = fs.readFileSync(path.join(DATA_DIR, 'Allsin.grp'));
  const NUM_SCENES = 107;
  const LEVELS = 6;
  const SW = 64, SH = 64;
  const PER_SCENE = LEVELS * SW * SH * 2; // 49152 bytes

  if (buf.length !== NUM_SCENES * PER_SCENE) {
    throw new Error(`Allsin.grp size mismatch: ${buf.length} != ${NUM_SCENES * PER_SCENE}`);
  }

  let filesWritten = 0;

  for (let sid = 0; sid < NUM_SCENES; sid++) {
    const sceneBase = sid * PER_SCENE;

    // Extract level 0 (earth) and level 1 (surface)
    const earth = [];
    const surface = [];

    let earthNonZero = 0, surfaceNonZero = 0;

    for (let r = 0; r < SH; r++) {
      const earthRow = [];
      const surfaceRow = [];
      for (let c = 0; c < SW; c++) {
        // Level 0 (earth)
        const earthOff = sceneBase + 0 * SW * SH * 2 + r * SW * 2 + c * 2;
        const earthVal = buf.readInt16LE(earthOff);
        earthRow.push(earthVal);
        if (earthVal !== 0) earthNonZero++;

        // Level 1 (surface/obstacle)
        const surfOff = sceneBase + 1 * SW * SH * 2 + r * SW * 2 + c * 2;
        const surfVal = buf.readInt16LE(surfOff);
        surfaceRow.push(surfVal);
        if (surfVal !== 0) surfaceNonZero++;
      }
      earth.push(earthRow);
      surface.push(surfaceRow);
    }

    // Only write if scene has meaningful data
    if (earthNonZero > 0 || surfaceNonZero > 0) {
      // Collect tile IDs used
      const tileIds = new Set();
      for (const row of [...earth, ...surface]) {
        for (const v of row) if (v !== 0) tileIds.add(v);
      }

      const mapData = {
        width: SW,
        height: SH,
        cx: 32,
        cy: 32,
        earth,
        surface,
        smapTileIds: Array.from(tileIds).sort((a, b) => a - b)
      };

      const outPath = path.join(INDOOR_DIR, `indoor_${sid}.json`);
      fs.writeFileSync(outPath, JSON.stringify(mapData));
      filesWritten++;

      if (sid < 5 || [1, 3, 10, 39, 40, 60, 61, 63, 65, 69, 70, 74, 84, 94, 103, 104].includes(sid)) {
        console.log(`  Scene ${sid}: earth=${earthNonZero} surface=${surfaceNonZero} tiles=[${Array.from(tileIds).slice(0, 8).join(',')}${tileIds.size > 8 ? '...' : ''}]`);
      }
    }
  }

  console.log(`  -> ${INDOOR_DIR}/ (${filesWritten} files written)`);
}

// ============================================================
// Main
// ============================================================
function main() {
  console.log('JYQXZ Game Data Extractor');
  console.log('Source:', DATA_DIR);
  console.log('Output:', OUT_DIR);
  console.log();

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`ERROR: DATA directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  extractWorldMap();
  extractSceneDefinitions();
  extractIndoorScenes();

  console.log('\n=== Done! ===');
}

main();
