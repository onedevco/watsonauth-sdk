export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  appId: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

export interface WatsonAuthConfig {
  baseUrl: string;
  appSlug: string;
  autoRefresh?: boolean;
  refreshThreshold?: number;
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | StorageAdapter;
  onAuthStateChange?: (user: User | null) => void;
}

export interface LoginResult {
  user: User;
  accessToken: string;
}

export interface RegisterResult {
  user: User;
  message: string;
}

export interface MessageResult {
  message: string;
}

export interface RedirectOptions {
  redirectUri: string;
  state?: string;
}

export interface CallbackResult {
  user: User;
  accessToken: string;
}

export type AuthStateCallback = (user: User | null) => void;
