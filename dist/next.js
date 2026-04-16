// src/callback.ts
import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
function createCallbackGET() {
  return async (request) => {
    const accessToken = request.nextUrl.searchParams.get("token");
    const refreshToken = request.nextUrl.searchParams.get("refreshToken");
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    if (!accessToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    let expiresIn = 900;
    try {
      const payload = decodeJwt(accessToken);
      if (payload.exp) {
        expiresIn = Math.max(0, payload.exp - Math.floor(Date.now() / 1e3));
      }
    } catch {
    }
    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/"
    });
    response.cookies.set("expires_at", String(Math.floor(Date.now() / 1e3) + expiresIn), {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/"
    });
    if (refreshToken) {
      response.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        // 30 days
        path: "/api/auth"
      });
    }
    return response;
  };
}

// src/logoutRoute.ts
import { NextResponse as NextResponse2 } from "next/server";
function createLogoutPOST() {
  return async () => {
    const response = NextResponse2.json({ success: true });
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
import { NextResponse as NextResponse3 } from "next/server";
var SESSION_EXPIRY_CODES = /* @__PURE__ */ new Set([
  "token_missing",
  "token_invalid",
  "token_reused",
  "session_revoked",
  "token_expired",
  "account_disabled"
]);
function createRefreshPOST() {
  return async (request) => {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
      return NextResponse3.json(
        { code: "token_missing", message: "No refresh token" },
        { status: 401 }
      );
    }
    let res;
    try {
      res = await fetch(`${process.env.WATSON_AUTH_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          // Forward the refresh token as a cookie so Watson Auth
          // receives it on the expected path
          Cookie: `refresh_token=${refreshToken}`
        }
      });
    } catch {
      return NextResponse3.json(
        { code: "server_error", message: "Failed to reach auth service" },
        { status: 502 }
      );
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const response2 = NextResponse3.json(body, { status: res.status });
      if (body.code && SESSION_EXPIRY_CODES.has(body.code)) {
        clearAuthCookies(response2);
      }
      return response2;
    }
    const data = await res.json();
    const isProduction = process.env.NODE_ENV === "production";
    const expiresAt = Math.floor(Date.now() / 1e3) + data.expiresIn;
    const response = NextResponse3.json({ expiresIn: data.expiresIn });
    response.cookies.set("access_token", data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: data.expiresIn,
      path: "/"
    });
    response.cookies.set("expires_at", String(expiresAt), {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      maxAge: data.expiresIn,
      path: "/"
    });
    return response;
  };
}
function clearAuthCookies(response) {
  response.cookies.set("access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("refresh_token", "", { maxAge: 0, path: "/api/auth" });
  response.cookies.set("expires_at", "", { maxAge: 0, path: "/" });
}
export {
  createCallbackGET,
  createLogoutPOST,
  createRefreshPOST
};
//# sourceMappingURL=next.js.map