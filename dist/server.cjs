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

// src/server.ts
var server_exports = {};
__export(server_exports, {
  createUserGET: () => createUserGET,
  createWatsonAuthProxy: () => createWatsonAuthProxy
});
module.exports = __toCommonJS(server_exports);

// src/proxy.ts
var import_server = require("next/server");
var import_jose = require("jose");
var JWKS = (0, import_jose.createRemoteJWKSet)(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
var refreshInFlight = null;
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
function isNearExpiry(token, thresholdSeconds = 60) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp - Date.now() / 1e3 < thresholdSeconds;
}
async function refreshTokens(refreshToken) {
  if (!refreshInFlight) {
    refreshInFlight = _performRefresh(refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
async function _performRefresh(refreshToken) {
  try {
    const res = await fetch(`${process.env.WATSON_AUTH_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `watson_refresh_token=${refreshToken}`
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const payload = decodeJwtPayload(data.accessToken);
    if (!payload) return null;
    return { ...data, userId: payload.sub };
  } catch {
    return null;
  }
}
function applyRefreshedTokens(response, result) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("access_token", result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: result.expiresIn,
    path: "/"
  });
  response.cookies.set("watson_refresh_token", result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/"
  });
}
function redirectToLogin() {
  const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
  loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
  loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
  return import_server.NextResponse.redirect(loginUrl);
}
function setDebugCookie(response, event) {
  response.cookies.set("watson_auth_debug", JSON.stringify(event), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60
  });
}
function createWatsonAuthProxy({
  initPublicPaths = [],
  refreshThreshold,
  debug
}) {
  const publicPaths = ["/login", "/callback", ...initPublicPaths];
  const threshold = refreshThreshold ?? (process.env.WATSON_AUTH_REFRESH_THRESHOLD ? Number(process.env.WATSON_AUTH_REFRESH_THRESHOLD) : 60);
  const log = debug ? (event) => {
    if (typeof debug === "function") debug(event);
    else console.log("[WatsonAuth]", JSON.stringify(event));
  } : null;
  function emit(response, event) {
    if (!log) return response;
    log(event);
    setDebugCookie(response, event);
    return response;
  }
  function loginRedirect(event) {
    return emit(redirectToLogin(), event);
  }
  return async (request) => {
    const { pathname } = request.nextUrl;
    if (publicPaths.some((p) => p.endsWith("/") ? pathname.startsWith(p) : pathname === p)) {
      return import_server.NextResponse.next();
    }
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const currentRefreshToken = request.cookies.get("watson_refresh_token")?.value;
      if (!currentRefreshToken) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "no_token" });
      }
      const result = await refreshTokens(currentRefreshToken);
      if (!result) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "refresh_failed" });
      }
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", result.userId);
      const response = import_server.NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedTokens(response, result);
      return emit(response, {
        action: "refresh",
        path: pathname,
        userId: result.userId,
        tokenExpiresAt: Math.floor(Date.now() / 1e3) + result.expiresIn,
        refreshedAt: Date.now()
      });
    }
    if (isNearExpiry(token, threshold)) {
      const currentRefreshToken = request.cookies.get("watson_refresh_token")?.value;
      if (!currentRefreshToken) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "no_refresh_token" });
      }
      const result = await refreshTokens(currentRefreshToken);
      if (!result) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "refresh_failed" });
      }
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", result.userId);
      const response = import_server.NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedTokens(response, result);
      return emit(response, {
        action: "refresh",
        path: pathname,
        userId: result.userId,
        tokenExpiresAt: Math.floor(Date.now() / 1e3) + result.expiresIn,
        refreshedAt: Date.now()
      });
    }
    try {
      const { payload } = await (0, import_jose.jwtVerify)(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", payload.sub);
      const response = import_server.NextResponse.next({ request: { headers: requestHeaders } });
      return emit(response, {
        action: "allow",
        path: pathname,
        userId: payload.sub,
        tokenExpiresAt: payload.exp
      });
    } catch {
      const currentRefreshToken = request.cookies.get("watson_refresh_token")?.value;
      if (!currentRefreshToken) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "jwt_invalid" });
      }
      const result = await refreshTokens(currentRefreshToken);
      if (!result) {
        return loginRedirect({ action: "redirect", path: pathname, reason: "refresh_failed" });
      }
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", result.userId);
      const response = import_server.NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedTokens(response, result);
      return emit(response, {
        action: "refresh",
        path: pathname,
        userId: result.userId,
        tokenExpiresAt: Math.floor(Date.now() / 1e3) + result.expiresIn,
        refreshedAt: Date.now()
      });
    }
  };
}

// src/userRoute.ts
var import_server2 = require("next/server");
var import_jose2 = require("jose");
var JWKS2 = (0, import_jose2.createRemoteJWKSet)(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
function createUserGET() {
  return async (request) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      return import_server2.NextResponse.json({ user: null }, { status: 401 });
    }
    try {
      const { payload } = await (0, import_jose2.jwtVerify)(token, JWKS2, {
        issuer: process.env.WATSON_AUTH_URL
      });
      const user = {
        id: typeof payload.sub === "string" ? payload.sub : "",
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : null,
        emailVerified: Boolean(payload.emailVerified)
      };
      return import_server2.NextResponse.json({ user });
    } catch (error) {
      return import_server2.NextResponse.json({ user: null }, { status: 401 });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createUserGET,
  createWatsonAuthProxy
});
//# sourceMappingURL=server.cjs.map