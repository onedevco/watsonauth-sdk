// src/proxy.ts
import { NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
var JWKS = createRemoteJWKSet(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
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
    path: "/api/auth"
  });
}
function redirectToLogin() {
  const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
  loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
  loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
  return NextResponse.redirect(loginUrl);
}
function createWatsonAuthProxy({ initPublicPaths = [] }) {
  const publicPaths = ["/login", "/callback", ...initPublicPaths];
  return async (request) => {
    const { pathname } = request.nextUrl;
    if (publicPaths.some((p) => p.endsWith("/") ? pathname.startsWith(p) : pathname === p)) {
      return NextResponse.next();
    }
    const token = request.cookies.get("access_token")?.value;
    if (!token) return redirectToLogin();
    if (isNearExpiry(token)) {
      const currentRefreshToken = request.cookies.get("watson_refresh_token")?.value;
      if (!currentRefreshToken) return redirectToLogin();
      const result = await refreshTokens(currentRefreshToken);
      if (!result) return redirectToLogin();
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", result.userId);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedTokens(response, result);
      return response;
    }
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", payload.sub);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      const currentRefreshToken = request.cookies.get("watson_refresh_token")?.value;
      if (!currentRefreshToken) return redirectToLogin();
      const result = await refreshTokens(currentRefreshToken);
      if (!result) return redirectToLogin();
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", result.userId);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedTokens(response, result);
      return response;
    }
  };
}

// src/userRoute.ts
import { NextResponse as NextResponse2 } from "next/server";
import { jwtVerify as jwtVerify2, createRemoteJWKSet as createRemoteJWKSet2 } from "jose";
var JWKS2 = createRemoteJWKSet2(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
function createUserGET() {
  return async (request) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse2.json({ user: null }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify2(token, JWKS2, {
        issuer: process.env.WATSON_AUTH_URL
      });
      const user = {
        id: typeof payload.sub === "string" ? payload.sub : "",
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : null,
        emailVerified: Boolean(payload.emailVerified)
      };
      return NextResponse2.json({ user });
    } catch (error) {
      return NextResponse2.json({ user: null }, { status: 401 });
    }
  };
}
export {
  createUserGET,
  createWatsonAuthProxy
};
//# sourceMappingURL=server.js.map