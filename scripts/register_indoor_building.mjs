#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const registryPath = path.join(repoRoot, 'packages/visual/src/content/generated_buildings.json');
const indoorMapDir = path.join(repoRoot, 'packages/visual/public/assets/maps/indoor');

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.id || !args.name || !args.x || !args.y) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const id = normalizeId(args.id);
const entryX = toNumber(args.x, 'x');
const entryY = toNumber(args.y, 'y');
const sourceMapKey = args['source-map'] ?? 'indoor_news';
const indoorMapKey = args['indoor-map-key'] ?? `indoor_${id}`;
const registry = readJson(registryPath, []);
const existingIndex = registry.findIndex((item) => item.id === id);

const building = {
  id,
  name: args.name,
  entryX,
  entryY,
  entryRadius: toOptionalNumber(args.radius) ?? 2,
  indoorMapKey,
  spawnX: toOptionalNumber(args['spawn-x']) ?? 10,
  spawnY: toOptionalNumber(args['spawn-y']) ?? 10,
  doorSpawnX: toOptionalNumber(args['door-x']) ?? 10,
  doorSpawnY: toOptionalNumber(args['door-y']) ?? 17,
  exitX: toOptionalNumber(args['exit-x']) ?? 10,
  exitY: toOptionalNumber(args['exit-y']) ?? 19,
  returnX: toOptionalNumber(args['return-x']) ?? entryX,
  returnY: toOptionalNumber(args['return-y']) ?? entryY + 3,
  worldVisual: {
    textureKey: args['visual-key'] ?? 'world_building_a_share',
    ...(args['visual-file'] ? { file: args['visual-file'] } : {}),
    originY: toOptionalNumber(args['visual-origin-y']) ?? 0.9,
    offsetY: toOptionalNumber(args['visual-offset-y']) ?? 0,
    labelY: toOptionalNumber(args['visual-label-y']) ?? -156,
    scale: toOptionalNumber(args['visual-scale']) ?? 1,
  },
  roomTemplate: {
    localOrigin: {
      x: toOptionalNumber(args['origin-x']) ?? 3,
      y: toOptionalNumber(args['origin-y']) ?? 3,
    },
    editableFloor: {
      rowStart: toOptionalNumber(args['floor-row-start']) ?? 4,
      rowEnd: toOptionalNumber(args['floor-row-end']) ?? 34,
      colStart: toOptionalNumber(args['floor-col-start']) ?? 4,
      colEnd: toOptionalNumber(args['floor-col-end']) ?? 34,
      brushAssetIds: splitCsv(args['floor-brushes'] ?? 'tile_floor_token_center_0514,tile_rug_0309,tile_rug_0313,tile_rug_0330'),
      description: `${args.name}默认地板装修区`,
    },
  },
  furniture: args['starter-decor'] === 'false' ? [] : createStarterFurniture(),
};

if (existingIndex >= 0) {
  registry[existingIndex] = building;
} else {
  registry.push(building);
}
writeJson(registryPath, registry);
copyIndoorMap(sourceMapKey, indoorMapKey, id);

console.log(`Registered indoor building: ${id}`);
console.log(`- registry: ${path.relative(repoRoot, registryPath)}`);
console.log(`- map: packages/visual/public/assets/maps/indoor/${indoorMapKey}.json`);

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'help') {
      result.help = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = 'true';
    } else {
      result[key] = next;
      i++;
    }
  }
  return result;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/register_indoor_building.mjs --id player_shop --name 玩家商铺 --x 64 --y 88

Common options:
  --source-map indoor_news              Copy an existing indoor map JSON as the room base.
  --visual-key world_building_a_share   Use an already preloaded world building texture.
  --visual-file custom.png              Also preload assets/world/buildings/custom.png.
  --starter-decor false                 Create an empty room instead of starter furniture.
  --floor-brushes a,b,c                 AssetCatalog ids exposed in the floor brush palette.
`);
}

function normalizeId(value) {
  const id = String(value).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!id) throw new Error('Invalid --id');
  return id;
}

function toNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid --${name}: ${value}`);
  return parsed;
}

function toOptionalNumber(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitCsv(value) {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copyIndoorMap(sourceMapKey, indoorMapKey, buildingId) {
  const source = path.join(indoorMapDir, `${sourceMapKey}.json`);
  const target = path.join(indoorMapDir, `${indoorMapKey}.json`);
  if (!fs.existsSync(source)) throw new Error(`Source indoor map not found: ${source}`);
  const map = readJson(source, {});
  map.source = {
    type: 'generated_from_template',
    template: sourceMapKey,
    buildingId,
    generatedBy: 'scripts/register_indoor_building.mjs',
  };
  writeJson(target, map);
}

function createStarterFurniture() {
  return [
    {
      id: 'starter_table',
      assetId: 'furniture_birth_house_table',
      localX: 10,
      localY: 13,
      scale: 0.55,
      depthLocalX: 10,
      depthLocalY: 13,
      collider: { minLocalX: 8.8, maxLocalX: 11.2, minLocalY: 11.8, maxLocalY: 14.2 },
    },
    {
      id: 'starter_bookshelf',
      assetId: 'furniture_birth_house_bookshelf',
      localX: 8,
      localY: 4,
      scale: 0.54,
      collider: { minLocalX: 7.2, maxLocalX: 8.8, minLocalY: 3.2, maxLocalY: 4.8 },
    },
    {
      id: 'starter_chest',
      assetId: 'furniture_birth_house_chest',
      localX: 13,
      localY: 6,
      scale: 0.5,
      collider: { minLocalX: 12.2, maxLocalX: 13.8, minLocalY: 5.2, maxLocalY: 6.8 },
    },
  ];
}
