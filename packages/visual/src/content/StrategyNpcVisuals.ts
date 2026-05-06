import type { Strategy } from '../types';

export interface StrategyNpcVisualDef {
  kind: 'chars_atlas' | 'static_texture';
  charKey?: string;
  textureKey?: string;
  scale: number;
  offsetY: number;
}

const DEFAULT_VISUAL: StrategyNpcVisualDef = {
  kind: 'chars_atlas',
  charKey: 'player',
  scale: 0.78,
  offsetY: 14,
};

const VISUAL_OVERRIDES: Record<string, StrategyNpcVisualDef> = {
  digital_master: {
    kind: 'static_texture',
    textureKey: 'token_center_shishu',
    scale: 0.54,
    offsetY: 10,
  },
};

export function getStrategyNpcVisual(strategy: Strategy): StrategyNpcVisualDef {
  return VISUAL_OVERRIDES[strategy.id] ?? DEFAULT_VISUAL;
}
