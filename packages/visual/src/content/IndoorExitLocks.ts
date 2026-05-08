export const BIRTH_HOUSE_LOCKED_EXIT_MAX_Y = 21.75;

/**
 * Blocks the birth-house doorway while the intro requires talking to Gushen.
 * The room's real wall/door line is inset at y=22, so this keeps the player
 * on the room side of the threshold instead of letting them step into black.
 */
export function isBlockedByLockedIndoorExit(
  buildingId: string | null,
  exitBlocked: boolean,
  _x: number,
  y: number,
): boolean {
  if (!exitBlocked || buildingId !== 'birth_house') return false;
  return y > BIRTH_HOUSE_LOCKED_EXIT_MAX_Y;
}
