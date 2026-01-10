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

// src/server.ts
var server_exports = {};
__export(server_exports, {
  clearJwksCache: () => clearJwksCache,
  verifyToken: () => verifyToken
});
module.exports = __toCommonJS(server_exports);
var jose = __toESM(require("jose"), 1);
var jwksCache = /* @__PURE__ */ new Map();
async function verifyToken(token, options) {
  const { jwksUrl, issuer, audience } = options;
  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }
  const verifyOptions = {};
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;
  const { payload } = await jose.jwtVerify(token, jwks, verifyOptions);
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    emailVerified: payload.emailVerified,
    appId: payload.appId,
    iss: payload.iss,
    aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
    exp: payload.exp,
    iat: payload.iat
  };
}
function clearJwksCache() {
  jwksCache.clear();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clearJwksCache,
  verifyToken
});
//# sourceMappingURL=server.cjs.map