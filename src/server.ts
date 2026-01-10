import * as jose from 'jose';
import type { TokenPayload } from './types';

export interface VerifyTokenOptions {
  jwksUrl: string;
  issuer?: string;
  audience?: string;
}

let jwksCache: Map<string, jose.JWTVerifyGetKey> = new Map();

export async function verifyToken(
  token: string,
  options: VerifyTokenOptions
): Promise<TokenPayload> {
  const { jwksUrl, issuer, audience } = options;

  let jwks = jwksCache.get(jwksUrl);
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    jwksCache.set(jwksUrl, jwks);
  }

  const verifyOptions: jose.JWTVerifyOptions = {};
  if (issuer) verifyOptions.issuer = issuer;
  if (audience) verifyOptions.audience = audience;

  const { payload } = await jose.jwtVerify(token, jwks, verifyOptions);

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    name: (payload.name as string | null) ?? null,
    emailVerified: payload.emailVerified as boolean,
    appId: payload.appId as string,
    iss: payload.iss as string,
    aud: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) as string,
    exp: payload.exp as number,
    iat: payload.iat as number,
  };
}

export function clearJwksCache(): void {
  jwksCache.clear();
}

export type { TokenPayload };
