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
    { mapX: 6.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 8.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 10.5, mapY: 8.5, direction: Direction.Down },
    { mapX: 12.5, mapY: 8.5, direction: Direction.Down },
  ],
};

export function getStrategyBuildingId(strategy: Strategy): string {
  if (STRATEGY_BUILDING_OVERRIDES[strategy.id]) {
    return STRATEGY_BUILDING_OVERRIDES[strategy.id];
  }
  if (strategy.category === 'hot') return 'teahouse';
  if (strategy.category === 'normal') return 'exchange';
  return 'teahouse';
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
