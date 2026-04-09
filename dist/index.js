// src/client.ts
var AuthError = class extends Error {
  constructor({ code, message, details }) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.details = details;
  }
};
var TOKEN_KEY = "watsonauth_access_token";
var SESSION_EXPIRY_CODES = /* @__PURE__ */ new Set([
  "token_missing",
  "token_invalid",
  "token_reused",
  "session_revoked",
  "token_expired",
  "account_disabled"
]);
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}
function buildStorage(opt) {
  if (!opt || opt === "memory") {
    const store = {};
    return {
      get: (k) => store[k] ?? null,
      set: (k, v) => {
        store[k] = v;
      },
      remove: (k) => {
        delete store[k];
      }
    };
  }
  if (opt === "localStorage") {
    return {
      get: (k) => typeof window !== "undefined" ? localStorage.getItem(k) : null,
      set: (k, v) => {
        if (typeof window !== "undefined") localStorage.setItem(k, v);
      },
      remove: (k) => {
        if (typeof window !== "undefined") localStorage.removeItem(k);
      }
    };
  }
  if (opt === "sessionStorage") {
    return {
      get: (k) => typeof window !== "undefined" ? sessionStorage.getItem(k) : null,
      set: (k, v) => {
        if (typeof window !== "undefined") sessionStorage.setItem(k, v);
      },
      remove: (k) => {
        if (typeof window !== "undefined") sessionStorage.removeItem(k);
      }
    };
  }
  return opt;
}
var WatsonAuth = class {
  constructor(config) {
    this.accessToken = null;
    this.refreshTimer = null;
    this.refreshPromise = null;
    this.listeners = /* @__PURE__ */ new Set();
    // Incremented on logout so an in-flight refresh can detect the session changed
    this.sessionGeneration = 0;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.appSlug = config.appSlug;
    this.autoRefresh = config.autoRefresh ?? true;
    this.refreshThreshold = config.refreshThreshold ?? 60;
    this.store = buildStorage(config.storage);
    this.configStateCallback = config.onAuthStateChange;
    void this.restoreSession();
  }
  // ── Auth methods ───────────────────────────────────────────────────────────
  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, appSlug: this.appSlug })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError({
        code: body.code ?? "login_failed",
        message: body.message ?? "Login failed",
        details: body.details
      });
    }
    const data = await res.json();
    await this.applyToken(data.accessToken, data.expiresIn);
    return { user: data.user, accessToken: data.accessToken };
  }
  async register(email, password, name) {
    const res = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, appSlug: this.appSlug })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError({
        code: body.code ?? "register_failed",
        message: body.message ?? "Registration failed",
        details: body.details
      });
    }
    return res.json();
  }
  async logout() {
    this.sessionGeneration++;
    this.cancelTimer();
    try {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch {
    }
    await this.clearSession();
  }
  async forgotPassword(email) {
    const res = await fetch(`${this.baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    return res.json();
  }
  async resetPassword(token, newPassword) {
    const res = await fetch(`${this.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError({
        code: body.code ?? "reset_failed",
        message: body.message ?? "Password reset failed"
      });
    }
    return res.json();
  }
  async verifyEmail(token) {
    const res = await fetch(`${this.baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AuthError({
        code: body.code ?? "verify_failed",
        message: body.message ?? "Email verification failed"
      });
    }
    return res.json();
  }
  // ── Token / state accessors ────────────────────────────────────────────────
  async getAccessToken() {
    if (!this.accessToken) return null;
    if (this.refreshPromise) return this.refreshPromise;
    const payload = decodeJwtPayload(this.accessToken);
    if (!payload || typeof payload.exp !== "number") return this.accessToken;
    const secondsRemaining = payload.exp - Date.now() / 1e3;
    if (secondsRemaining < this.refreshThreshold) {
      return this.startRefresh();
    }
    return this.accessToken;
  }
  getUser() {
    if (!this.accessToken) return null;
    const payload = decodeJwtPayload(this.accessToken);
    if (!payload) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      emailVerified: payload.emailVerified
    };
  }
  isAuthenticated() {
    if (!this.accessToken) return false;
    const payload = decodeJwtPayload(this.accessToken);
    if (!payload || typeof payload.exp !== "number") return false;
    return payload.exp > Date.now() / 1e3;
  }
  onAuthStateChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  // ── Redirect flow helpers ──────────────────────────────────────────────────
  redirectToLogin(opts) {
    const url = new URL("/login", this.baseUrl);
    url.searchParams.set("app", this.appSlug);
    url.searchParams.set("callback", opts.redirectUri);
    if (opts.state) url.searchParams.set("state", opts.state);
    window.location.href = url.toString();
  }
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const expiresIn = Number(params.get("expiresIn") ?? 900);
    if (!token) return null;
    await this.applyToken(token, expiresIn);
    return { user: this.getUser(), accessToken: token };
  }
  // ── Private helpers ────────────────────────────────────────────────────────
  async restoreSession() {
    const stored = await this.store.get(TOKEN_KEY);
    if (!stored) return;
    const payload = decodeJwtPayload(stored);
    if (!payload || typeof payload.exp !== "number") {
      await this.store.remove(TOKEN_KEY);
      return;
    }
    const secondsRemaining = payload.exp - Date.now() / 1e3;
    if (secondsRemaining <= 0) {
      await this.store.remove(TOKEN_KEY);
      return;
    }
    this.accessToken = stored;
    if (this.autoRefresh) {
      this.scheduleRefresh(secondsRemaining);
    }
    this.notify();
  }
  async applyToken(token, expiresIn) {
    this.accessToken = token;
    await this.store.set(TOKEN_KEY, token);
    if (this.autoRefresh) {
      this.scheduleRefresh(expiresIn);
    }
    this.notify();
  }
  scheduleRefresh(expiresIn) {
    this.cancelTimer();
    const delay = Math.max(0, (expiresIn - this.refreshThreshold) * 1e3);
    this.refreshTimer = setTimeout(() => void this.startRefresh(), delay);
  }
  startRefresh() {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }
  async performRefresh(attempt = 0) {
    const gen = this.sessionGeneration;
    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });
    } catch {
      return this.accessToken;
    }
    if (this.sessionGeneration !== gen) return null;
    if (res.ok) {
      const data = await res.json();
      await this.applyToken(data.accessToken, data.expiresIn);
      return data.accessToken;
    }
    let code;
    try {
      const body = await res.json();
      code = body.code;
    } catch {
    }
    if (code && SESSION_EXPIRY_CODES.has(code)) {
      await this.clearSession();
      return null;
    }
    if (code === "server_error" && attempt < 3) {
      const backoff = Math.min(1e3 * 2 ** attempt, 3e4);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      if (this.sessionGeneration !== gen) return null;
      return this.performRefresh(attempt + 1);
    }
    return this.accessToken;
  }
  async clearSession() {
    this.accessToken = null;
    await this.store.remove(TOKEN_KEY);
    this.notify();
  }
  cancelTimer() {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  notify() {
    const user = this.getUser();
    this.configStateCallback?.(user);
    this.listeners.forEach((fn) => fn(user));
  }
};
export {
  AuthError,
  WatsonAuth
};
//# sourceMappingURL=index.js.map