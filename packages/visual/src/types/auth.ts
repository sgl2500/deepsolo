export interface AuthUser {
  id: string;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  loginAt: number;
}

export type AuthResult =
  | { ok: true; user: AuthUser; session: AuthSession }
  | { ok: false; message: string };
