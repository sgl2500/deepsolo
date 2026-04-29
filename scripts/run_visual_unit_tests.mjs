#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(import.meta.dirname, '..');
const visualRoot = path.join(repoRoot, 'packages', 'visual');
const requireFromVisual = createRequire(path.join(visualRoot, 'package.json'));
const esbuild = requireFromVisual('esbuild');

const outDir = path.join(os.tmpdir(), 'deepsolo-visual-unit-tests');
const outfile = path.join(outDir, 'run.mjs');
await fs.mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(visualRoot, 'tests', 'unit', 'run.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: 'inline',
  logLevel: 'silent',
});

const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
await mod.run();
