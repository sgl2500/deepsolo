import { assert, test, type TestCase } from './test_utils';
import { LS_KEY_AUTH_SESSION, LS_KEY_AUTH_USERS } from '../../src/config';
import { AuthStore, hashPassword, normalizeAuthSession, normalizeAuthUsers } from '../../src/core/AuthStore';

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

export const tests: TestCase[] = [
  test('seeds default sgl2500 account and logs in with password 123', () => {
    const storage = new MemoryStorage();
    const store = new AuthStore(undefined, storage);

    const result = store.login('sgl2500', '123');
    assert.equal(result.ok, true);
    assert.equal(store.session?.username, 'sgl2500');
    assert.ok(storage.getItem(LS_KEY_AUTH_SESSION));
  }),

  test('rejects wrong password for default account', () => {
    const store = new AuthStore(undefined, new MemoryStorage());
    const result = store.login('sgl2500', 'wrong');

    assert.equal(result.ok, false);
    assert.equal(store.session, null);
  }),

  test('registers new account and prevents duplicate username', () => {
    const storage = new MemoryStorage();
    const store = new AuthStore(undefined, storage);
    const registered = store.register('TraderA', 'abc123');

    assert.equal(registered.ok, true);
    assert.equal(store.session?.username, 'TraderA');
    assert.match(storage.getItem(LS_KEY_AUTH_USERS) ?? '', /TraderA/);

    const duplicate = store.register('tradera', 'abc123');
    assert.equal(duplicate.ok, false);
  }),

  test('normalizers reject malformed auth records and sessions', () => {
    const users = normalizeAuthUsers([
      { id: 'u1', username: 'alice', passwordSalt: 's', passwordHash: hashPassword('p', 's'), createdAt: 'now' },
      { id: 'bad', username: 'broken' },
    ]);

    assert.equal(users.length, 1);
    assert.equal(normalizeAuthSession({ userId: 'missing', username: 'alice' }, users), null);
    assert.equal(normalizeAuthSession({ userId: 'u1', username: 'alice', loginAt: 1 }, users)?.username, 'alice');
  }),
];
