import { assert, test, type TestCase } from './test_utils';
import { EventBus } from '../../src/core/EventBus';
import { GameStore } from '../../src/core/GameStore';

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function createStore(): GameStore {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => ({
    ok: false,
  } as Response);
  return new GameStore(new EventBus(), 'sgl2500');
}

export const tests: TestCase[] = [
  test('default player starts with yuanbao', () => {
    const store = createStore();
    assert.equal(store.getYuanbao(), 100);
  }),

  test('gifting yuanbao spends currency and increases npc favor', () => {
    const eventBus = new EventBus();
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => ({ ok: false } as Response);

    const changed: Array<{ favorBefore: number; favorAfter: number; amount: number }> = [];
    eventBus.on('npc:favor-changed', (event) => changed.push(event));
    const store = new GameStore(eventBus, 'sgl2500');

    const result = store.giftYuanbaoToNpc('master_chen', 10);

    assert.equal(result.ok, true);
    assert.equal(store.getYuanbao(), 90);
    assert.equal(store.getNpcFavor('master_chen'), 10);
    assert.equal(store.playerProgress.npcAffinities.master_chen.giftedYuanbaoTotal, 10);
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0], { npcId: 'master_chen', favorBefore: 0, favorAfter: 10, amount: 10 });
  }),

  test('gifting fails when yuanbao is not enough', () => {
    const store = createStore();
    const result = store.giftYuanbaoToNpc('master_chen', 1000);

    assert.equal(result.ok, false);
    assert.equal(store.getYuanbao(), 100);
    assert.equal(store.getNpcFavor('master_chen'), 0);
  }),

  test('digital master can receive yuanbao as strategy npc affinity target', () => {
    const store = createStore();
    const result = store.giftYuanbaoToNpc('digital_master', 10);

    assert.equal(result.ok, true);
    assert.equal(store.getYuanbao(), 90);
    assert.equal(store.getNpcFavor('digital_master'), 10);
    assert.equal(store.playerProgress.npcAffinities.digital_master.giftedYuanbaoTotal, 10);
  }),
];
