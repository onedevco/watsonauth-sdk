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

// src/next.ts
var next_exports = {};
__export(next_exports, {
  createCallbackGET: () => createCallbackGET,
  createLogoutPOST: () => createLogoutPOST
});
module.exports = __toCommonJS(next_exports);

// src/callback.ts
var import_server = require("next/server");
function createCallbackGET() {
  return async (request) => {
    const accessToken = request.nextUrl.searchParams.get("token");
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    if (!accessToken) {
      return import_server.NextResponse.redirect(new URL("/login", request.url));
    }
    const response = import_server.NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15,
      // 15 minutes (match token expiry)
      path: "/"
    });
    return response;
  };
}

// src/logoutRoute.ts
var import_server2 = require("next/server");
function createLogoutPOST() {
  return async () => {
    const response = import_server2.NextResponse.json({ success: true });
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCallbackGET,
  createLogoutPOST
});
//# sourceMappingURL=next.cjs.map