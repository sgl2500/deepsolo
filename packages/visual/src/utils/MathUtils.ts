// ============================================================
// MathUtils.ts — 数学工具
// ============================================================

/** 随机整数 [min, max] */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 随机选取数组元素 */
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 限制范围 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 格式化时间 HH:MM:SS */
export function formatTime(date: Date = new Date()): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(v => String(v).padStart(2, '0')).join(':');
}

/** 检查 Phaser Frame 是否有效且非空 */
export function isFrameValid(frame: Phaser.Textures.Frame | false | undefined): frame is Phaser.Textures.Frame {
  return !!frame && !(frame as any).isEmpty;
}
