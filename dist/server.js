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
      await jwtVerify(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      console.log("token verified");
      return NextResponse.next();
    } catch (error) {
      console.log("error", error);
      const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
      loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
      loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
      return NextResponse.redirect(loginUrl);
    }
  };
}
export {
  createWatsonAuthProxy
};
//# sourceMappingURL=server.js.map