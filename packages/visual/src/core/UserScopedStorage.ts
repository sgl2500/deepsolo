const LEGACY_OWNER = 'sgl2500';

function safeUserKey(username?: string | null): string | null {
  const value = username?.trim().toLowerCase();
  return value ? value.replace(/[^a-z0-9_-]/g, '_') : null;
}

export function getUserScopedStorageKey(baseKey: string, username?: string | null): string {
  const userKey = safeUserKey(username);
  return userKey ? `deepsolo_user_${userKey}_${baseKey}` : baseKey;
}

export function readUserScopedStorage(baseKey: string, username?: string | null): string | null {
  if (typeof localStorage === 'undefined') return null;
  const scopedKey = getUserScopedStorageKey(baseKey, username);
  const scoped = localStorage.getItem(scopedKey);
  if (scoped !== null) return scoped;

  // 当前已有的旧存档归属默认账号，首次登录后自动迁移到 sgl2500 名下。
  if (safeUserKey(username) === LEGACY_OWNER) {
    const legacy = localStorage.getItem(baseKey);
    if (legacy !== null) {
      localStorage.setItem(scopedKey, legacy);
      return legacy;
    }
  }

  return null;
}

export function writeUserScopedStorage(baseKey: string, value: string, username?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(getUserScopedStorageKey(baseKey, username), value);
}

export function removeUserScopedStorage(baseKey: string, username?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getUserScopedStorageKey(baseKey, username));
}
