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

// src/userRoute.ts
var userRoute_exports = {};
__export(userRoute_exports, {
  createUserGET: () => createUserGET
});
module.exports = __toCommonJS(userRoute_exports);
var import_server = require("next/server");
var import_jose = require("jose");
var JWKS = (0, import_jose.createRemoteJWKSet)(new URL("/.well-known/jwks.json", process.env.WATSON_AUTH_URL));
function createUserGET() {
  return async (request) => {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      return import_server.NextResponse.json({ user: null }, { status: 401 });
    }
    try {
      const { payload } = await (0, import_jose.jwtVerify)(token, JWKS, {
        issuer: process.env.WATSON_AUTH_URL
      });
      const user = {
        id: typeof payload.sub === "string" ? payload.sub : "",
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : null,
        emailVerified: Boolean(payload.emailVerified)
      };
      return import_server.NextResponse.json({ user });
    } catch (error) {
      return import_server.NextResponse.json({ user: null }, { status: 401 });
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createUserGET
});
//# sourceMappingURL=userRoute.cjs.map