import { toActualIndoorMapPosition, type IndoorFurnitureDef } from '../../content/IndoorFurnitureLayout';

const FURNITURE_OCCLUDER_DEPTH_OFFSET = 8000;

export class FurnitureOccluderRenderer {
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private textureKeys: Map<string, string> = new Map();
  private textureSerial = 0;

  constructor(private scene: Phaser.Scene) {}

  update(
    furniture: IndoorFurnitureDef,
    baseSprite: Phaser.GameObjects.Image | null,
    container: Phaser.GameObjects.Container | null,
    buildingId: string | null,
    rebuildTexture = false,
  ): void {
    if (!container || !baseSprite || !buildingId) return;

    if ((furniture.occluderMask?.length ?? 0) < 3) {
      this.destroy(furniture.id);
      return;
    }

    let sprite = this.sprites.get(furniture.id) ?? null;
    if (rebuildTexture || !sprite) {
      const previousTextureKey = this.textureKeys.get(furniture.id);
      const textureKey = this.createTexture(furniture);
      if (!textureKey) {
        this.destroy(furniture.id);
        return;
      }

      sprite?.destroy();
      if (previousTextureKey && previousTextureKey !== textureKey && this.scene.textures.exists(previousTextureKey)) {
        this.scene.textures.remove(previousTextureKey);
      }
      sprite = this.scene.add.image(0, 0, textureKey);
      container.add(sprite);
      this.sprites.set(furniture.id, sprite);
    }

    this.sync(furniture, baseSprite, buildingId);
    container.sort('depth');
  }

  sync(furniture: IndoorFurnitureDef, baseSprite: Phaser.GameObjects.Image | null, buildingId: string | null): void {
    const occluderSprite = this.sprites.get(furniture.id);
    if (!baseSprite || !occluderSprite || !buildingId) return;

    occluderSprite
      .setPosition(baseSprite.x, baseSprite.y)
      .setOrigin(baseSprite.originX, baseSprite.originY)
      .setScale(baseSprite.scaleX, baseSprite.scaleY)
      .setAlpha(baseSprite.alpha)
      .setDepth(this.getDepth(furniture, buildingId));
  }

  destroy(furnitureId: string): void {
    this.sprites.get(furnitureId)?.destroy();
    this.sprites.delete(furnitureId);

    const textureKey = this.textureKeys.get(furnitureId);
    if (textureKey && this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }
    this.textureKeys.delete(furnitureId);
  }

  destroyAll(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();

    for (const textureKey of this.textureKeys.values()) {
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
    }
    this.textureKeys.clear();
  }

  private createTexture(furniture: IndoorFurnitureDef): string | null {
    const sourceTexture = this.scene.textures.get(furniture.textureKey);
    const sourceImage = sourceTexture?.getSourceImage();
    if (!sourceImage) return null;

    let imgSource: CanvasImageSource;
    if (
      sourceImage instanceof HTMLImageElement ||
      sourceImage instanceof HTMLCanvasElement ||
      sourceImage instanceof HTMLVideoElement
    ) {
      imgSource = sourceImage;
    } else {
      return null;
    }

    const width = imgSource.width as number;
    const height = imgSource.height as number;
    if (width <= 0 || height <= 0) return null;
    if (imgSource instanceof HTMLImageElement && !imgSource.complete) return null;

    const textureKey = `__furnitureOccluder_${furniture.id}_${++this.textureSerial}`;
    const canvasTexture = this.scene.textures.createCanvas(textureKey, width, height);
    if (!canvasTexture) return null;

    const ctx = canvasTexture.getContext();
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    const [first, ...rest] = furniture.occluderMask ?? [];
    ctx.moveTo(first.px, first.py);
    for (const point of rest) {
      ctx.lineTo(point.px, point.py);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(imgSource, 0, 0, width, height);
    ctx.restore();
    canvasTexture.refresh();

    this.textureKeys.set(furniture.id, textureKey);
    return textureKey;
  }

  private getDepth(furniture: IndoorFurnitureDef, buildingId: string): number {
    const depthPosition = toActualIndoorMapPosition(
      buildingId,
      furniture.depthLocalX ?? furniture.localX,
      furniture.depthLocalY ?? furniture.localY,
    );
    return depthPosition.mapX + depthPosition.mapY + (furniture.depthBias ?? 0) + FURNITURE_OCCLUDER_DEPTH_OFFSET;
  }
}
