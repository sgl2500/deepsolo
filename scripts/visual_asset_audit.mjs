#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const visualRoot = path.join(repoRoot, 'packages', 'visual');
const publicRoot = path.join(visualRoot, 'public');
const publicAssetsRoot = path.join(publicRoot, 'assets');
const externalAssetLibraryRoot = '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo';

const requiredPaths = [
  'packages/visual/docs/asset_governance.md',
  'packages/visual/public/assets',
  'packages/visual/public/assets/observer_house_v3/runtime',
  'packages/visual/public/assets/jy-runtime',
  'packages/visual/public/assets/jy-runtime/10_smap/_info.json',
  'packages/visual/public/assets/jy-runtime/08_thing/0079.png',
  'packages/visual/public/assets/jy-runtime/12_fight/Fight000/_info.json',
  'packages/visual/public/assets/jy-runtime/13_eft/003/0000.png',
  'packages/visual/public/assets/jy-runtime/14_head/2.png',
  'packages/visual/public/assets/jy-runtime/16_walk/2501.png',
  'packages/visual/public/assets/jy-runtime/17_npc_map/npc_1001.png',
  'packages/visual/public/assets/ai-resource/runtime',
  'packages/visual/public/assets/indoor_maps',
  'packages/visual/public/data',
];

const forbiddenPublicPaths = [
  'packages/visual/public/assets/observer_house_v1',
  'packages/visual/public/assets/observer_house_v2',
  'packages/visual/public/assets/observer_house_v3/raw',
  'packages/visual/public/assets/observer_house_v3/preview',
  'packages/visual/public/assets/observer_house_v3/metadata',
  'packages/visual/public/assets/observer_house_v3/cutouts',
  'packages/visual/public/assets/jy-assets',
  'packages/visual/assets-source',
];

const requiredSourcePaths = [
  `${externalAssetLibraryRoot}/README.md`,
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v1',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v2',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3/raw',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3/preview',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3/metadata',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/observer_house/v3/cutouts',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/jyqxz/full',
  '/Users/sunguanlong/Desktop/AIGC/assets-library/deepsolo/jyqxz/generated',
];

function exists(relPath) {
  return fs.existsSync(path.isAbsolute(relPath) ? relPath : path.join(repoRoot, relPath));
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(repoRoot, file);
}

function dirSizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return total;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const findings = [];
const warnings = [];

for (const relPath of requiredPaths) {
  if (!exists(relPath)) findings.push(`缺少资产治理路径：${relPath}`);
}

for (const relPath of forbiddenPublicPaths) {
  if (exists(relPath)) findings.push(`非运行素材仍在 public：${relPath}`);
}

for (const relPath of requiredSourcePaths) {
  if (!exists(relPath)) findings.push(`源素材归档缺失：${relPath}`);
}

for (const dsStore of walk(publicRoot, file => path.basename(file) === '.DS_Store')) {
  warnings.push(`public 内存在系统文件：${rel(dsStore)}`);
}

const looseStageDirs = walk(publicAssetsRoot, file => {
  const parts = file.split(path.sep);
  return parts.includes('raw') || parts.includes('preview') || parts.includes('metadata');
});
const looseStageSample = looseStageDirs
  .filter(file => !rel(file).startsWith('packages/visual/public/assets/jy-runtime/'))
  .slice(0, 12);
for (const file of looseStageSample) {
  warnings.push(`public 内疑似制作中间产物：${rel(file)}`);
}
if (looseStageDirs.length > looseStageSample.length) {
  warnings.push(`public 内仍有 ${looseStageDirs.length - looseStageSample.length} 个 raw/preview/metadata 文件，请按需继续归档`);
}

console.log('DeepSolo Visual Asset Audit');
console.log('===========================');
console.log(`public/assets 体量：${formatSize(dirSizeBytes(publicAssetsRoot))}`);
console.log(`外部素材库体量：${formatSize(dirSizeBytes(externalAssetLibraryRoot))}`);

if (findings.length) {
  console.log('\n必须修复：');
  for (const item of findings) console.log(`- ${item}`);
} else {
  console.log('\n必须项：通过');
}

if (warnings.length) {
  console.log('\n治理提醒：');
  for (const item of warnings) console.log(`- ${item}`);
} else {
  console.log('\n治理提醒：暂无');
}

console.log('\n说明：必须项会阻塞 audit:assets；治理提醒用于后续持续清理。');
process.exit(findings.length ? 1 : 0);
