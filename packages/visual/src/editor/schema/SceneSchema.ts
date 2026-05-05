export type EditableSceneType = 'world' | 'indoor';

export type SceneObjectKind =
  | 'worldBuilding'
  | 'worldDecor'
  | 'indoorFurniture'
  | 'indoorCharacter'
  | 'wallDecor'
  | 'floorDecor'
  | 'portal'
  | 'interactable'
  | 'collision'
  | 'spawnPoint';

export type SceneLayer =
  | 'terrain'
  | 'floor'
  | 'rug'
  | 'wall'
  | 'wallDecor'
  | 'building'
  | 'object'
  | 'character'
  | 'foreground'
  | 'portal'
  | 'collision'
  | 'interaction'
  | 'debug';

export type SceneDepthMode = 'fixed' | 'behindActor' | 'ySort' | 'aboveActor' | 'debug';

export type SceneVector2 = {
  x: number;
  y: number;
};

export type SceneTransform = {
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  pixelOffsetX?: number;
  pixelOffsetY?: number;
};

export type SceneDepth = {
  mode: SceneDepthMode;
  point?: SceneVector2;
  bias?: number;
};

export type SceneRectCollider = {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneCircleCollider = {
  type: 'circle';
  x: number;
  y: number;
  radius: number;
};

export type ScenePolygonCollider = {
  type: 'polygon';
  points: SceneVector2[];
};

export type SceneCollider = SceneRectCollider | SceneCircleCollider | ScenePolygonCollider;

export type SceneInteraction = {
  type: 'trigger' | 'dialogue' | 'portal' | 'rest' | 'custom';
  radius?: number;
  zone?: SceneCollider;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type ScenePortal = {
  targetSceneId: string;
  targetPosition?: SceneVector2;
  returnPosition?: SceneVector2;
};

export type PlacedSceneObject = {
  id: string;
  sceneId: string;
  sceneType: EditableSceneType;
  assetId?: string;
  kind: SceneObjectKind;
  layer: SceneLayer;
  position: SceneVector2;
  transform?: SceneTransform;
  depth?: SceneDepth;
  collider?: SceneCollider;
  interaction?: SceneInteraction;
  portal?: ScenePortal;
  ownerId?: string;
  locked?: boolean;
  metadata?: Record<string, unknown>;
};

export type EditableSceneSnapshot = {
  version: 1;
  sceneId: string;
  sceneType: EditableSceneType;
  templateId?: string;
  ownerId?: string;
  savedAt: number;
  objects: PlacedSceneObject[];
  metadata?: Record<string, unknown>;
};

export type SceneLayerRule = {
  layer: SceneLayer;
  depthMode: SceneDepthMode;
  editable: boolean;
  collidable: boolean;
  playerPlaceable: boolean;
};
