/** 方向: 上=0, 右=1, 左=2, 下=3 */
export enum Direction {
  Up = 0,
  Right = 1,
  Left = 2,
  Down = 3,
}

/** 角色元数据 (来自 char_meta.json) */
export interface CharMeta {
  chars: Record<string, { xoff: number; yoff: number }>;
  mapping: Record<string, string>;
}

/** 瓦片元数据 (来自 tile_meta.json) */
export type TileMeta = Record<string, { xoff: number; yoff: number }>;

/** 地图数据 (来自 map_data.json) */
export interface MapData {
  width: number;
  height: number;
  cx: number;
  cy: number;
  earth: number[][];
  surface: number[][];
  building?: number[][];
  surfaceHeight?: number[][];
}

/** 气泡配置 */
export interface BubbleConfig {
  width?: number;
  height?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  bgColor?: number;
  bgAlpha?: number;
  textColor?: string;
  fontSize?: string;
  yOffset?: number;
}
