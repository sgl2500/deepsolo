const PLAYER_FOOTPRINT_RADIUS = 0.45;

export type IndoorDynamicNpcCollider = {
  id: string;
  buildingId: string;
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
};

const collidersByBuilding = new Map<string, Map<string, IndoorDynamicNpcCollider>>();

export function setIndoorDynamicNpcColliders(buildingId: string, colliders: IndoorDynamicNpcCollider[]): void {
  collidersByBuilding.set(
    buildingId,
    new Map(colliders.map((collider) => [collider.id, { ...collider, buildingId }])),
  );
}

export function upsertIndoorDynamicNpcColliders(buildingId: string, colliders: IndoorDynamicNpcCollider[]): void {
  const current = collidersByBuilding.get(buildingId) ?? new Map<string, IndoorDynamicNpcCollider>();
  for (const collider of colliders) {
    current.set(collider.id, { ...collider, buildingId });
  }
  collidersByBuilding.set(buildingId, current);
}

export function removeIndoorDynamicNpcColliders(buildingId: string, ids: string[]): void {
  const current = collidersByBuilding.get(buildingId);
  if (!current) return;
  for (const id of ids) current.delete(id);
  if (current.size === 0) collidersByBuilding.delete(buildingId);
}

export function clearIndoorDynamicNpcColliders(buildingId?: string): void {
  if (buildingId) {
    collidersByBuilding.delete(buildingId);
    return;
  }
  collidersByBuilding.clear();
}

export function isBlockedByIndoorDynamicNpc(buildingId: string | null, x: number, y: number): boolean {
  if (!buildingId) return false;
  const colliders = collidersByBuilding.get(buildingId);
  if (!colliders) return false;
  for (const collider of colliders.values()) {
    if (Number.isFinite(collider.width) && Number.isFinite(collider.height)) {
      const halfW = Math.max(0, (collider.width ?? 0) / 2) + PLAYER_FOOTPRINT_RADIUS;
      const halfH = Math.max(0, (collider.height ?? 0) / 2) + PLAYER_FOOTPRINT_RADIUS;
      if (Math.abs(x - collider.x) <= halfW && Math.abs(y - collider.y) <= halfH) {
        return true;
      }
      continue;
    }
    const radius = collider.radius ?? 0.55;
    const dx = x - collider.x;
    const dy = y - collider.y;
    if (Math.sqrt(dx * dx + dy * dy) <= radius + PLAYER_FOOTPRINT_RADIUS) {
      return true;
    }
  }
  return false;
}
