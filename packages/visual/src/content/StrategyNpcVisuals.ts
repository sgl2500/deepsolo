import type { Strategy } from '../types';
import type { IndoorActorVisualDef } from './IndoorActorTypes';

export type StrategyNpcVisualDef = IndoorActorVisualDef;

const DEFAULT_VISUAL: StrategyNpcVisualDef = {
  kind: 'chars_atlas',
  charKey: 'player',
  scale: 0.78,
  offsetY: 14,
};

const VISUAL_OVERRIDES: Record<string, StrategyNpcVisualDef> = {
  digital_master: {
    kind: 'spine',
    dataKey: 'battle_spine_role148_json',
    atlasKey: 'battle_spine_role148_atlas',
    scale: 0.34,
    flipX: true,
    offsetY: 18,
    defaultAnimation: 'idle',
    actionMap: {
      idle: 'idle',
      talk: 'idle2',
      attack: 'skill_combo1',
      hurt: 'hurt',
      defense: 'idlesquat',
      die: 'die',
    },
    fallbackTextureKey: 'token_center_shishu',
  },
  digital_elder: {
    kind: 'spine',
    dataKey: 'battle_spine_role148_digital_elder_json',
    atlasKey: 'battle_spine_role148_digital_elder_atlas',
    scale: 0.34,
    flipX: true,
    offsetY: 18,
    defaultAnimation: 'idle',
    actionMap: {
      idle: 'idle',
      talk: 'idle2',
      attack: 'skill_combo1',
      hurt: 'hurt',
      defense: 'idlesquat',
      die: 'die',
    },
    fallbackTextureKey: 'token_center_shishu',
  },
};

export function getStrategyNpcVisual(strategy: Strategy): StrategyNpcVisualDef {
  return VISUAL_OVERRIDES[strategy.id] ?? DEFAULT_VISUAL;
}
