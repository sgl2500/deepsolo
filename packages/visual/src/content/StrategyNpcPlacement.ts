import { Direction, type Strategy } from '../types';

export interface StrategyNpcSlot {
  mapX: number;
  mapY: number;
  direction: Direction;
}

export interface StrategyNpcPlacement {
  strategy: Strategy;
  slot: StrategyNpcSlot;
}

const STRATEGY_BUILDING_OVERRIDES: Record<string, string> = {
  hv1: 'teahouse',
  hv2: 'teahouse',
  hv3: 'teahouse',
  hv4: 'teahouse',
  nv1: 'exchange',
  nv2: 'exchange',
};

const BUILDING_STRATEGY_SLOTS: Record<string, StrategyNpcSlot[]> = {
  teahouse: [
    { mapX: 5.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 7.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 9.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 11.5, mapY: 8.5, direction: Direction.Down },
  ],
  exchange: [
    { mapX: 7.5, mapY: 9.5, direction: Direction.Down },
    { mapX: 9.5, mapY: 9.5, direction: Direction.Down },
    { mapX: 11.5, mapY: 9.5, direction: Direction.Down },
  ],
  token_center: [
    { mapX: 12, mapY: 20, direction: Direction.Down },
    { mapX: 16, mapY: 20, direction: Direction.Down },
    { mapX: 20, mapY: 20, direction: Direction.Down },
    { mapX: 24, mapY: 20, direction: Direction.Down },
    { mapX: 28, mapY: 20, direction: Direction.Down },
    { mapX: 12, mapY: 26, direction: Direction.Down },
    { mapX: 16, mapY: 26, direction: Direction.Down },
    { mapX: 20, mapY: 26, direction: Direction.Down },
    { mapX: 24, mapY: 26, direction: Direction.Down },
    { mapX: 28, mapY: 26, direction: Direction.Down },
  ],
  digital_sect: [
    { mapX: 26, mapY: 17, direction: Direction.Down },
    { mapX: 22.8, mapY: 18.4, direction: Direction.Down },
    { mapX: 16, mapY: 28, direction: Direction.Down },
    { mapX: 24, mapY: 28, direction: Direction.Down },
  ],
};

export function getStrategyBuildingId(strategy: Strategy): string {
  if (strategy.buildingId) {
    return strategy.buildingId;
  }
  if (STRATEGY_BUILDING_OVERRIDES[strategy.id]) {
    return STRATEGY_BUILDING_OVERRIDES[strategy.id];
  }
  if (strategy.category === 'hot') return 'teahouse';
  if (strategy.category === 'normal') return 'exchange';
  return 'teahouse';
}

export function shouldCreateWorldAgent(strategy: Strategy): boolean {
  return strategy.placement !== 'indoor-only';
}

export function getStrategyNpcPlacements(buildingId: string, strategies: Strategy[]): StrategyNpcPlacement[] {
  const slots = BUILDING_STRATEGY_SLOTS[buildingId] ?? [];
  if (slots.length === 0) return [];

  return strategies
    .filter(strategy => getStrategyBuildingId(strategy) === buildingId)
    .slice(0, slots.length)
    .map((strategy, index) => ({
      strategy,
      slot: slots[index],
    }));
}
