// src/server.ts
import * as jose from "jose";
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
export {
  clearJwksCache,
  verifyToken
};
//# sourceMappingURL=server.js.map