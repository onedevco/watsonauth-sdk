"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/next.ts
var next_exports = {};
__export(next_exports, {
  withAuth: () => withAuth
});
module.exports = __toCommonJS(next_exports);
var import_server = require("next/server");
var jose = __toESM(require("jose"), 1);
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
      return import_server.NextResponse.next();
    }
    const token = request.cookies.get("watsonauth_token")?.value || request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return import_server.NextResponse.redirect(loginUrl);
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
      return import_server.NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
    } catch {
      const loginUrl = new URL(loginPath, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const response = import_server.NextResponse.redirect(loginUrl);
      response.cookies.delete("watsonauth_token");
      return response;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  withAuth
});
//# sourceMappingURL=next.cjs.map