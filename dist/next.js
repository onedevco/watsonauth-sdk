// src/next.ts
import { NextResponse } from "next/server";
import * as jose from "jose";
function withAuth(options) {
  const {
    jwksUrl,
    publicPaths = [],
    loginPath = "/login",
    issuer,
    audience
  } = options;
  let jwks = null;
  return async function middleware(request) {
    const { pathname } = request.nextUrl;
    const isPublicPath = publicPaths.some((path) => {
      if (path.endsWith("*")) {
        return pathname.startsWith(path.slice(0, -1));
      }
      return pathname === path;
    });
    if (isPublicPath) {
      return NextResponse.next();
    }
    const token = request.cookies.get("watsonauth_token")?.value || request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    try {
      if (!jwks) {
        jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
      }
      const verifyOptions = {};
      if (issuer) verifyOptions.issuer = issuer;
      if (audience) verifyOptions.audience = audience;
      const { payload } = await jose.jwtVerify(token, jwks, verifyOptions);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", payload.sub);
      requestHeaders.set("x-user-email", payload.email);
      return NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
    } catch {
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("watsonauth_token");
      return response;
    }
  };
}
export {
  withAuth
};
//# sourceMappingURL=next.js.map