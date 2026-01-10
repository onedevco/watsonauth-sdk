import { T as TokenPayload } from './types-DxWqrLJy.js';

interface VerifyTokenOptions {
    jwksUrl: string;
    issuer?: string;
    audience?: string;
}
declare function verifyToken(token: string, options: VerifyTokenOptions): Promise<TokenPayload>;
declare function clearJwksCache(): void;

export { TokenPayload, type VerifyTokenOptions, clearJwksCache, verifyToken };
