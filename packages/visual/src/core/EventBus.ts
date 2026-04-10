// ============================================================
// EventBus.ts — 类型安全的发布/订阅
// ============================================================

import type { GameEvents } from '../types';

type EventCallback<T> = T extends void ? () => void : (data: T) => void;

// 用于内部存储的类型擦除回调
type AnyCallback = (data?: any) => void;

export class EventBus {
  private listeners = new Map<string, Set<AnyCallback>>();

  on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const wrapped = callback as AnyCallback;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach(fn => (args.length > 0 ? fn(args[0]) : fn()));
  }

  off<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    this.listeners.get(event)?.delete(callback as AnyCallback);
  }

  clear(): void {
    this.listeners.clear();
  }
}
