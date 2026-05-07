import { assert, test, type TestCase } from './test_utils';
import { EventBus } from '../../src/core/EventBus';
import { GameStore } from '../../src/core/GameStore';
import { SHOP_PRODUCTS, getShopProduct } from '../../src/content/ShopCatalog';

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

function createStore(eventBus = new EventBus()): GameStore {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => ({
    ok: false,
  } as Response);
  return new GameStore(eventBus, 'sgl2500');
}

export const tests: TestCase[] = [
  test('shop catalog exposes manual products', () => {
    assert.ok(SHOP_PRODUCTS.length >= 3);
    assert.equal(getShopProduct('shop_manual_tuna_intro')?.manualId, 'manual_tuna_intro');
  }),

  test('buying a manual spends yuanbao and learns it immediately', () => {
    const eventBus = new EventBus();
    const purchases: Array<{ productId: string; manualId: string; price: number; learned: boolean }> = [];
    eventBus.on('shop:purchase', (event) => purchases.push(event));
    const store = createStore(eventBus);

    const result = store.purchaseManualWithYuanbao('shop_manual_tuna_intro', 'manual_tuna_intro', 30, true);

    assert.equal(result.ok, true);
    assert.equal(store.getYuanbao(), 70);
    assert.equal(store.hasManual('manual_tuna_intro'), true);
    assert.equal(store.playerProgress.manuals.find((item) => item.manualId === 'manual_tuna_intro')?.learned, true);
    assert.equal(store.hasItem('manual_tuna_intro'), false);
    assert.equal(purchases.length, 1);
    assert.deepEqual(purchases[0], {
      productId: 'shop_manual_tuna_intro',
      manualId: 'manual_tuna_intro',
      price: 30,
      learned: true,
    });
  }),

  test('buying fails when yuanbao is not enough', () => {
    const store = createStore();
    const result = store.purchaseManualWithYuanbao('shop_manual_expensive', 'manual_digital_fumo_intro', 1000, true);

    assert.equal(result.ok, false);
    assert.equal(store.getYuanbao(), 100);
    assert.equal(store.hasManual('manual_digital_fumo_intro'), false);
  }),

  test('buying fails when manual is already owned', () => {
    const store = createStore();
    store.purchaseManualWithYuanbao('shop_manual_tuna_intro', 'manual_tuna_intro', 30, true);
    const result = store.purchaseManualWithYuanbao('shop_manual_tuna_intro', 'manual_tuna_intro', 30, true);

    assert.equal(result.ok, false);
    assert.equal(store.getYuanbao(), 70);
  }),
];
