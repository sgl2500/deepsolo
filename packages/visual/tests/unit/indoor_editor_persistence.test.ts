import { assert, test, type TestCase } from './test_utils';
import { getIndoorFurnitureDefs } from '../../src/content/IndoorFurnitureLayout';
import { getIndoorInteractables } from '../../src/content/IndoorInteractables';
import {
  applyFurnitureEditorSnapshot,
  applyInteractableEditorSnapshot,
  createFurnitureEditorSnapshot,
  createInteractableEditorSnapshot,
  loadFurnitureEditorSnapshot,
  loadInteractableEditorSnapshot,
  saveFurnitureEditorSnapshot,
  saveInteractableEditorSnapshot,
} from '../../src/systems/map/IndoorEditorPersistence';

function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  });
}

export const tests: TestCase[] = [
  test('furniture snapshot can restore edited furniture values', () => {
    const original = createFurnitureEditorSnapshot('birth_house');
    const bed = getIndoorFurnitureDefs('birth_house').find((item) => item.id === 'bed')!;
    bed.localX = 99;
    bed.collider = undefined;
    applyFurnitureEditorSnapshot('birth_house', original);
    assert.equal(bed.localX, original.find((item) => item.id === 'bed')!.localX);
    assert.deepEqual(bed.collider, original.find((item) => item.id === 'bed')!.collider);
  }),

  test('furniture snapshot saves and loads from localStorage', () => {
    installLocalStorageStub();
    const snapshot = createFurnitureEditorSnapshot('birth_house');
    saveFurnitureEditorSnapshot('birth_house', snapshot);
    assert.deepEqual(loadFurnitureEditorSnapshot('birth_house')?.map((item) => item.id), snapshot.map((item) => item.id));
  }),

  test('interactable snapshot can restore edited map position', () => {
    const original = createInteractableEditorSnapshot('birth_house');
    const bed = getIndoorInteractables('birth_house').find((item) => item.id === 'birth_house_bed')!;
    bed.mapX = 88;
    bed.interactionZone = undefined;
    applyInteractableEditorSnapshot('birth_house', original);
    const saved = original.find((item) => item.id === 'birth_house_bed')!;
    assert.equal(bed.mapX, saved.mapX);
    assert.deepEqual(bed.interactionZone, saved.interactionZone);
  }),

  test('interactable snapshot saves and loads from localStorage', () => {
    installLocalStorageStub();
    const snapshot = createInteractableEditorSnapshot('birth_house');
    saveInteractableEditorSnapshot('birth_house', snapshot);
    assert.deepEqual(loadInteractableEditorSnapshot('birth_house')?.map((item) => item.id), snapshot.map((item) => item.id));
  }),
];
