#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const visualRoot = path.join(repoRoot, 'packages', 'visual');
const srcRoot = path.join(visualRoot, 'src');

const requiredDocs = [
  'docs/project_governance.md',
  'docs/technical_debt_register.md',
  'docs/large_file_governance.md',
  'packages/visual/docs/visual_governance.md',
  'packages/visual/docs/battle_system_refactor_plan.md',
  'packages/visual/docs/map_renderer_refactor_plan.md',
  'packages/visual/docs/world_map_editor.md',
  'packages/visual/docs/battle_system_tuning.md',
];

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(repoRoot, file);
}

const findings = [];
const warnings = [];

for (const doc of requiredDocs) {
  if (!fs.existsSync(path.join(repoRoot, doc))) findings.push(`缺少治理文档：${doc}`);
}

const pkgPath = path.join(visualRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
for (const script of ['typecheck', 'test:unit', 'check', 'audit:governance', 'build']) {
  if (!pkg.scripts?.[script]) findings.push(`packages/visual/package.json 缺少脚本：${script}`);
}

const sourceFiles = walk(srcRoot, (file) => /\.(ts|css)$/.test(file));
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').length;
  if (lines > 2200) warnings.push(`超大文件需要按 docs/large_file_governance.md 拆分：${rel(file)} (${lines} 行)`);
  else if (lines > 1500) warnings.push(`大文件需要保持拆分计划：${rel(file)} (${lines} 行)`);

  if (/console\.log\(/.test(text)) warnings.push(`存在 console.log：${rel(file)}`);
  if (file.endsWith('WorldScene.ts') && /find\(b\s*=>\s*true\)/.test(text)) {
    warnings.push(`疑似错误 debug 逻辑：${rel(file)} 使用 BUILDINGS.find(b => true)`);
  }
  const isDebugInfoOwner = file.endsWith('UIManager.ts') || file.endsWith('WorldScene.ts') || file.endsWith('styles.css');
  if (/#debug-info|debug-info/.test(text) && !isDebugInfoOwner) {
    warnings.push(`debug-info 引用分散：${rel(file)}`);
  }
}

console.log('DeepSolo Visual Governance Audit');
console.log('================================');
console.log(`源文件数量：${sourceFiles.length}`);

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

console.log('\n说明：audit 目前只做治理提示，不阻塞构建。真正交付门禁以 npm run check 为准。');
process.exit(findings.length ? 1 : 0);
