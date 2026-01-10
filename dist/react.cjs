"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react.tsx
var react_exports = {};
__export(react_exports, {
  AuthError: () => AuthError,
  WatsonAuth: () => WatsonAuth,
  WatsonAuthProvider: () => WatsonAuthProvider,
  useWatsonAuth: () => useWatsonAuth
});
module.exports = __toCommonJS(react_exports);
var import_react = require("react");

// src/errors.ts
var AuthError = class _AuthError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, _AuthError.prototype);
  }
  static fromResponse(data) {
    return new _AuthError(
      data.code || "unknown_error",
      data.message || "An unknown error occurred",
      data.details
    );
  }
};

// src/storage.ts
var TOKEN_KEY = "watsonauth_token";
var REFRESH_TOKEN_KEY = "watsonauth_refresh_token";
function createMemoryStorage() {
  const store = /* @__PURE__ */ new Map();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => {
      store.set(key, value);
    },
    remove: (key) => {
      store.delete(key);
    }
  };
}
function createLocalStorage() {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
      }
    }
  };
}
function createSessionStorage() {
  return {
    get: (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        sessionStorage.setItem(key, value);
      } catch {
      }
    },
    remove: (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch {
      }
    }
  };
}
function resolveStorage(storage) {
  if (!storage || storage === "memory") {
    return createMemoryStorage();
  }
  if (storage === "localStorage") {
    return createLocalStorage();
  }
  if (storage === "sessionStorage") {
    return createSessionStorage();
  }
  return storage;
}

// src/client.ts
var WatsonAuth = class {
  constructor(config) {
    this.listeners = /* @__PURE__ */ new Set();
    this.refreshTimer = null;
    this.currentUser = null;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.appSlug = config.appSlug;
    this.autoRefresh = config.autoRefresh ?? true;
    this.refreshThreshold = config.refreshThreshold ?? 60;
    this.storage = resolveStorage(config.storage);
    if (config.onAuthStateChange) {
      this.listeners.add(config.onAuthStateChange);
    }
    this.initializeFromStorage();
  }
  async initializeFromStorage() {
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
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "X-App-Slug": this.appSlug,
      ...options.headers
    };
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include"
    });
    const data = await response.json();
    if (!response.ok) {
      throw AuthError.fromResponse(data);
    }
    return data;
  }
  decodeToken(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      return null;
    }
  }
  isTokenExpired(payload) {
    const now = Math.floor(Date.now() / 1e3);
    return payload.exp <= now;
  }
  shouldRefresh(payload) {
    const now = Math.floor(Date.now() / 1e3);
    return payload.exp - now <= this.refreshThreshold;
  }
  payloadToUser(payload) {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      emailVerified: payload.emailVerified
    };
  }
  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }
  scheduleRefresh(payload) {
    if (!this.autoRefresh) return;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    const now = Math.floor(Date.now() / 1e3);
    const refreshAt = payload.exp - this.refreshThreshold;
    const delay = Math.max(0, (refreshAt - now) * 1e3);
    this.refreshTimer = setTimeout(() => {
      this.tryRefresh();
    }, delay);
  }
  async tryRefresh() {
    try {
      const response = await this.request(
        "/api/auth/refresh",
        { method: "POST" }
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
  async clearAuth() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    await this.storage.remove(TOKEN_KEY);
    await this.storage.remove(REFRESH_TOKEN_KEY);
    this.currentUser = null;
    this.notifyListeners();
  }
  async login(email, password) {
    const response = await this.request(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
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
      accessToken: response.accessToken
    };
  }
  async register(email, password, name) {
    const response = await this.request(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ email, password, name })
      }
    );
    return {
      user: response.user,
      message: response.message
    };
  }
  async logout() {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } catch {
    }
    await this.clearAuth();
  }
  async forgotPassword(email) {
    return this.request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }
  async resetPassword(token, newPassword) {
    return this.request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: newPassword })
    });
  }
  async verifyEmail(token) {
    return this.request("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    });
  }
  async getAccessToken() {
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
  getUser() {
    return this.currentUser;
  }
  isAuthenticated() {
    return this.currentUser !== null;
  }
  onAuthStateChange(callback) {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }
  redirectToLogin(options) {
    const params = new URLSearchParams({
      app: this.appSlug,
      redirect_uri: options.redirectUri
    });
    if (options.state) {
      params.set("state", options.state);
    }
    window.location.href = `${this.baseUrl}/login?${params.toString()}`;
  }
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      await this.storage.set(TOKEN_KEY, token);
      const payload2 = this.decodeToken(token);
      if (payload2) {
        this.currentUser = this.payloadToUser(payload2);
        this.scheduleRefresh(payload2);
        this.notifyListeners();
        return {
          user: this.currentUser,
          accessToken: token
        };
      }
    }
    const response = await this.request(
      "/api/auth/callback",
      { method: "POST" }
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
      accessToken: response.accessToken
    };
  }
  destroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
  }
};

// src/react.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var WatsonAuthContext = (0, import_react.createContext)(null);
function WatsonAuthProvider({
  children,
  ...config
}) {
  const [user, setUser] = (0, import_react.useState)(null);
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const client = (0, import_react.useMemo)(() => {
    return new WatsonAuth({
      ...config,
      onAuthStateChange: (newUser) => {
        setUser(newUser);
        setIsLoading(false);
      }
    });
  }, [config.baseUrl, config.appSlug]);
  (0, import_react.useEffect)(() => {
    return () => {
      client.destroy();
    };
  }, [client]);
  const login = (0, import_react.useCallback)(
    async (email, password) => {
      await client.login(email, password);
    },
    [client]
  );
  const register = (0, import_react.useCallback)(
    async (email, password, name) => {
      await client.register(email, password, name);
    },
    [client]
  );
  const logout = (0, import_react.useCallback)(async () => {
    await client.logout();
  }, [client]);
  const forgotPassword = (0, import_react.useCallback)(
    async (email) => {
      await client.forgotPassword(email);
    },
    [client]
  );
  const resetPassword = (0, import_react.useCallback)(
    async (token, newPassword) => {
      await client.resetPassword(token, newPassword);
    },
    [client]
  );
  const verifyEmail = (0, import_react.useCallback)(
    async (token) => {
      await client.verifyEmail(token);
    },
    [client]
  );
  const getAccessToken = (0, import_react.useCallback)(async () => {
    return client.getAccessToken();
  }, [client]);
  const value = (0, import_react.useMemo)(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      getAccessToken,
      client
    }),
    [
      user,
      isLoading,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      getAccessToken,
      client
    ]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatsonAuthContext.Provider, { value, children });
}
function useWatsonAuth() {
  const context = (0, import_react.useContext)(WatsonAuthContext);
  if (!context) {
    throw new Error("useWatsonAuth must be used within a WatsonAuthProvider");
  }
  return context;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthError,
  WatsonAuth,
  WatsonAuthProvider,
  useWatsonAuth
});
//# sourceMappingURL=react.cjs.map