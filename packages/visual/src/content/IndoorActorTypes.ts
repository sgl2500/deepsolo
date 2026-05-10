import type { Direction } from '../types';
import type { BattleSpineAction } from './BattleSpineCatalog';

export type IndoorActorKind = 'strategy_npc' | 'story_npc' | 'decorative_character' | 'merchant' | 'enemy';

export type IndoorActorInteractionType = 'chat' | 'gift' | 'battle' | 'profile' | 'dialogue' | 'story';

export type IndoorActorVisualDef =
  | {
      kind: 'spine';
      dataKey: string;
      atlasKey: string;
      scale: number;
      flipX?: boolean;
      offsetY: number;
      defaultAnimation: BattleSpineAction;
      actionMap?: Partial<Record<'idle' | 'talk' | 'attack' | 'hurt' | 'defense' | 'die', BattleSpineAction>>;
      fallbackTextureKey?: string;
    }
  | {
      kind: 'static_texture';
      textureKey: string;
      scale: number;
      flipX?: boolean;
      offsetY: number;
    }
  | {
      kind: 'chars_atlas';
      charKey: string;
      scale: number;
      flipX?: boolean;
      offsetY: number;
    };

export type IndoorActorColliderDef =
  | { type: 'circle'; radius: number }
  | { type: 'rect'; width: number; height: number; offsetX?: number; offsetY?: number };

export interface IndoorActorDef {
  id: string;
  sourceId: string;
  buildingId: string;
  kind: IndoorActorKind;
  name: string;
  position: {
    x: number;
    y: number;
    direction: Direction;
  };
  visual: IndoorActorVisualDef;
  collider?: IndoorActorColliderDef;
  interactions: IndoorActorInteractionType[];
}
