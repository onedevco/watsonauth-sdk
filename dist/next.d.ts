import { NextRequest, NextResponse } from 'next/server';

interface WithAuthOptions {
    jwksUrl: string;
    publicPaths?: string[];
    loginPath?: string;
    issuer?: string;
    audience?: string;
}
declare function withAuth(options: WithAuthOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { type WithAuthOptions as NextAuthOptions, type WithAuthOptions, withAuth };
