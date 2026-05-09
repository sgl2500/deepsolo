import type { BattleCharacterStance, BattleCharacterVisualId } from './BattleAssetCatalog';

const BATTLE_SPINE_ASSET_VERSION = 'v=2';

export type BattleSpineAction =
  | 'climbdown'
  | 'climbup'
  | 'climbuptoidle'
  | 'die'
  | 'glide'
  | 'hangLR'
  | 'hurt'
  | 'idle'
  | 'idle2'
  | 'idle3'
  | 'idlesquat'
  | 'jumping'
  | 'jumping2'
  | 'jumping2nd'
  | 'jumproll01'
  | 'roll'
  | 'run'
  | 'skill1'
  | 'skill2'
  | 'skill3'
  | 'skill4'
  | 'skill_combo1'
  | 'skill_combo2'
  | 'walk'
  | 'weaponskill02_1'
  | 'weaponskill02_123'
  | 'weaponskill02_2'
  | 'weaponskill02_3'
  | 'weaponskill05_1'
  | 'weaponskill05_123'
  | 'weaponskill05_2'
  | 'weaponskill05_3'
  | 'weaponskill07_1'
  | 'weaponskill07_123'
  | 'weaponskill07_2'
  | 'weaponskill07_3';

export interface BattleSpineAsset {
  dataKey: string;
  atlasKey: string;
  jsonSrc: string;
  atlasSrc: string;
  premultipliedAlpha: boolean;
}

export interface BattleSpineVisualDef {
  id: BattleCharacterVisualId;
  dataKey: string;
  atlasKey: string;
  assetFolder: 'role77' | 'role148';
  actions: readonly BattleSpineAction[];
  stanceMap: Record<BattleCharacterStance, BattleSpineAction>;
  scale: number;
  rootOffsetY: number;
  combatWidth: number;
  hitDelayMs: Partial<Record<BattleCharacterStance, number>>;
}

export const BATTLE_SPINE_ACTIONS: readonly BattleSpineAction[] = [
  'climbdown',
  'climbup',
  'climbuptoidle',
  'die',
  'glide',
  'hangLR',
  'hurt',
  'idle',
  'idle2',
  'idle3',
  'idlesquat',
  'jumping',
  'jumping2',
  'jumping2nd',
  'jumproll01',
  'roll',
  'run',
  'skill1',
  'skill2',
  'skill3',
  'skill4',
  'skill_combo1',
  'skill_combo2',
  'walk',
  'weaponskill02_1',
  'weaponskill02_123',
  'weaponskill02_2',
  'weaponskill02_3',
  'weaponskill05_1',
  'weaponskill05_123',
  'weaponskill05_2',
  'weaponskill05_3',
  'weaponskill07_1',
  'weaponskill07_123',
  'weaponskill07_2',
  'weaponskill07_3',
];

const DEFAULT_STANCE_MAP: Record<BattleCharacterStance, BattleSpineAction> = {
  idle: 'idle',
  run: 'run',
  attack: 'skill_combo1',
  hit: 'hurt',
  defense: 'idlesquat',
  dead: 'die',
};

const PLAYER_STANCE_MAP: Record<BattleCharacterStance, BattleSpineAction> = {
  ...DEFAULT_STANCE_MAP,
  attack: 'skill2',
};

export const BATTLE_SPINE_VISUALS: readonly BattleSpineVisualDef[] = [
  {
    id: 'player3',
    dataKey: 'battle_spine_role77_json',
    atlasKey: 'battle_spine_role77_atlas',
    assetFolder: 'role77',
    actions: BATTLE_SPINE_ACTIONS,
    stanceMap: PLAYER_STANCE_MAP,
    scale: 0.66,
    rootOffsetY: -28,
    combatWidth: 118,
    hitDelayMs: { attack: 260, hit: 160, defense: 180, dead: 980 },
  },
  {
    id: 'digital_master',
    dataKey: 'battle_spine_role148_json',
    atlasKey: 'battle_spine_role148_atlas',
    assetFolder: 'role148',
    actions: BATTLE_SPINE_ACTIONS,
    stanceMap: DEFAULT_STANCE_MAP,
    scale: 0.68,
    rootOffsetY: -30,
    combatWidth: 112,
    hitDelayMs: { attack: 610, hit: 160, defense: 180, dead: 980 },
  },
];

export function getBattleSpineAssets(): BattleSpineAsset[] {
  return BATTLE_SPINE_VISUALS.map(visual => {
    const root = `assets/battle/spine/${visual.assetFolder}`;
    return {
      dataKey: visual.dataKey,
      atlasKey: visual.atlasKey,
      jsonSrc: `${root}/${visual.assetFolder}.json?${BATTLE_SPINE_ASSET_VERSION}`,
      atlasSrc: `${root}/${visual.assetFolder}.atlas?${BATTLE_SPINE_ASSET_VERSION}`,
      premultipliedAlpha: false,
    };
  });
}

export function getBattleSpineVisualForActor(actorId: string): BattleSpineVisualDef | null {
  const visualId = resolveBattleCharacterVisualId(actorId);
  return BATTLE_SPINE_VISUALS.find(visual => visual.id === visualId) ?? null;
}

export function getBattleSpineAction(actorId: string, stance: BattleCharacterStance): BattleSpineAction | null {
  const visual = getBattleSpineVisualForActor(actorId);
  return visual?.stanceMap[stance] ?? null;
}

export function getBattleSpineHitDelayMs(actorId: string, stance: BattleCharacterStance): number | null {
  const visual = getBattleSpineVisualForActor(actorId);
  return visual?.hitDelayMs[stance] ?? null;
}

function resolveBattleCharacterVisualId(actorId: string): BattleCharacterVisualId | null {
  if (actorId === 'player') return 'player3';
  if (actorId === 'digital_master') return 'digital_master';
  return null;
}
