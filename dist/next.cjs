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

// src/next.ts
var next_exports = {};
__export(next_exports, {
  createCallbackGET: () => createCallbackGET,
  createLogoutPOST: () => createLogoutPOST,
  createRefreshPOST: () => createRefreshPOST
});
module.exports = __toCommonJS(next_exports);

// src/callback.ts
var import_server = require("next/server");
var import_jose = require("jose");
function createCallbackGET() {
  return async (request) => {
    const accessToken = request.nextUrl.searchParams.get("token");
    const refreshToken = request.nextUrl.searchParams.get("refreshToken");
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    if (!accessToken) {
      return import_server.NextResponse.redirect(new URL("/login", request.url));
    }
    let expiresIn = 900;
    try {
      const payload = (0, import_jose.decodeJwt)(accessToken);
      if (payload.exp) {
        expiresIn = Math.max(0, payload.exp - Math.floor(Date.now() / 1e3));
      }
    } catch {
    }
    const isProduction = process.env.NODE_ENV === "production";
    const response = import_server.NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/"
    });
    if (refreshToken) {
      response.cookies.set("watson_refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        // 30 days
        path: "/"
      });
    }
    return response;
  };
}

// src/logoutRoute.ts
var import_server2 = require("next/server");
function createLogoutPOST() {
  return async () => {
    const response = import_server2.NextResponse.json({ success: true });
    response.cookies.set("access_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/"
    });
    return response;
  };
}

// src/refreshRoute.ts
var import_server3 = require("next/server");
function createRefreshPOST() {
  return async (request) => {
    const refreshToken = request.cookies.get("watson_refresh_token")?.value;
    if (!refreshToken) {
      return import_server3.NextResponse.json(
        { code: "token_missing", message: "No refresh token" },
        { status: 401 }
      );
    }
    let res;
    try {
      res = await fetch(`${process.env.WATSON_AUTH_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: `watson_refresh_token=${refreshToken}`
        }
      });
    } catch {
      return import_server3.NextResponse.json(
        { code: "server_error", message: "Failed to reach auth service" },
        { status: 502 }
      );
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const response2 = import_server3.NextResponse.json(body, { status: res.status });
      if (res.status === 401) clearAuthCookies(response2);
      return response2;
    }
    const data = await res.json();
    const isProduction = process.env.NODE_ENV === "production";
    const response = import_server3.NextResponse.json({ expiresIn: data.expiresIn });
    response.cookies.set("access_token", data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: data.expiresIn,
      path: "/"
    });
    response.cookies.set("watson_refresh_token", data.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/"
    });
    return response;
  };
}
function clearAuthCookies(response) {
  response.cookies.set("access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("watson_refresh_token", "", { maxAge: 0, path: "/" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCallbackGET,
  createLogoutPOST,
  createRefreshPOST
});
//# sourceMappingURL=next.cjs.map