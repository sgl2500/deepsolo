import savedLayout from './world_layout_override.json' assert { type: 'json' };

export type LayoutOverrideItem = {
  id: string;
  entryX?: number;
  entryY?: number;
  visualX?: number;
  visualY?: number;
  depthX?: number;
  depthY?: number;
  entryRadius?: number;
  collisionX?: number;
  collisionY?: number;
  collisionRadius?: number;
  collisionPolygon?: Array<{ x: number; y: number }>;
  returnX?: number;
  returnY?: number;
};

export type LayoutOverride = {
  version: number;
  savedAt: number;
  items: LayoutOverrideItem[];
};

export const WORLD_LAYOUT_SOURCE = savedLayout as LayoutOverride;

export const WORLD_LAYOUT_SOURCE_SAVED_AT = Number.isFinite(WORLD_LAYOUT_SOURCE.savedAt)
  ? WORLD_LAYOUT_SOURCE.savedAt
  : 0;

