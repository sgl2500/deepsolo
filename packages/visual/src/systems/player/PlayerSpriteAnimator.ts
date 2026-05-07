import { WALK_FRAME_INTERVAL } from '../../config';
import { Direction } from '../../types';
import type {
  PlayerAppearanceDef,
  PlayerIsoFacingKey,
  PlayerIsoStaticFrameDef,
} from '../../content/PlayerAppearanceCatalog';

export type PlayerMoveVector = {
  dx: number;
  dy: number;
};

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
  moveVector?: PlayerMoveVector,
): void {
  const visualFrame = getPlayerVisualFrame(appearance, direction, 0, moveVector);
  sprite
    .setTexture(appearance.textureKey, visualFrame.frame)
    .setOrigin(appearance.originX, appearance.originY)
    .setScale(appearance.scale)
    .setFlipX(!!visualFrame.flipX);
  sprite.y = indoorMode ? appearance.indoorOffsetY : appearance.worldOffsetY;
}

export function updatePlayerAppearanceWalkFrame(
  sprite: Phaser.GameObjects.Image,
  appearance: PlayerAppearanceDef,
  direction: Direction,
  moving: boolean,
  time: number,
  moveVector?: PlayerMoveVector,
): number {
  if (appearance.isoStaticFrames) {
    const visualFrame = getPlayerVisualFrame(appearance, direction, 0, moveVector);
    if (sprite.texture.key !== appearance.textureKey || sprite.frame.name !== String(visualFrame.frame)) {
      sprite.setTexture(appearance.textureKey, visualFrame.frame);
    }
    sprite.setFlipX(!!visualFrame.flipX);
    return 0;
  }

  sprite.setFlipX(false);
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

function getPlayerVisualFrame(
  appearance: PlayerAppearanceDef,
  direction: Direction,
  frameIndex: number,
  moveVector?: PlayerMoveVector,
): PlayerIsoStaticFrameDef {
  if (appearance.isoStaticFrames) {
    const key = getIsoFacingKey(direction, moveVector);
    return appearance.isoStaticFrames[key] ?? appearance.isoStaticFrames.down ?? { frame: 0 };
  }
  return { frame: getPlayerAppearanceFrame(appearance, direction, frameIndex) };
}

function getIsoFacingKey(direction: Direction, moveVector?: PlayerMoveVector): PlayerIsoFacingKey {
  const dx = Math.sign(moveVector?.dx ?? 0);
  const dy = Math.sign(moveVector?.dy ?? 0);

  if (dx > 0 && dy > 0) return 'down';
  if (dx < 0 && dy < 0) return 'up';
  if (dx > 0 && dy < 0) return 'right';
  if (dx < 0 && dy > 0) return 'left';
  if (dx > 0) return 'downRight';
  if (dx < 0) return 'upLeft';
  if (dy > 0) return 'downLeft';
  if (dy < 0) return 'upRight';

  if (direction === Direction.Up) return 'up';
  if (direction === Direction.Right) return 'downRight';
  if (direction === Direction.Left) return 'upLeft';
  return 'down';
}
