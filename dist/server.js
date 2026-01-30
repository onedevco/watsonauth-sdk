// src/proxy.ts
import { NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
var JWKS = createRemoteJWKSet(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
function createWatsonAuthProxy({ initPublicPaths = [] }) {
  const publicPaths = ["/login", "/callback", ...initPublicPaths];
  return async (request) => {
    const { pathname } = request.nextUrl;
    if (publicPaths.some((p) => pathname === p || pathname.startsWith("/api/public"))) {
      return NextResponse.next();
    }
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
      loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
      loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
      console.log("redirecting to login", loginUrl.toString());
      return NextResponse.redirect(loginUrl);
    }
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      console.log("token verified");
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", payload.sub);
      console.log("requestHeaders", requestHeaders);
      console.log({
        request: { headers: requestHeaders }
      });
      return NextResponse.next({
        request: { headers: requestHeaders }
      });
    } catch (error) {
      console.log("error", error);
      const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
      loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
      loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
      return NextResponse.redirect(loginUrl);
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