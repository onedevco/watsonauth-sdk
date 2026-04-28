import { NextRequest, NextResponse } from 'next/server';
export { createUserGET } from './userRoute.js';

interface WatsonAuthDebugEvent {
    action: 'allow' | 'refresh' | 'redirect';
    path: string;
    userId?: string;
    /** Unix seconds — when the current access token expires */
    tokenExpiresAt?: number;
    /** Date.now() value — when the last refresh completed */
    refreshedAt?: number;
    reason?: 'no_token' | 'no_refresh_token' | 'refresh_failed' | 'jwt_invalid';
}
declare function createWatsonAuthProxy({ initPublicPaths, debug, }: {
    initPublicPaths?: string[];
    debug?: boolean | ((event: WatsonAuthDebugEvent) => void);
}): (request: NextRequest) => Promise<NextResponse<unknown>>;

export { type WatsonAuthDebugEvent, createWatsonAuthProxy };
