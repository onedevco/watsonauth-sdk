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
    if (refreshToken) {
      response.cookies.set("watson_refresh_token", refreshToken, {
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
function createRefreshPOST() {
  return async (request) => {
    const refreshToken = request.cookies.get("watson_refresh_token")?.value;
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
          Cookie: `watson_refresh_token=${refreshToken}`
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
      if (res.status === 401) clearAuthCookies(response2);
      return response2;
    }
    const data = await res.json();
    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse3.json({ expiresIn: data.expiresIn });
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
      path: "/api/auth"
    });
    return response;
  };
}
function clearAuthCookies(response) {
  response.cookies.set("access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("watson_refresh_token", "", { maxAge: 0, path: "/api/auth" });
}
export {
  createCallbackGET,
  createLogoutPOST,
  createRefreshPOST
};
//# sourceMappingURL=next.js.map