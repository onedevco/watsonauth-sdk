// src/callback.ts
import { NextResponse } from "next/server";
function createCallbackGET() {
  return async (request) => {
    const accessToken = request.nextUrl.searchParams.get("token");
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    if (!accessToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
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
export {
  createCallbackGET,
  createLogoutPOST
};
//# sourceMappingURL=next.js.map