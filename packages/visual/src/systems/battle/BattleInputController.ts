export type BattleInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

export class BattleInputController {
  private keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    confirm: Phaser.Input.Keyboard.Key;
    cancel: Phaser.Input.Keyboard.Key;
    toggleAuto: Phaser.Input.Keyboard.Key;
  } | null = null;

  constructor(private scene: Phaser.Scene) {}

  init(): void {
    const kb = this.scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      confirm: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      cancel: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      toggleAuto: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
    };
  }

  consumeToggleAuto(): boolean {
    return !!this.keys?.toggleAuto && Phaser.Input.Keyboard.JustDown(this.keys.toggleAuto);
  }

  consumeInput(): BattleInput | null {
    if (!this.keys) return null;
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) return 'up';
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) return 'down';
    if (Phaser.Input.Keyboard.JustDown(this.keys.left)) return 'left';
    if (Phaser.Input.Keyboard.JustDown(this.keys.right)) return 'right';
    if (Phaser.Input.Keyboard.JustDown(this.keys.confirm)) return 'confirm';
    if (Phaser.Input.Keyboard.JustDown(this.keys.cancel)) return 'cancel';
    return null;
  }
}
