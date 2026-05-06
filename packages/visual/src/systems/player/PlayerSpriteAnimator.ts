import { WALK_FRAME_INTERVAL } from '../../config';
import { Direction } from '../../types';
import type { PlayerAppearanceDef } from '../../content/PlayerAppearanceCatalog';

export function getPlayerAppearanceFrame(
  appearance: PlayerAppearanceDef,
  direction: Direction,
  frameIndex: number,
): number {
  const row = appearance.directionRows[direction] ?? appearance.directionRows[Direction.Down] ?? 0;
  const sequence = appearance.frameSequence?.length ? appearance.frameSequence : null;
  const sequenceFrame = sequence ? sequence[frameIndex % sequence.length] : frameIndex;
  const frame = Math.max(0, Math.min(sequenceFrame, appearance.frameCount - 1));
  return row * appearance.frameCount + frame;
}

export function applyPlayerAppearanceSprite(
  sprite: Phaser.GameObjects.Image,
  appearance: PlayerAppearanceDef,
  direction: Direction,
  indoorMode: boolean,
): void {
  const frame = getPlayerAppearanceFrame(appearance, direction, 0);
  sprite
    .setTexture(appearance.textureKey, frame)
    .setOrigin(appearance.originX, appearance.originY)
    .setScale(appearance.scale);
  sprite.y = indoorMode ? appearance.indoorOffsetY : appearance.worldOffsetY;
}

export function updatePlayerAppearanceWalkFrame(
  sprite: Phaser.GameObjects.Image,
  appearance: PlayerAppearanceDef,
  direction: Direction,
  moving: boolean,
  time: number,
): number {
  const animationFrameCount = appearance.frameSequence?.length || appearance.frameCount;
  const frameIndex = moving
    ? Math.floor(time / WALK_FRAME_INTERVAL) % animationFrameCount
    : 0;
  const frame = getPlayerAppearanceFrame(appearance, direction, frameIndex);
  if (sprite.texture.key !== appearance.textureKey || sprite.frame.name !== String(frame)) {
    sprite.setTexture(appearance.textureKey, frame);
  }
  return frameIndex;
}
