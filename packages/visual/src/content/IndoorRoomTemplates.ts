import { getAutomatedBuildings, type AutomatedBuildingSpec } from './AutomatedBuildingRegistry';

export type IndoorEditableTileLayer = 'floor' | 'wall' | 'rug';

export type IndoorFixedFloorTilesDef = {
  textureKeys: string[];
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
};

export type IndoorFixedWallTilesDef = {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  doorColStart?: number;
  doorColEnd?: number;
};

export type IndoorFixedVisualDef = {
  textureKey: string;
  localX: number;
  localY: number;
  scale?: number;
  alpha?: number;
  originX?: number;
  originY?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
  depthLocalX?: number;
  depthLocalY?: number;
  depthBias?: number;
};

export type IndoorFixedRoomDef = {
  skipTilemap: boolean;
  floorTiles?: IndoorFixedFloorTilesDef;
  wallTiles?: IndoorFixedWallTilesDef;
  visuals: IndoorFixedVisualDef[];
};

export type IndoorEditableTileRegion = {
  id: string;
  layer: IndoorEditableTileLayer;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  brushAssetIds?: string[];
  textureKeys?: string[];
  allowErase?: boolean;
  description?: string;
};

export type IndoorEditableLayers = {
  floor?: IndoorEditableTileRegion[];
  wall?: IndoorEditableTileRegion[];
  rug?: IndoorEditableTileRegion[];
};

export type IndoorRoomTemplate = {
  id: string;
  name: string;
  mapKey: string;
  /** Local room coordinate origin in the map grid. */
  localOrigin: { x: number; y: number };
  fixedRoom?: IndoorFixedRoomDef;
  editableLayers: IndoorEditableLayers;
  mode?: 'developer' | 'player';
};

function createAutomatedRoomTemplate(building: AutomatedBuildingSpec): IndoorRoomTemplate {
  const editableFloor = building.roomTemplate?.editableFloor;
  return {
    id: building.id,
    name: building.name,
    mapKey: building.indoorMapKey ?? `indoor_${building.id}`,
    localOrigin: building.roomTemplate?.localOrigin ?? { x: 3, y: 3 },
    editableLayers: editableFloor
      ? {
          floor: [
            {
              id: `${building.id}_floor`,
              layer: 'floor',
              rowStart: editableFloor.rowStart,
              rowEnd: editableFloor.rowEnd,
              colStart: editableFloor.colStart,
              colEnd: editableFloor.colEnd,
              brushAssetIds: editableFloor.brushAssetIds,
              textureKeys: editableFloor.textureKeys,
              allowErase: editableFloor.allowErase ?? true,
              description: editableFloor.description ?? `${building.name}地板装修区`,
            },
          ],
        }
      : {},
    mode: 'developer',
  };
}

export const INDOOR_ROOM_TEMPLATES: Record<string, IndoorRoomTemplate> = {
  birth_house: {
    id: 'birth_house',
    name: '观察者小屋',
    mapKey: 'indoor_birth_house',
    localOrigin: { x: 3, y: 3 },
    fixedRoom: {
      skipTilemap: true,
      floorTiles: {
        textureKeys: ['smap_66'],
        rowStart: 3,
        rowEnd: 22,
        colStart: 3,
        colEnd: 22,
      },
      wallTiles: {
        rowStart: 3,
        rowEnd: 22,
        colStart: 3,
        colEnd: 22,
        doorColStart: 12,
        doorColEnd: 13,
      },
      visuals: [],
    },
    editableLayers: {
      floor: [
        {
          id: 'birth_house_floor',
          layer: 'floor',
          rowStart: 3,
          rowEnd: 22,
          colStart: 3,
          colEnd: 22,
          textureKeys: ['smap_66'],
          allowErase: true,
          description: '观察者小屋固定地板区域',
        },
      ],
    },
    mode: 'developer',
  },
  token_center: {
    id: 'token_center',
    name: 'Token中心',
    mapKey: 'indoor_token_center',
    localOrigin: { x: 3, y: 3 },
    editableLayers: {
      floor: [
        {
          id: 'token_center_floor',
          layer: 'floor',
          rowStart: 4,
          rowEnd: 36,
          colStart: 4,
          colEnd: 36,
          brushAssetIds: [
            'tile_floor_token_center_0514',
            'tile_rug_0309',
            'tile_rug_0313',
            'tile_rug_0330',
          ],
          allowErase: true,
          description: 'Token中心室内地板区域',
        },
      ],
    },
    mode: 'developer',
  },
  ...Object.fromEntries(getAutomatedBuildings().map((building) => [
    building.id,
    createAutomatedRoomTemplate(building),
  ])),
};

export function getIndoorRoomTemplate(buildingId: string | null): IndoorRoomTemplate | null {
  if (!buildingId) return null;
  const template = INDOOR_ROOM_TEMPLATES[buildingId];
  if (template) return template;
  const automatedBuilding = getAutomatedBuildings().find((building) => building.id === buildingId);
  return automatedBuilding ? createAutomatedRoomTemplate(automatedBuilding) : null;
}

export function getIndoorEditableTileRegions(
  buildingId: string | null,
  layer: IndoorEditableTileLayer,
): IndoorEditableTileRegion[] {
  return getIndoorRoomTemplate(buildingId)?.editableLayers[layer] ?? [];
}

export function isIndoorTileEditable(
  buildingId: string | null,
  layer: IndoorEditableTileLayer,
  col: number,
  row: number,
): boolean {
  return getIndoorEditableTileRegions(buildingId, layer).some((region) => (
    col >= region.colStart &&
    col <= region.colEnd &&
    row >= region.rowStart &&
    row <= region.rowEnd
  ));
}
