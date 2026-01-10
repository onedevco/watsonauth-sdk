import { AuthError } from './errors';
import { resolveStorage, TOKEN_KEY, REFRESH_TOKEN_KEY } from './storage';
import type {
  WatsonAuthConfig,
  User,
  TokenPayload,
  StorageAdapter,
  LoginResult,
  RegisterResult,
  MessageResult,
  AuthStateCallback,
  RedirectOptions,
  CallbackResult,
} from './types';

export class WatsonAuth {
  private baseUrl: string;
  private appSlug: string;
  private autoRefresh: boolean;
  private refreshThreshold: number;
  private storage: StorageAdapter;
  private listeners: Set<AuthStateCallback> = new Set();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private currentUser: User | null = null;

  constructor(config: WatsonAuthConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.appSlug = config.appSlug;
    this.autoRefresh = config.autoRefresh ?? true;
    this.refreshThreshold = config.refreshThreshold ?? 60;
    this.storage = resolveStorage(config.storage);

    if (config.onAuthStateChange) {
      this.listeners.add(config.onAuthStateChange);
    }

    this.initializeFromStorage();
  }

  private async initializeFromStorage(): Promise<void> {
    const token = await this.storage.get(TOKEN_KEY);
    if (token) {
      const payload = this.decodeToken(token);
      if (payload && !this.isTokenExpired(payload)) {
        this.currentUser = this.payloadToUser(payload);
        this.scheduleRefresh(payload);
        this.notifyListeners();
      } else {
        await this.tryRefresh();
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-App-Slug': this.appSlug,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw AuthError.fromResponse(data);
    }

    return data as T;
  }

  private decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload as TokenPayload;
    } catch {
      return null;
    }
  }

  private isTokenExpired(payload: TokenPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  }

  private shouldRefresh(payload: TokenPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now <= this.refreshThreshold;
  }

  private payloadToUser(payload: TokenPayload): User {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      emailVerified: payload.emailVerified,
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  private scheduleRefresh(payload: TokenPayload): void {
    if (!this.autoRefresh) return;

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const now = Math.floor(Date.now() / 1000);
    const refreshAt = payload.exp - this.refreshThreshold;
    const delay = Math.max(0, (refreshAt - now) * 1000);

    this.refreshTimer = setTimeout(() => {
      this.tryRefresh();
    }, delay);
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const response = await this.request<{ accessToken: string }>(
        '/api/auth/refresh',
        { method: 'POST' }
      );

      await this.storage.set(TOKEN_KEY, response.accessToken);
      const payload = this.decodeToken(response.accessToken);

      if (payload) {
        this.currentUser = this.payloadToUser(payload);
        this.scheduleRefresh(payload);
        this.notifyListeners();
        return true;
      }
    } catch {
      await this.clearAuth();
    }
    return false;
  }

  private async clearAuth(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    await this.storage.remove(TOKEN_KEY);
    await this.storage.remove(REFRESH_TOKEN_KEY);
    this.currentUser = null;
    this.notifyListeners();
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const response = await this.request<{ user: User; accessToken: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    await this.storage.set(TOKEN_KEY, response.accessToken);
    const payload = this.decodeToken(response.accessToken);

    this.currentUser = response.user;
    if (payload) {
      this.scheduleRefresh(payload);
    }
    this.notifyListeners();

    return {
      user: response.user,
      accessToken: response.accessToken,
    };
  }

  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<RegisterResult> {
    const response = await this.request<{ user: User; message: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }
    );

    return {
      user: response.user,
      message: response.message,
    };
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    }
    await this.clearAuth();
  }

  async forgotPassword(email: string): Promise<MessageResult> {
    return this.request<MessageResult>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageResult> {
    return this.request<MessageResult>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: newPassword }),
    });
  }

  async verifyEmail(token: string): Promise<MessageResult> {
    return this.request<MessageResult>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async getAccessToken(): Promise<string | null> {
    const token = await this.storage.get(TOKEN_KEY);
    if (!token) return null;

    const payload = this.decodeToken(token);
    if (!payload) return null;

    if (this.isTokenExpired(payload)) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) return null;
      return this.storage.get(TOKEN_KEY);
    }

    if (this.shouldRefresh(payload)) {
      this.tryRefresh();
    }

    return token;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  onAuthStateChange(callback: AuthStateCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);

    return () => {
      this.listeners.delete(callback);
    };
  }

  redirectToLogin(options: RedirectOptions): void {
    const params = new URLSearchParams({
      app: this.appSlug,
      redirect_uri: options.redirectUri,
    });

    if (options.state) {
      params.set('state', options.state);
    }

    window.location.href = `${this.baseUrl}/login?${params.toString()}`;
  }

  async handleCallback(): Promise<CallbackResult> {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      await this.storage.set(TOKEN_KEY, token);
      const payload = this.decodeToken(token);

      if (payload) {
        this.currentUser = this.payloadToUser(payload);
        this.scheduleRefresh(payload);
        this.notifyListeners();

        return {
          user: this.currentUser,
          accessToken: token,
        };
      }
    }

    const response = await this.request<{ user: User; accessToken: string }>(
      '/api/auth/callback',
      { method: 'POST' }
    );

    await this.storage.set(TOKEN_KEY, response.accessToken);
    const payload = this.decodeToken(response.accessToken);

    this.currentUser = response.user;
    if (payload) {
      this.scheduleRefresh(payload);
    }
    this.notifyListeners();

    return {
      user: response.user,
      accessToken: response.accessToken,
    };
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
  }
}
