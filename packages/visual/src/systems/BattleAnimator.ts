import type Phaser from 'phaser';
import type { BattlePerson } from '../types';
import {
  DIRECTION_TO_BATTLE_ACTOR_DIR,
  getBattleActorDef,
  getBattleActorTextureKey,
  type BattleActorDef,
} from '../content/BattleActors';

export class BattleAnimator {
  private scene: Phaser.Scene;
  private actor: BattleActorDef;

  constructor(scene: Phaser.Scene, actorId = 'fight000') {
    this.scene = scene;
    this.actor = getBattleActorDef(actorId);
  }

  get scale(): number {
    return this.actor.scale;
  }

  get originX(): number {
    return this.actor.originX;
  }

  get originY(): number {
    return this.actor.originY;
  }

  get walkScale(): number {
    return this.actor.walkScale ?? this.actor.scale;
  }

  get walkOriginX(): number {
    return this.actor.walkOriginX ?? this.actor.originX;
  }

  get walkOriginY(): number {
    return this.actor.walkOriginY ?? this.actor.originY;
  }

  getIdleTextureKey(person: BattlePerson): string {
    const dir = DIRECTION_TO_BATTLE_ACTOR_DIR[person.facing];
    const frames = this.actor.animations.idle[dir];
    return getBattleActorTextureKey(this.actor, frames.start);
  }

  hasIdleTexture(person: BattlePerson): boolean {
    return this.scene.textures.exists(this.getIdleTextureKey(person));
  }

  resetToIdle(sprite: Phaser.GameObjects.Image, person: BattlePerson): void {
    const key = this.getIdleTextureKey(person);
    if (this.scene.textures.exists(key)) sprite.setTexture(key);
    sprite.setScale(this.actor.scale);
    sprite.setOrigin(this.actor.originX, this.actor.originY);
  }

  getWalkTextureKey(person: BattlePerson): string | null {
    const walk = this.actor.animations.walk;
    const prefix = this.actor.walkTexturePrefix;
    if (!walk || !prefix) return null;
    const dir = DIRECTION_TO_BATTLE_ACTOR_DIR[person.facing];
    const frames = walk[dir];
    return getBattleActorTextureKey(this.actor, frames.start, prefix);
  }

  hasWalkTexture(person: BattlePerson): boolean {
    const key = this.getWalkTextureKey(person);
    return !!key && this.scene.textures.exists(key);
  }

  playWalk(sprite: Phaser.GameObjects.Image, person: BattlePerson): Phaser.Time.TimerEvent | null {
    const walk = this.actor.animations.walk;
    const prefix = this.actor.walkTexturePrefix;
    if (!walk || !prefix) return null;

    const dir = DIRECTION_TO_BATTLE_ACTOR_DIR[person.facing];
    const frames = walk[dir];
    let frameIdx = frames.start;

    sprite.setScale(this.walkScale);
    sprite.setOrigin(this.walkOriginX, this.walkOriginY);

    const applyFrame = () => {
      const key = getBattleActorTextureKey(this.actor, frameIdx, prefix);
      if (this.scene.textures.exists(key)) sprite.setTexture(key);
      frameIdx = frameIdx >= frames.end ? frames.start : frameIdx + 1;
    };
    applyFrame();

    return this.scene.time.addEvent({
      delay: frames.frameIntervalMs,
      loop: frames.loop ?? true,
      callback: applyFrame,
    });
  }

  playAttack(sprite: Phaser.GameObjects.Image, person: BattlePerson): Phaser.Time.TimerEvent | null {
    this.resetToIdle(sprite, person);
    const dir = DIRECTION_TO_BATTLE_ACTOR_DIR[person.facing];
    const frames = this.actor.animations.attack[dir];
    let frameIdx = frames.start;
    const repeat = Math.max(0, frames.end - frames.start);

    const timer = this.scene.time.addEvent({
      delay: frames.frameIntervalMs,
      repeat,
      callback: () => {
        const key = getBattleActorTextureKey(this.actor, frameIdx);
        if (this.scene.textures.exists(key)) sprite.setTexture(key);
        frameIdx++;
      },
    });

    this.scene.time.delayedCall((repeat + 1) * frames.frameIntervalMs + 50, () => timer.remove());
    return timer;
  }
}
