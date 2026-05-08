// ============================================================
// AuthStore.ts — 本地演示账号系统
// ============================================================

import type { AuthResult, AuthSession, AuthUser } from '../types';
import { ENABLE_DEMO_AUTH, LS_KEY_AUTH_SESSION, LS_KEY_AUTH_USERS } from '../config';
import type { EventBus } from './EventBus';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DEFAULT_USERNAME = 'sgl2500';
const DEFAULT_PASSWORD = '123';
const DEFAULT_SALT = 'deepsolo_default_sgl2500_v1';

function getLocalStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function nowDate(): string {
  return new Date().toISOString();
}

function uid(username: string): string {
  return `user_${username.toLowerCase()}_${Date.now().toString(36)}`;
}

function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

function createSalt(username: string): string {
  return `${usernameKey(username)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 本地轻量哈希：用于避免明文落盘；正式线上版本应迁移到后端安全哈希。 */
export function hashPassword(password: string, salt: string): string {
  let h1 = 0xdeadbeef ^ salt.length;
  let h2 = 0x41c6ce57 ^ password.length;
  const input = `${salt}:${password}`;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = (h2 >>> 0).toString(16).padStart(8, '0');
  const lo = (h1 >>> 0).toString(16).padStart(8, '0');
  return `${hi}${lo}`;
}

export function createAuthUser(username: string, password: string, salt = createSalt(username)): AuthUser {
  const safeUsername = username.trim();
  return {
    id: uid(safeUsername),
    username: safeUsername,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: nowDate(),
  };
}

export function normalizeAuthUsers(raw: unknown): AuthUser[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const users: AuthUser[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const data = item as Partial<AuthUser>;
    if (
      typeof data.id !== 'string'
      || typeof data.username !== 'string'
      || typeof data.passwordSalt !== 'string'
      || typeof data.passwordHash !== 'string'
    ) continue;
    const key = usernameKey(data.username);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    users.push({
      id: data.id,
      username: data.username.trim(),
      passwordSalt: data.passwordSalt,
      passwordHash: data.passwordHash,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : nowDate(),
    });
  }
  return users;
}

export function normalizeAuthSession(raw: unknown, users: AuthUser[]): AuthSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AuthSession>;
  if (typeof data.userId !== 'string' || typeof data.username !== 'string') return null;
  const userId = data.userId;
  const sessionUsername = data.username;
  const user = users.find(item => item.id === userId && usernameKey(item.username) === usernameKey(sessionUsername));
  if (!user) return null;
  return {
    userId: user.id,
    username: user.username,
    loginAt: typeof data.loginAt === 'number' && Number.isFinite(data.loginAt) ? data.loginAt : Date.now(),
  };
}

export class AuthStore {
  users: AuthUser[] = [];
  session: AuthSession | null = null;

  private storage: StorageLike | null;
  private eventBus?: EventBus;

  constructor(eventBus?: EventBus, storage: StorageLike | null = getLocalStorage()) {
    this.eventBus = eventBus;
    this.storage = storage;
    this.init();
  }

  getCurrentUser(): AuthUser | null {
    if (!this.session) return null;
    return this.users.find(user => user.id === this.session?.userId) ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  login(username: string, password: string): AuthResult {
    const user = this.findUser(username);
    if (!user || user.passwordHash !== hashPassword(password, user.passwordSalt)) {
      return { ok: false, message: '用户名或密码不正确' };
    }
    const session = this.createSession(user);
    this.session = session;
    this.persistSession();
    this.eventBus?.emit('auth:login', session);
    this.eventBus?.emit('auth:changed', session);
    return { ok: true, user, session };
  }

  register(username: string, password: string): AuthResult {
    const safeUsername = username.trim();
    if (safeUsername.length < 3) return { ok: false, message: '用户名至少 3 个字符' };
    if (password.length < 3) return { ok: false, message: '密码至少 3 个字符' };
    if (this.findUser(safeUsername)) return { ok: false, message: '这个用户名已经被注册' };

    const user = createAuthUser(safeUsername, password);
    this.users.push(user);
    this.persistUsers();
    const session = this.createSession(user);
    this.session = session;
    this.persistSession();
    this.eventBus?.emit('auth:login', session);
    this.eventBus?.emit('auth:changed', session);
    return { ok: true, user, session };
  }

  logout(): void {
    this.session = null;
    this.storage?.removeItem(LS_KEY_AUTH_SESSION);
    this.eventBus?.emit('auth:logout');
    this.eventBus?.emit('auth:changed', null);
  }

  private init(): void {
    this.users = this.loadUsers();
    if (ENABLE_DEMO_AUTH) this.ensureDefaultUser();
    this.persistUsers();
    this.session = this.loadSession();
  }

  private loadUsers(): AuthUser[] {
    try {
      const raw = this.storage?.getItem(LS_KEY_AUTH_USERS);
      return raw ? normalizeAuthUsers(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  private loadSession(): AuthSession | null {
    try {
      const raw = this.storage?.getItem(LS_KEY_AUTH_SESSION);
      return raw ? normalizeAuthSession(JSON.parse(raw), this.users) : null;
    } catch {
      return null;
    }
  }

  private ensureDefaultUser(): void {
    if (this.findUser(DEFAULT_USERNAME)) return;
    this.users.unshift(createAuthUser(DEFAULT_USERNAME, DEFAULT_PASSWORD, DEFAULT_SALT));
  }

  private findUser(username: string): AuthUser | undefined {
    const key = usernameKey(username);
    return this.users.find(user => usernameKey(user.username) === key);
  }

  private createSession(user: AuthUser): AuthSession {
    return {
      userId: user.id,
      username: user.username,
      loginAt: Date.now(),
    };
  }

  private persistUsers(): void {
    this.storage?.setItem(LS_KEY_AUTH_USERS, JSON.stringify(this.users));
  }

  private persistSession(): void {
    if (this.session) this.storage?.setItem(LS_KEY_AUTH_SESSION, JSON.stringify(this.session));
  }
}
