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
  createWatsonAuthProxy: () => createWatsonAuthProxy
});
module.exports = __toCommonJS(server_exports);

// src/proxy.ts
var import_server = require("next/server");
var import_jose = require("jose");
var JWKS = (0, import_jose.createRemoteJWKSet)(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
function createWatsonAuthProxy({ initPublicPaths = [] }) {
  const publicPaths = ["/login", "/callback", ...initPublicPaths];
  return async (request) => {
    const { pathname } = request.nextUrl;
    if (publicPaths.some((p) => pathname === p || pathname.startsWith("/api/public"))) {
      return import_server.NextResponse.next();
    }
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
      loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
      loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
      console.log("redirecting to login", loginUrl.toString());
      return import_server.NextResponse.redirect(loginUrl);
    }
    try {
      await (0, import_jose.jwtVerify)(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      console.log("token verified");
      return import_server.NextResponse.next();
    } catch (error) {
      console.log("error", error);
      const loginUrl = new URL("/login", process.env.WATSON_AUTH_URL);
      loginUrl.searchParams.set("app", process.env.WATSON_AUTH_APP_SLUG);
      loginUrl.searchParams.set("callback", `${process.env.NEXT_PUBLIC_APP_URL}/callback`);
      return import_server.NextResponse.redirect(loginUrl);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createWatsonAuthProxy
});
//# sourceMappingURL=server.cjs.map