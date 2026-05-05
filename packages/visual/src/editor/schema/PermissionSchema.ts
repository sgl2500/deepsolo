export type SceneVisitorPolicy = 'public' | 'friends' | 'private';

export type ScenePermission = {
  ownerId?: string;
  editors?: string[];
  visitors: SceneVisitorPolicy;
  canMoveObjects?: boolean;
  canPlaceObjects?: boolean;
  canDeleteObjects?: boolean;
  canInviteNpc?: boolean;
};

export type LandPermission = {
  ownerId?: string;
  canBuild: boolean;
  canSell: boolean;
  canVisit: boolean;
};
