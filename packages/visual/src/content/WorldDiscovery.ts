export type StoryFlagMap = Record<string, any>;

const WORLD_BUILDING_UNLOCK_FLAGS: Record<string, string> = {
  exchange: 'world.unlock.a_share_clue',
  trial_cave: 'world.unlock.trial_cave',
  construction_site: 'world.unlock.construction_site',
};

let storyFlagsRef: StoryFlagMap | null = null;

export function setWorldDiscoveryStoryFlags(flags: StoryFlagMap): void {
  storyFlagsRef = flags;
}

export function getWorldBuildingUnlockFlag(buildingId: string): string | null {
  return WORLD_BUILDING_UNLOCK_FLAGS[buildingId] ?? null;
}

export function isWorldBuildingUnlocked(buildingId: string): boolean {
  const flag = getWorldBuildingUnlockFlag(buildingId);
  if (!flag) return true;
  if (!storyFlagsRef) return true;
  return Boolean(storyFlagsRef[flag]);
}
